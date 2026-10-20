import test from "node:test";
import assert from "node:assert/strict";
import { cleanHint, requestHint } from "../../src/generate.mjs";

const ok = { ok: true };

test("cleanHint takes one plain line", () => {
  assert.equal(cleanHint("Run the tests first.\nThen commit.", 80), "Run the tests first.");
  assert.equal(cleanHint("- **Add a test for this.**", 80), "Add a test for this.");
  assert.equal(cleanHint('  "  ship it  "  ', 80), "ship it");
  assert.equal(cleanHint("\n\n", 80), "");
  assert.equal(cleanHint("NONE", 80), "", "the instruction's null answer is not a hint");
  assert.equal(cleanHint("none.", 80), "none.", "punctuation makes it a real sentence");
});

test("cleanHint truncates to the code-point budget", () => {
  assert.equal(cleanHint("abcdefghij", 4), "abcd");
  assert.equal(Array.from(cleanHint("继续检查一下这个文件", 3)).length, 3);
});

test("cleanHint discards a runaway answer", () => {
  assert.equal(cleanHint("x".repeat(500), 10), "");
  assert.equal(cleanHint("x".repeat(30), 10), "x".repeat(10), "a merely long hint is truncated, not dropped");
});

function fakes({ chunks = [], finish = { kind: "stop" }, blocks = [{ type: "text", text: "do it" }], fail, model = { reason: "test" } } = {}) {
  const calls = [];
  const configured = [];
  return {
    calls,
    configured,
    deps: {
      prepareCall: async (config, _signal, configure) => {
        calls.push(config);
        if (configure !== undefined) configured.push(configure({ kept: true }, model));
        if (fail !== undefined) throw fail;
        return {
          config: { ...config, provider: "p", model: "m" },
          stream: (options) => {
            calls.push(options);
            return (async function* () {
              for (const chunk of chunks) yield chunk;
            })();
          },
        };
      },
      createUserMessage: (input) => input,
      BlockAssembler: class {
        constructor() {
          this.finish = finish;
        }
        push() {}
        blocks() {
          return blocks;
        }
      },
      deadline: () => ({ signal: new AbortController().signal, [Symbol.dispose]() {} }),
    },
  };
}

const base = {
  route: { provider: "p", model: "m" },
  system: "sys",
  transcript: "hello",
  sessionId: "s1",
  timeoutMs: 1000,
  maxOutputTokens: 128,
  maxHintChars: 80,
};

test("requestHint returns the cleaned hint", async () => {
  const { deps, calls } = fakes();
  assert.deepEqual(await requestHint(deps, base), { ok: true, hint: "do it" });
  assert.equal(calls[0].maxTokens, 128, "output tokens are capped");
  assert.equal(calls[1].purpose, "next-hint");
  assert.equal(calls[1].system, "sys");
});

test("requestHint asks for the cheapest reasoning level", async () => {
  const withEfforts = fakes({ model: { reasoning: { efforts: [{ id: "minimal" }, { id: "max" }] } } });
  await requestHint(withEfforts.deps, base);
  assert.deepEqual(withEfforts.configured[0], { kept: true, reasoningEffort: "minimal" });

  const noEfforts = fakes({ model: {} });
  await requestHint(noEfforts.deps, base);
  assert.deepEqual(noEfforts.configured[0], { kept: true }, "a model without effort levels is left alone");
});

test("requestHint refuses a non-stop finish", async () => {
  const { deps } = fakes({ finish: { kind: "max-tokens" } });
  assert.deepEqual(await requestHint(deps, base), { ok: false, reason: "finish-max-tokens" });
});

test("requestHint refuses empty output", async () => {
  const { deps } = fakes({ blocks: [{ type: "text", text: "  " }] });
  assert.deepEqual(await requestHint(deps, base), { ok: false, reason: "empty" });
});

test("requestHint classifies failures instead of throwing", async () => {
  const coded = Object.assign(new Error("rate limited"), { code: "RATE_LIMITED" });
  assert.deepEqual(await requestHint(fakes({ fail: coded }).deps, base), { ok: false, reason: "RATE_LIMITED" });
  const aborted = Object.assign(new Error("stop"), { name: "AbortError" });
  assert.deepEqual(await requestHint(fakes({ fail: aborted }).deps, base), { ok: false, reason: "aborted" });
  assert.deepEqual(await requestHint(fakes({ fail: new Error("boom") }).deps, base), { ok: false, reason: "error" });
});
