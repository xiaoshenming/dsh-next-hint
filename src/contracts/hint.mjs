/**
 * Frozen contract between the browser half and the host half (AD-0004).
 * Pure data in, pure data out — no I/O, no cordis, no DOM.
 * @module dsh-next-hint/contracts/hint
 */

/** Exact route the browser half POSTs to. */
export const ROUTE_PATH = "/api/next-hint";

/** Request bodies larger than this are rejected without parsing. */
export const MAX_BODY_BYTES = 4096;

/** Longest accepted session id. Real ids are far shorter. */
const MAX_SESSION_ID_CHARS = 200;

/**
 * @typedef {object} HintRequest
 * @property {string} sessionId - session the suggestion is for.
 * @property {"zh" | "en" | undefined} [locale] - answer language; undefined follows the session.
 */

/**
 * @typedef {object} HintResult
 * @property {true} ok
 * @property {string} hint - one line, already cleaned and length-capped.
 */

/**
 * Validate an untrusted request body.
 * @param {unknown} value - parsed JSON body.
 * @returns {{ ok: true, request: HintRequest } | { ok: false, reason: string }}
 */
export function parseHintRequest(value) {
  if (value === null || typeof value !== "object") return { ok: false, reason: "body-not-object" };
  const body = /** @type {Record<string, unknown>} */ (value);
  const { sessionId, locale } = body;
  if (typeof sessionId !== "string" || sessionId.length === 0 || sessionId.length > MAX_SESSION_ID_CHARS) {
    return { ok: false, reason: "session-id-invalid" };
  }
  if (locale !== undefined && locale !== "zh" && locale !== "en") return { ok: false, reason: "locale-invalid" };
  return { ok: true, request: { sessionId, ...(locale === undefined ? {} : { locale }) } };
}
