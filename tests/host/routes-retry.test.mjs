import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { createHintHandler } from "../../plugin/routes.mjs";

const ORIGIN = "http://127.0.0.1:1234";

function fakeRequest({ body = {}, headers = {}, remoteAddress = "127.0.0.1" } = {}) {
  const req = new EventEmitter();
  req.method = "POST";
  req.headers = headers;
  req.socket = { remoteAddress };
  req.destroy = () => {};
  setImmediate(() => {
    req.emit("data", Buffer.from(JSON.stringify(body)));
    req.emit("end");
  });
  return req;
}

class FakeResponse extends EventEmitter {
  status = 0;
  body = undefined;
  headersSent = false;
  writableEnded = false;
  writeHead(status) {
    this.status = status;
    this.headersSent = true;
  }
  end(payload) {
    this.body = payload;
    this.writableEnded = true;
  }
  destroy() {}
}

function fakeSession() {
  return {
    deriveMessages: () => [{ role: "user", content: [{ type: "text", text: "hello" }] }],
    requestContext: () => ({ provider: "p", model: "m" }),
    cwd: "/w",
  };
}

function linkedDeadline(signal) {
  const controller = new AbortController();
  const onAbort = () => controller.abort(signal?.reason);
  if (signal === undefined) {
    // no caller signal: a plain deadline
  } else if (signal.aborted) onAbort();
  else signal.addEventListener("abort", onAbort, { once: true });
  return {
    signal: controller.signal,
    [Symbol.dispose]() {
      signal?.removeEventListener("abort", onAbort);
    },
  };
}

function countingLlm() {
  const state = { calls: 0, systems: [] };
  return {
    state,
    llm: {
      prepareCall: async (config) => {
        state.calls += 1;
        return {
          config,
          stream: (options) => {
            state.systems.push(options.system);
            return (async function* () {
              yield { type: "noop" };
            })();
          },
        };
      },
    },
  };
}

function sequenceSeams(outputs) {
  let index = 0;
  return {
    createUserMessage: (input) => input,
    BlockAssembler: class {
      constructor() {
        const output = outputs.length === 0 ? {} : outputs[Math.min(index, outputs.length - 1)];
        index += 1;
        this.finish = output.finish ?? { kind: "stop" };
        this.text = output.text ?? "";
      }
      push() {}
      blocks() {
        return this.text === "" ? [] : [{ type: "text", text: this.text }];
      }
    },
    deadline: linkedDeadline,
  };
}

function harness({ llm = countingLlm().llm, sequence = [], warnings = [] } = {}) {
  const config = {
    enabled: true,
    maxTurns: 3,
    maxInputBytes: 8000,
    maxOutputTokens: 128,
    maxHintChars: 48,
    timeoutMs: 1000,
    perSessionCooldownMs: 0,
  };
  const handler = createHintHandler({
    config,
    sessions: { get: (id) => (id === "s1" ? fakeSession() : undefined) },
    webServer: { getOrigin: () => ORIGIN, port: 1234 },
    llm,
    llmSeams: sequenceSeams(sequence),
    logger: { warn: (message) => warnings.push(String(message)) },
  });
  return { handler, warnings };
}

async function call(handler) {
  const res = new FakeResponse();
  await handler(fakeRequest({ body: { sessionId: "s1" } }), res);
  return res;
}

test("a declined answer is retried once with a stricter instruction", async () => {
  const { llm, state } = countingLlm();
  const { handler } = harness({ llm, sequence: [{ text: "   " }, { text: "next step" }] });
  const res = await call(handler);
  assert.equal(res.status, 200);
  assert.deepEqual(JSON.parse(res.body), { hint: "next step" });
  assert.equal(state.calls, 2, "one retry, no more");
  assert.doesNotMatch(state.systems[0], /previous reply/u);
  assert.match(state.systems[1], /previous reply was not a usable suggestion/u);
});

test("a real failure is not retried", async () => {
  const { llm, state } = countingLlm();
  const { handler } = harness({ llm, sequence: [{ text: "x", finish: { kind: "tool-calls" } }, { text: "next step" }] });
  const res = await call(handler);
  assert.equal(res.status, 204);
  assert.equal(state.calls, 1);
});

test("a departed browser aborts its model call and frees the session", async () => {
  let observed;
  const llm = {
    prepareCall: async (config, signal) => {
      observed = signal;
      return {
        config,
        stream: () =>
          (async function* () {
            await new Promise((_, reject) => {
              const fail = () => reject(Object.assign(new Error("stop"), { name: "AbortError" }));
              if (signal.aborted) fail();
              else signal.addEventListener("abort", fail, { once: true });
            });
          })(),
      };
    },
  };
  const { handler } = harness({ llm });
  const res = new FakeResponse();
  const pending = handler(fakeRequest({ body: { sessionId: "s1" } }), res);
  await new Promise((resolve) => setTimeout(resolve, 10));
  res.emit("close");
  await pending;
  assert.equal(observed.aborted, true, "the deadline signal follows the disconnect");
  assert.equal(res.status, 204);
  assert.equal(res.body, undefined, "a departed browser gets no body");
});
