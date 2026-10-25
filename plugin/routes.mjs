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

/** One retry when the model declines, so a single refusal cannot swallow the turn. */
const HINT_ATTEMPTS = 2;

/**
 * System instruction for the hint call.
 * @param {"zh" | "en" | undefined} locale
 * @param {string} workspace
 * @param {number} maxChars
 * @param {number} [attempt] - 1 for the first ask, 2 after a refusal.
 * @returns {string}
 */
export function systemInstruction(locale, workspace, maxChars, attempt = 1) {
  const language = locale === "zh" ? "Simplified Chinese" : locale === "en" ? "English" : "the language of the conversation";
  const lines = [
    "You help a user of a coding assistant decide what to say next.",
    `Write the single most useful next message the human could send, in ${language}.`,
    "It must be a ready-to-send prompt from the human to the assistant, never a question to the human and never an explanation.",
    `Keep it under ${maxChars} characters, one line, no quotes, no markdown, no bullet, no trailing punctuation other than what a sentence needs.`,
    workspace === "" ? "" : `The workspace is ${workspace}.`,
    "Prefer continuing the work in progress (verify a change, run its test, fix a failure, commit) over inventing new work.",
    "Always answer with one concrete next message the human could send, even after a short or social turn.",
    "Never decline, never explain, and never answer with a placeholder such as NONE.",
  ];
  if (attempt > 1) lines.push("Your previous reply was not a usable suggestion. Answer again with one concrete next message, and nothing else.");
  return lines.filter((line) => line !== "").join("\n");
}

/**
 * Create the request handler (the webserver owns the socket).
 * @param {object} deps
 * @param {any} deps.config - resolved plugin configuration.
 * @param {any} deps.sessions - host `ctx.sessions`.
 * @param {any} deps.webServer - host `ctx.webServer`.
 * @param {any} [deps.connection] - host `ctx.connection`; owner admission when present.
 * @param {any} deps.llm - host `ctx.llm`.
 * @param {any} deps.llmSeams - `{ createUserMessage, BlockAssembler, deadline }`.
 * @param {any} deps.logger - host logger.
 * @param {() => number} [deps.now]
 * @returns {(req: any, res: any) => Promise<void>}
 */
export function createHintHandler(deps) {
  const { config, sessions, webServer, connection, llm, llmSeams, logger } = deps;
  const now = deps.now ?? Date.now;
  const ledger = createLedger();

  return async function handle(req, res) {
    try {
      if (req.method !== "POST") return end(res, 405);
      if (!isLoopbackAddress(req.socket?.remoteAddress)) return end(res, 403);
      if (connection !== undefined) {
        const admission = connection.admit(req);
        if ("rejection" in admission) return end(res, admission.rejection);
        if (admission.peer?.principal?.kind !== "owner") return end(res, 403);
      }
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
      // A browser that leaves mid-call must free the session's single flight:
      // the closed response is the only reliable disconnect signal here.
      const disconnect = new AbortController();
      const onClose = () => {
        if (res.writableEnded !== true) disconnect.abort();
      };
      res.on?.("close", onClose);
      try {
        const transcript = buildTranscript(toSamples(session.deriveMessages()), {
          maxTurns: config.maxTurns,
          maxInputBytes: config.maxInputBytes,
        });
        if (transcript.trim() === "") return end(res, 204, "no-context");

        const route = resolveRoute(session, config);
        const workspace = typeof session.cwd === "string" ? session.cwd : "";
        let result;
        for (let attempt = 1; attempt <= HINT_ATTEMPTS; attempt += 1) {
          result = await requestHint(
            { ...llmSeams, prepareCall: llm.prepareCall.bind(llm) },
            {
              route,
              system: systemInstruction(parsed.request.locale, workspace, config.maxHintChars, attempt),
              transcript,
              sessionId: parsed.request.sessionId,
              timeoutMs: config.timeoutMs,
              maxOutputTokens: config.maxOutputTokens,
              maxHintChars: config.maxHintChars,
              signal: disconnect.signal,
            },
          );
          const retry = !result.ok && result.reason === "empty" && attempt < HINT_ATTEMPTS && !disconnect.signal.aborted;
          if (!retry) break;
        }
        if (!result.ok) {
          if (result.reason !== "aborted") logger.warn(`next-hint: no suggestion (${result.reason})`);
          return end(res, 204, result.reason);
        }
        return json(res, 200, { hint: result.hint });
      } finally {
        res.off?.("close", onClose);
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
  const handler = createHintHandler({ ...deps, webServer: ctx.webServer, connection: ctx.connection });
  return ctx.webServer.register({ kind: "exact", path: ROUTE_PATH, handler });
}
