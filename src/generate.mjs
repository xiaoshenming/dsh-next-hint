/**
 * One auxiliary model request, decoupled from the main turn.
 *
 * Every seam the host owns (LLM service, message factory, stream assembly,
 * deadline) arrives as an injected dependency, so this module stays free of
 * official packages and is testable with fakes.
 * @module dsh-next-hint/generate
 */

/** A cleaned line this long is a paragraph, not a hint: reject instead of truncating. */
const RUNAWAY_CODE_POINTS = 400;

/** Leading list bullets models add despite instructions. */
const LEADING_BULLET = /^(?:[-*•]|\d+[.)])\s+/u;

/** Wrapping emphasis or quotes around the whole line. */
const WRAPPING = /^[\s"'\u0060\u201c\u201d\u300c\u300d*_]+|[\s"'\u0060\u201c\u201d\u300c\u300d*_]+$/gu;

/** Any run of whitespace, collapsed so a hint never carries a newline or a tab. */
const WHITESPACE_RUN = /\s+/gu;

/** The instruction's explicit "nothing sensible follows" answer. */
const NOTHING_TO_SUGGEST = /^(?:none|n\/a|无|没有)$/iu;

/**
 * Reduce raw model output to one sendable line.
 * @param {string} raw - model text, possibly multi-line or decorated.
 * @param {number} maxChars - hard cap in Unicode code points.
 * @returns {string} the hint, or an empty string when nothing usable is left.
 */
export function cleanHint(raw, maxChars) {
  if (typeof raw !== "string") return "";
  const firstLine = raw.split(/\r?\n/u).map((line) => line.trim()).find((line) => line.length > 0) ?? "";
  const stripped = firstLine.replace(LEADING_BULLET, "").replace(WRAPPING, "").replace(WHITESPACE_RUN, " ").trim();
  if (stripped === "" || NOTHING_TO_SUGGEST.test(stripped)) return "";
  const codePoints = Array.from(stripped);
  const limit = Math.max(1, Math.trunc(maxChars));
  if (codePoints.length > RUNAWAY_CODE_POINTS) return "";
  return codePoints.length <= limit ? stripped : codePoints.slice(0, limit).join("").trimEnd();
}

/**
 * Ask the adapter for its cheapest reasoning level: a one-line hint does not
 * need the effort a coding turn may. Mirrors the session-title providers.
 * @param {Record<string, unknown>} controls
 * @param {{ reasoning?: { efforts?: { id?: string }[] } }} model
 * @returns {Record<string, unknown>}
 */
function leastEffort(controls, model) {
  const effort = model?.reasoning?.efforts?.[0]?.id;
  return typeof effort === "string" ? { ...controls, reasoningEffort: effort } : controls;
}

/**
 * @typedef {object} GenerateDeps
 * @property {Function} prepareCall - `ctx.llm.prepareCall`.
 * @property {Function} createUserMessage - `@deepseek-ai/dsh-llm` message factory.
 * @property {Function} BlockAssembler - `@deepseek-ai/dsh-llm` stream assembler.
 * @property {Function} deadline - `@deepseek-ai/dsh-timeout` deadline factory.
 */

/**
 * @typedef {object} GenerateOptions
 * @property {Record<string, unknown>} route - provider/model controls for `prepareCall`.
 * @property {string} system - system instruction.
 * @property {string} transcript - user input assembled by `context.mjs`.
 * @property {string} sessionId - session the request is logged against.
 * @property {number} timeoutMs
 * @property {number} maxOutputTokens
 * @property {number} maxHintChars
 * @property {AbortSignal} [signal]
 */

/**
 * Run one hint request. Never throws: every failure becomes a reason code.
 * @param {GenerateDeps} deps
 * @param {GenerateOptions} options
 * @returns {Promise<{ ok: true, hint: string } | { ok: false, reason: string }>}
 */
export async function requestHint(deps, options) {
  const { prepareCall, createUserMessage, BlockAssembler, deadline } = deps;
  /** @type {{ [Symbol.dispose]?: () => void } | undefined} */
  let budget;
  try {
    budget = deadline(options.signal, options.timeoutMs, "NEXT_HINT_TIMEOUT");
    const call = await prepareCall({ ...options.route, maxTokens: options.maxOutputTokens }, budget.signal, leastEffort);
    const messages = [
      createUserMessage({
        content: [{ type: "text", text: options.transcript }],
        source: { kind: "dsh-next-hint" },
      }),
    ];
    const assembler = new BlockAssembler();
    const stream = call.stream({
      ...call.config,
      messages,
      system: options.system,
      sessionId: options.sessionId,
      purpose: "next-hint",
      signal: budget.signal,
    });
    for await (const chunk of stream) assembler.push(chunk);
    const finish = assembler.finish;
    const kind = finish === undefined ? "unknown" : finish.kind;
    // A max-tokens cut still carries the first line; a tool call or an error
    // finishes without one, and those stay refused.
    if (kind !== "stop" && kind !== "max-tokens") return { ok: false, reason: `finish-${kind}` };
    const text = assembler
      .blocks()
      .filter((block) => block.type === "text" && typeof block.text === "string")
      .map((block) => block.text)
      .join(" ");
    const hint = cleanHint(text, options.maxHintChars);
    if (hint === "") return { ok: false, reason: kind === "stop" ? "empty" : `finish-${kind}` };
    return { ok: true, hint };
  } catch (error) {
    const code = typeof error === "object" && error !== null ? /** @type {any} */ (error).code : undefined;
    if (typeof code === "string" && code !== "") return { ok: false, reason: code };
    const name = typeof error === "object" && error !== null ? /** @type {any} */ (error).name : undefined;
    return { ok: false, reason: name === "AbortError" ? "aborted" : "error" };
  } finally {
    const dispose = budget?.[Symbol.dispose];
    if (typeof dispose === "function") dispose.call(budget);
  }
}
