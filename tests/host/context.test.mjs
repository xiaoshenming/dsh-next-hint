import test from "node:test";
import assert from "node:assert/strict";
import { buildTranscript, recentSamples, tailWithinBytes } from "../../src/context.mjs";

const limits = { maxTurns: 1, maxInputBytes: 10_000 };

test("keeps the tail of a transcript", () => {
  const samples = [
    { role: "user", text: "one" },
    { role: "assistant", text: "two" },
    { role: "user", text: "three" },
    { role: "assistant", text: "four" },
    { role: "user", text: "five" },
  ];
  assert.equal(buildTranscript(samples, limits), "[assistant] four\n[user] five");
});

test("drops empty samples before counting turns", () => {
  const samples = [
    { role: "user", text: "   " },
    { role: "assistant", text: "kept" },
  ];
  assert.deepEqual(recentSamples(samples, 1), [{ role: "assistant", text: "kept" }]);
});

test("byte budget keeps the newest text", () => {
  assert.equal(tailWithinBytes("abcdef", 3), "def");
  assert.equal(tailWithinBytes("abcdef", 100), "abcdef");
  assert.equal(tailWithinBytes("abcdef", 0), "");
});

test("byte budget never splits a code point", () => {
  const text = "好".repeat(10);
  const kept = tailWithinBytes(text, 7);
  assert.equal(kept, "好好", "each CJK code point is three bytes");
});

test("transcript respects maxInputBytes", () => {
  const samples = Array.from({ length: 6 }, (_, index) => ({ role: "user", text: "x".repeat(100) }));
  assert.ok(buildTranscript(samples, { maxTurns: 9, maxInputBytes: 50 }).length <= 50);
});
