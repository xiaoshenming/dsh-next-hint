import test from "node:test";
import assert from "node:assert/strict";
import { createLedger, evaluateGate } from "../../src/trigger.mjs";

const open = { enabled: true, inFlight: false, lastAt: undefined, now: 1000, cooldownMs: 0 };

test("open gate passes", () => {
  assert.deepEqual(evaluateGate(open), { ok: true });
});

test("every closed reason is distinguishable", () => {
  assert.deepEqual(evaluateGate({ ...open, enabled: false }), { ok: false, reason: "disabled" });
  assert.deepEqual(evaluateGate({ ...open, inFlight: true }), { ok: false, reason: "busy" });
  assert.deepEqual(evaluateGate({ ...open, lastAt: 900, cooldownMs: 500 }), { ok: false, reason: "cooldown" });
});

test("cooldown expires exactly at the boundary", () => {
  assert.deepEqual(evaluateGate({ ...open, lastAt: 500, cooldownMs: 500 }), { ok: true });
});

test("ledger allows one request per session at a time", () => {
  const ledger = createLedger();
  assert.equal(ledger.begin("s1", 1000, 0, true), true);
  assert.equal(ledger.begin("s1", 1000, 0, true), false, "second concurrent request is refused");
  assert.equal(ledger.begin("s2", 1000, 0, true), true, "other sessions are independent");
  ledger.end("s1", 1200);
  assert.equal(ledger.begin("s1", 1300, 500, true), false, "cooldown measured from the end");
  assert.equal(ledger.begin("s1", 1700, 500, true), true);
});

test("disabled ledger never admits", () => {
  const ledger = createLedger();
  assert.equal(ledger.begin("s1", 1000, 0, false), false);
});
