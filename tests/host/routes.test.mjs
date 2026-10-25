import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { createHintHandler, resolveRoute, systemInstruction, toSamples } from "../../plugin/routes.mjs";

const ORIGIN = "http://127.0.0.1:1234";

function fakeRequest({ method = "POST", body = {}, headers = {}, remoteAddress = "127.0.0.1" } = {}) {
  const req = new EventEmitter();
  req.method = method;
  req.headers = headers;
  req.socket = { remoteAddress };
  req.destroy = () => {};
  setImmediate(() => {
    if (body !== undefined) req.emit("data", Buffer.from(typeof body === "string" ? body : JSON.stringify(body)));
    req.emit("end");
  });
  return req;
}

function fakeResponse() {
  const res = {
    status: 0,
    body: undefined,
    headersSent: false,
    writeHead(status) {
      res.status = status;
      res.headersSent = true;
    },
    end(payload) {
      res.body = payload;
    },
    destroy() {},
  };
  return res;
}

function fakeSession(messages = [{ role: "user", content: [{ type: "text", text: "hello" }] }]) {
  return {
    deriveMessages: () => messages,
    requestContext: () => ({ provider: "p", model: "m" }),
    cwd: "/w",
  };
}

function fakeLlm() {
  return {
    prepareCall: async (config) => ({
      config,
      stream: () =>
        (async function* () {
          yield { type: "noop" };
        })(),
    }),
  };
}

function fakeSeams({ text = "run the tests", finish = { kind: "stop" } } = {}) {
  return {
    createUserMessage: (input) => input,
    BlockAssembler: class {
      constructor() {
        this.finish = finish;
      }
      push() {}
      blocks() {
        return text === "" ? [] : [{ type: "text", text }];
      }
    },
    deadline: () => ({ signal: new AbortController().signal, [Symbol.dispose]() {} }),
  };
}

function harness({ config = {}, session = fakeSession(), llm, text, finish, connection, warnings = [] } = {}) {
  const sessions = { get: (id) => (id === "s1" ? session : undefined) };
  const webServer = { getOrigin: () => ORIGIN, port: 1234 };
  const logger = { warn: (message) => warnings.push(String(message)) };
  const resolved = {
    enabled: true,
    provider: undefined,
    model: undefined,
    maxTurns: 3,
    maxInputBytes: 8000,
    maxOutputTokens: 128,
    maxHintChars: 48,
    timeoutMs: 1000,
    perSessionCooldownMs: 0,
    ...config,
  };
  const seams = fakeSeams({ text, finish });
  const handler = createHintHandler({
    config: resolved,
    sessions,
    webServer,
    ...connection === undefined ? {} : { connection },
    llm: llm ?? fakeLlm(),
    llmSeams: seams,
    logger,
  });
  return { handler, warnings };
}

async function call(handler, options) {
  const req = fakeRequest(options);
  const res = fakeResponse();
  await handler(req, res);
  return res;
}

test("rejects anything but POST from loopback", async () => {
  const { handler } = harness();
  assert.equal((await call(handler, { method: "GET" })).status, 405);
  assert.equal((await call(handler, { remoteAddress: "10.0.0.7" })).status, 403);
  assert.equal((await call(handler, { headers: { origin: "http://evil.test" } })).status, 403);
  assert.equal((await call(handler, { headers: { "sec-fetch-site": "cross-site" } })).status, 403);
});

test("requires an authenticated owner when the host exposes admission", async () => {
  let seen;
  const owner = harness({
    connection: {
      admit: (req) => {
        seen = req;
        return { peer: { principal: { kind: "owner" } } };
      },
    },
  });
  assert.equal((await call(owner.handler, { body: { sessionId: "s1" } })).status, 200);
  assert.equal(seen.method, "POST");

  assert.equal((await call(harness({ connection: { admit: () => ({ rejection: 401 }) } }).handler)).status, 401);
  assert.equal((await call(harness({ connection: { admit: () => ({ rejection: 403 }) } }).handler)).status, 403);
  assert.equal((await call(harness({ connection: { admit: () => ({ peer: { principal: { kind: "user" } } }) } }).handler)).status, 403);
});

test("same-origin browser requests pass the origin check", async () => {
  const { handler } = harness();
  const res = await call(handler, { headers: { origin: ORIGIN }, body: { sessionId: "s1" } });
  assert.equal(res.status, 200);
  const localhost = await call(handler, { headers: { origin: "http://localhost:1234" }, body: { sessionId: "s1" } });
  assert.equal(localhost.status, 200, "localhost and 127.0.0.1 are the same seat");
  const wrongPort = await call(handler, { headers: { origin: "http://127.0.0.1:9999" }, body: { sessionId: "s1" } });
  assert.equal(wrongPort.status, 403);
});

test("isAllowedOrigin keeps foreign origins out", async () => {
  const { isAllowedOrigin } = await import("../../plugin/routes.mjs");
  assert.equal(isAllowedOrigin(undefined, 1234), true, "no header means no browser origin to distrust");
  assert.equal(isAllowedOrigin("http://evil.test", 1234), false);
  assert.equal(isAllowedOrigin("not a url", 1234), false);
  assert.equal(isAllowedOrigin("https://127.0.0.1:1234", 1234), true);
  assert.equal(isAllowedOrigin("http://127.0.0.1", 1234), false, "default port is a different seat");
});

test("rejects bad bodies and unknown sessions", async () => {
  const { handler } = harness();
  assert.equal((await call(handler, { body: "{not json" })).status, 400);
  assert.equal((await call(handler, { body: { sessionId: "" } })).status, 400);
  assert.equal((await call(handler, { body: { sessionId: "nope" } })).status, 404);
});

test("answers with the cleaned hint", async () => {
  const { handler } = harness();
  const res = await call(handler, { body: { sessionId: "s1" } });
  assert.equal(res.status, 200);
  assert.deepEqual(JSON.parse(res.body), { hint: "run the tests" });
});

test("a missing suggestion is silent, not an error", async () => {
  const warnings = [];
  const { handler } = harness({ text: "   ", warnings });
  const res = await call(handler, { body: { sessionId: "s1" } });
  assert.equal(res.status, 204);
  assert.equal(warnings.length, 1);
});

test("disabled configuration spends nothing", async () => {
  const warnings = [];
  let called = false;
  const llm = { prepareCall: async () => { called = true; } };
  const { handler } = harness({ config: { enabled: false }, llm, warnings });
  const res = await call(handler, { body: { sessionId: "s1" } });
  assert.equal(res.status, 204);
  assert.equal(called, false);
});

test("an empty transcript never reaches the model", async () => {
  let called = false;
  const llm = { prepareCall: async () => { called = true; } };
  const session = { deriveMessages: () => [{ role: "user", content: [{ type: "text", text: "   " }] }] };
  const { handler } = harness({ llm, session });
  assert.equal((await call(handler, { body: { sessionId: "s1" } })).status, 204);
  assert.equal(called, false);
});

test("route follows the configured pair, then the session's last route", () => {
  const session = fakeSession();
  assert.deepEqual(resolveRoute(session, {}), { provider: "p", model: "m" });
  assert.deepEqual(resolveRoute(session, { provider: "x", model: "y" }), { provider: "x", model: "y" });
  assert.deepEqual(resolveRoute(undefined, {}), {});
});

test("messages flatten to text samples", () => {
  assert.deepEqual(
    toSamples([
      { role: "user", content: [{ type: "text", text: "hi" }, { type: "tool-call" }] },
      { source: { kind: "user" }, content: "plain" },
      { role: "assistant", content: [{ type: "text", text: "there" }] },
      { role: "tool" },
    ]),
    [
      { role: "user", text: "hi" },
      { role: "user", text: "plain" },
      { role: "assistant", text: "there" },
      { role: "unknown", text: "" },
    ],
  );
});

test("system instruction names the language and the budget", () => {
  assert.match(systemInstruction("zh", "", 40), /Simplified Chinese/u);
  assert.match(systemInstruction("en", "/w", 40), /English/u);
  assert.match(systemInstruction(undefined, "", 40), /language of the conversation/u);
  assert.match(systemInstruction(undefined, "/w", 40), /workspace is \/w/u);
});
