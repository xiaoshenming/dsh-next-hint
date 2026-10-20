/**
 * Host-side gate: should this request cost a model call at all?
 * Pure on purpose — the caller owns the clock and the counters.
 * @module dsh-next-hint/trigger
 */

/**
 * @typedef {object} GateInput
 * @property {boolean} enabled - plugin switch.
 * @property {boolean} inFlight - another request for this session is running.
 * @property {number | undefined} lastAt - timestamp of the last completed request.
 * @property {number} now - current timestamp.
 * @property {number} cooldownMs - minimum gap between requests for one session.
 */

/**
 * Decide whether one request may run.
 * @param {GateInput} input
 * @returns {{ ok: true } | { ok: false, reason: "disabled" | "busy" | "cooldown" }}
 */
export function evaluateGate({ enabled, inFlight, lastAt, now, cooldownMs }) {
  if (!enabled) return { ok: false, reason: "disabled" };
  if (inFlight) return { ok: false, reason: "busy" };
  if (lastAt !== undefined && Number.isFinite(lastAt) && now - lastAt < cooldownMs) {
    return { ok: false, reason: "cooldown" };
  }
  return { ok: true };
}

/**
 * Per-session bookkeeping for the gate.
 * @returns {{ begin: (sessionId: string, now: number, cooldownMs: number, enabled: boolean) => boolean, end: (sessionId: string, now: number) => void }}
 */
export function createLedger() {
  /** @type {Map<string, { lastAt: number | undefined, inFlight: boolean }>} */
  const rows = new Map();
  const rowOf = (sessionId) => {
    const existing = rows.get(sessionId);
    if (existing !== undefined) return existing;
    const created = { lastAt: undefined, inFlight: false };
    rows.set(sessionId, created);
    return created;
  };
  return {
    begin(sessionId, now, cooldownMs, enabled) {
      const row = rowOf(sessionId);
      const verdict = evaluateGate({ enabled, inFlight: row.inFlight, lastAt: row.lastAt, now, cooldownMs });
      if (!verdict.ok) return false;
      row.inFlight = true;
      return true;
    },
    end(sessionId, now) {
      const row = rowOf(sessionId);
      row.inFlight = false;
      row.lastAt = now;
    },
  };
}
