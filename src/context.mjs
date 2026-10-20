/**
 * Turn the session's recent messages into one compact prompt payload.
 * Pure: no I/O, no model, no clock. Bounded by bytes and turns.
 * @module dsh-next-hint/context
 */

/** Separator between two labelled samples. */
const SAMPLE_SEPARATOR = "\n";

/**
 * @typedef {object} Sample
 * @property {"user" | "assistant" | "unknown"} role
 * @property {string} text
 */

/**
 * @typedef {object} ContextLimits
 * @property {number} maxTurns - how many user/assistant exchanges to keep.
 * @property {number} maxInputBytes - hard byte budget for the transcript.
 */

/**
 * Keep the tail of `text` within `maxBytes` without splitting a code point.
 * @param {string} text
 * @param {number} maxBytes
 * @returns {string}
 */
export function tailWithinBytes(text, maxBytes) {
  if (maxBytes <= 0) return "";
  const encoder = new TextEncoder();
  if (encoder.encode(text).length <= maxBytes) return text;
  const codePoints = Array.from(text);
  let total = 0;
  let start = codePoints.length;
  for (let index = codePoints.length - 1; index >= 0; index -= 1) {
    const size = encoder.encode(codePoints[index]).length;
    if (total + size > maxBytes) break;
    total += size;
    start = index;
  }
  return codePoints.slice(start).join("");
}

/**
 * Drop empty samples and keep the most recent `maxTurns` exchanges.
 * @param {Sample[]} samples
 * @param {number} maxTurns
 * @returns {Sample[]}
 */
export function recentSamples(samples, maxTurns) {
  const usable = samples.filter((sample) => sample.text.trim() !== "");
  const keep = Math.max(1, Math.trunc(maxTurns)) * 2;
  return usable.slice(-keep);
}

/**
 * Render the transcript the hint model reads.
 * @param {Sample[]} samples
 * @param {ContextLimits} limits
 * @returns {string}
 */
export function buildTranscript(samples, limits) {
  const body = recentSamples(samples, limits.maxTurns)
    .map((sample) => `[${sample.role}] ${sample.text.trim()}`)
    .join(SAMPLE_SEPARATOR);
  return tailWithinBytes(body, limits.maxInputBytes);
}
