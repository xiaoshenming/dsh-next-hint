import test from "node:test";
import assert from "node:assert/strict";
import { parseHintRequest, ROUTE_PATH } from "../../src/contracts/hint.mjs";

test("route path is frozen", () => {
  assert.equal(ROUTE_PATH, "/api/next-hint");
});

test("accepts a session id and an optional locale", () => {
  assert.deepEqual(parseHintRequest({ sessionId: "abc" }), { ok: true, request: { sessionId: "abc" } });
  assert.deepEqual(parseHintRequest({ sessionId: "abc", locale: "zh" }), {
    ok: true,
    request: { sessionId: "abc", locale: "zh" },
  });
});

test("rejects everything else", () => {
  for (const body of [null, 42, "x", [], {}, { sessionId: "" }, { sessionId: 7 }, { sessionId: "a".repeat(201) }]) {
    assert.equal(parseHintRequest(body).ok, false, JSON.stringify(body));
  }
  assert.deepEqual(parseHintRequest({ sessionId: "abc", locale: "fr" }), { ok: false, reason: "locale-invalid" });
});
