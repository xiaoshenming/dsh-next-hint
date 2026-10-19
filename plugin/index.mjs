/**
 * Host half of dsh-next-hint — walking skeleton.
 *
 * Contract: docs/IMPLEMENTATION-CONTRACT.md.
 * Wiring is gated by docs/OPEN-QUESTIONS.md (H1 turn settlement, H2 auxiliary
 * request, H3 route). Do not invent service names before those spikes close.
 *
 * The host plugin shape is the one every official package uses:
 *   export { name, inject, Config, apply }
 */
export const name = "next-hint";

/** Services this half needs. Empty until H1/H2/H3 are measured. */
export const inject = [];

export function apply(_ctx, _config) {
  // Phase 2 (lane: host) mounts here:
  //   turn settlement -> src/trigger.mjs -> src/context.mjs -> src/generate.mjs
  //   -> src/store.mjs -> plugin/routes.mjs (/api/next-hint)
}
