/**
 * Host seam: POST /api/next-hint (AD-0004).
 *
 * The browser half asks; this half reads the session, spends one auxiliary
 * model call, and answers. Every refusal path is silent to the user.
 * @module dsh-next-hint/routes
 */

import { MAX_BODY_BYTES, ROUTE_PATH, parseHintRequest } from "../src/contracts/hint.mjs";
import { buildTranscript } from "../src/context.mjs";
import { requestHint } from "../src/generate.mjs";
import { createLedger } from "../src/trigger.mjs";

/** IPv4 loopback and its IPv4-mapped IPv6 form. */
const LOOPBACK_V4 = /^127\./u;

/**
 * Classify one socket address as loopback.
 * @param {string | undefined} address
 * @returns {boolean}
 */
export function isLoopbackAddress(address) {
  if (typeof address !== "string" || address === "") return false;
  const bare = address.startsWith("::ffff:") ? address.slice("::ffff:".length) : address;
  return bare === "::1" || bare === "localhost" || LOOPBACK_V4.test(bare);
}

/**
 * Accept same-origin browser calls without pinning one spelling of loopback.
 * @param {string | undefined} origin - request `Origin` header.
 * @param {number | undefined} expectedPort - the listening port, when known.
 * @returns {boolean}
 */
export function isAllowedOrigin(origin, expectedPort) {
  if (typeof origin !== "string" || origin === "") return true;
  let parsed;
  try {
    parsed = new URL(origin);
  } catch {
    return false;
  }
  const host = parsed.hostname;
  const loopback = host === "localhost" || host === "::1" || host === "[::1]" || LOOPBACK_V4.test(host);
  if (!loopback) return false;
  if (typeof expectedPort !== "number") return true;
  const port = parsed.port === "" ? (parsed.protocol === "https:" ? 443 : 80) : Number(parsed.port);
  return port === expectedPort;
}

/**
 * Answer without a body.
 * @param {import("node:http").ServerResponse} res
 * @param {number} status
 */
function end(res, status, reason) {
  res.writeHead(status, reason === undefined ? {} : { "x-next-hint-reason": reason });
  res.end();
}

/**
 * Answer with JSON.
 * @param {import("node:http").ServerResponse} res
 * @param {number} status
 * @param {unknown} payload
 */
function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(body);
}

/**
 * Read a bounded request body.
 * @param {import("node:http").IncomingMessage} req
 * @param {number} maxBytes
 * @returns {Promise<string | undefined>} undefined when the body is too large.
 */
function readBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    let size = 0;
    /** @type {Buffer[]} */
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        resolve(undefined);
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

/**
 * Flatten a session message into plain text.
 * @param {any} message
 * @returns {string}
 */
function textOf(message) {
  const content = message?.content;
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((block) => block?.type === "text" && typeof block.text === "string")
    .map((block) => block.text)
    .join(" ");
}

/**
 * Read a message role without trusting one exact field name.
 * @param {any} message
 * @returns {"user" | "assistant" | "unknown"}
 */
function roleOf(message) {
  if (message?.role === "user" || message?.role === "assistant") return message.role;
  if (message?.source?.kind === "user") return "user";
  return "unknown";
}

/**
 * Convert derived session messages into context samples.
 * @param {any[]} messages
 * @returns {{ role: "user" | "assistant" | "unknown", text: string }[]}
 */
export function toSamples(messages) {
  if (!Array.isArray(messages)) return [];
  return messages.map((message) => ({ role: roleOf(message), text: textOf(message) }));
}

/**
 * Route the auxiliary call the same way the session's last request went.
 * @param {any} session
 * @param {{ provider?: string, model?: string }} config
 * @returns {Record<string, unknown>}
 */
export function resolveRoute(session, config) {
  if (config.provider !== undefined && config.model !== undefined) {
    return { provider: config.provider, model: config.model };
  }
  const context = session?.requestContext?.();
  if (typeof context?.provider === "string" && typeof context?.model === "string") {
    return { provider: context.provider, model: context.model };
  }
  return {};
}

/**
 * System instruction for the hint call.
 * @param {"zh" | "en" | undefined} locale
 * @param {string} workspace
 * @param {number} maxChars
 * @returns {string}
 */
export function systemInstruction(locale, workspace, maxChars) {
  const language = locale === "zh" ? "Simplified Chinese" : locale === "en" ? "English" : "the language of the conversation";
  return [
    "You help a user of a coding assistant decide what to say next.",
    `Write the single most useful next message the human could send, in ${language}.`,
    "It must be a ready-to-send prompt from the human to the assistant, never a question to the human and never an explanation.",
    `Keep it under ${maxChars} characters, one line, no quotes, no markdown, no bullet, no trailing punctuation other than what a sentence needs.`,
    workspace === "" ? "" : `The workspace is ${workspace}.`,
    "Prefer continuing the work in progress (verify a change, run its test, fix a failure, commit) over inventing new work.",
    "If nothing sensible follows, reply with the single word: NONE",
  ]
    .filter((line) => line !== "")
    .join("\n");
}

/**
 * Create the request handler (the webserver owns the socket).
 * @param {object} deps
 * @param {any} deps.config - resolved plugin configuration.
 * @param {any} deps.sessions - host `ctx.sessions`.
 * @param {any} deps.webServer - host `ctx.webServer`.
 * @param {any} deps.llm - host `ctx.llm`.
 * @param {any} deps.llmSeams - `{ createUserMessage, BlockAssembler, deadline }`.
 * @param {any} deps.logger - host logger.
 * @param {() => number} [deps.now]
 * @returns {(req: any, res: any) => Promise<void>}
 */
export function createHintHandler(deps) {
  const { config, sessions, webServer, llm, llmSeams, logger } = deps;
  const now = deps.now ?? Date.now;
  const ledger = createLedger();

  return async function handle(req, res) {
    try {
      if (req.method !== "POST") return end(res, 405);
      if (!isLoopbackAddress(req.socket?.remoteAddress)) return end(res, 403);
      if (!isAllowedOrigin(req.headers?.origin, webServer.port)) return end(res, 403);
      if (req.headers?.["sec-fetch-site"] === "cross-site") return end(res, 403);

      const raw = await readBody(req, MAX_BODY_BYTES);
      if (raw === undefined) return end(res, 413);
      let body;
      try {
        body = JSON.parse(raw);
      } catch {
        return end(res, 400);
      }
      const parsed = parseHintRequest(body);
      if (!parsed.ok) return end(res, 400);

      const session = sessions.get(parsed.request.sessionId);
      if (session === undefined) return end(res, 404);

      const startedAt = now();
      if (!ledger.begin(parsed.request.sessionId, startedAt, config.perSessionCooldownMs, config.enabled)) {
        return end(res, 204, "gated");
      }
      try {
        const transcript = buildTranscript(toSamples(session.deriveMessages()), {
          maxTurns: config.maxTurns,
          maxInputBytes: config.maxInputBytes,
        });
        if (transcript.trim() === "") return end(res, 204, "no-context");

        const result = await requestHint(
          { ...llmSeams, prepareCall: llm.prepareCall.bind(llm) },
          {
            route: resolveRoute(session, config),
            system: systemInstruction(parsed.request.locale, typeof session.cwd === "string" ? session.cwd : "", config.maxHintChars),
            transcript,
            sessionId: parsed.request.sessionId,
            timeoutMs: config.timeoutMs,
            maxOutputTokens: config.maxOutputTokens,
            maxHintChars: config.maxHintChars,
          },
        );
        if (!result.ok) {
          logger.warn(`next-hint: no suggestion (${result.reason})`);
          return end(res, 204, result.reason);
        }
        return json(res, 200, { hint: result.hint });
      } finally {
        ledger.end(parsed.request.sessionId, now());
      }
    } catch (error) {
      logger.warn(error instanceof Error ? error : new Error(String(error)));
      if (!res.headersSent) end(res, 500);
      else res.destroy();
      return undefined;
    }
  };
}

/**
 * Claim the route.
 * @param {any} ctx - host context carrying `webServer`.
 * @param {object} deps - same dependencies as {@link createHintHandler}.
 * @returns {() => void} disposer.
 */
export function registerHintRoute(ctx, deps) {
  const handler = createHintHandler({ ...deps, webServer: ctx.webServer });
  return ctx.webServer.register({ kind: "exact", path: ROUTE_PATH, handler });
}
