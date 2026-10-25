/**
 * Host half of dsh-next-hint.
 *
 * Contract: docs/IMPLEMENTATION-CONTRACT.md. Design: docs/adr/0004.
 * The browser half decides when to ask; this half owns the model call.
 *
 * Official packages are loaded lazily: a host whose resolver cannot reach them
 * must mount this plugin without the route rather than fail the profile boot.
 */

import { registerHintRoute } from "./routes.mjs";

export const name = "next-hint";

/** Services this half needs: the model, the session store, the HTTP carrier, the admission fence. */
export const inject = ["llm", "sessions", "webServer", "connection"];

/** Settings page schema, or undefined when schemastery is unreachable. */
export let Config;

async function loadSchemastery() {
  const loaded = await import("@deepseek-ai/schemastery");
  return loaded.default ?? loaded;
}

try {
  const z = await loadSchemastery();
  Config = z.object({
    enabled: z.boolean().default(true),
    provider: z.string(),
    model: z.string(),
    locale: z.union([z.const("auto"), z.const("zh"), z.const("en")]).default("auto"),
    maxTurns: z.number().step(1).min(1).max(8).default(3),
    maxInputBytes: z.number().step(1).min(512).max(65536).default(8000),
    maxOutputTokens: z.number().step(1).min(32).max(1024).default(128),
    maxHintChars: z.number().step(1).min(8).max(200).default(48),
    timeoutMs: z.number().step(1).min(1000).max(60000).default(15000),
    perSessionCooldownMs: z.number().step(1).min(0).max(600000).default(0),
  });
} catch {
  Config = undefined;
}

/** Defaults applied even when the loader supplies no schema-resolved config. */
const DEFAULTS = deepFreeze({
  enabled: true,
  locale: "auto",
  maxTurns: 3,
  maxInputBytes: 8000,
  maxOutputTokens: 128,
  maxHintChars: 48,
  timeoutMs: 15000,
  perSessionCooldownMs: 0,
});

/** Shallow freeze, enough for a flat configuration record. */
function deepFreeze(value) {
  return Object.freeze(value);
}

/**
 * Validate configuration the schema cannot express and fill absent defaults.
 * @param {any} config - loader-supplied configuration.
 * @returns {any} the resolved configuration.
 */
export function resolveConfig(config) {
  const source = config ?? {};
  const hasProvider = typeof source.provider === "string" && source.provider !== "";
  const hasModel = typeof source.model === "string" && source.model !== "";
  if (hasProvider !== hasModel) {
    throw new Error("next-hint: provider and model must be configured together");
  }
  const resolved = { ...DEFAULTS };
  for (const [key, value] of Object.entries(source)) if (value !== undefined) resolved[key] = value;
  return resolved;
}

/**
 * Build a deadline that also honours the caller's signal.
 * @param {AbortSignal | undefined} signal
 * @param {number} timeoutMs
 * @param {string} code
 * @returns {{ signal: AbortSignal, [Symbol.dispose]: () => void }}
 */
export function makeDeadline(signal, timeoutMs, code) {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    const error = new Error(code);
    error.code = code;
    controller.abort(error);
  }, timeoutMs);
  const onAbort = () => controller.abort(signal?.reason);
  if (signal !== undefined) {
    if (signal.aborted) onAbort();
    else signal.addEventListener("abort", onAbort, { once: true });
  }
  return {
    signal: controller.signal,
    [Symbol.dispose]() {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    },
  };
}

/**
 * Resolve the LLM seams, or undefined when the host cannot serve them.
 * @returns {Promise<{ createUserMessage: Function, BlockAssembler: Function, deadline: Function } | undefined>}
 */
async function loadLlmSeams() {
  try {
    const llm = await import("@deepseek-ai/dsh-llm");
    if (typeof llm.createUserMessage !== "function" || typeof llm.BlockAssembler !== "function") return undefined;
    return { createUserMessage: llm.createUserMessage, BlockAssembler: llm.BlockAssembler, deadline: makeDeadline };
  } catch {
    return undefined;
  }
}

/**
 * Claim the route once the seams are known.
 * @param {any} ctx
 * @param {any} resolved
 */
async function boot(ctx, resolved) {
  const llmSeams = await loadLlmSeams();
  if (llmSeams === undefined) {
    ctx.logger.warn("next-hint: @deepseek-ai/dsh-llm is unavailable; hints stay off");
    return;
  }
  ctx.effect(
    () =>
      registerHintRoute(ctx, {
        config: resolved,
        sessions: ctx.sessions,
        llm: ctx.llm,
        llmSeams,
        logger: ctx.logger,
      }),
    "next-hint: hint route",
  );
}

/**
 * Mount the host half.
 * @param {any} ctx - host context.
 * @param {any} config - validated configuration.
 */
export function apply(ctx, config) {
  const resolved = resolveConfig(config);
  void boot(ctx, resolved).catch((error) => {
    ctx.logger.warn(`next-hint: host half disabled (${error instanceof Error ? error.message : String(error)})`);
  });
}
