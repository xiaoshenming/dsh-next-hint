import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { ROUTE_PATH } from "../../src/contracts/hint.mjs";

const root = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));

const fakeReact = {
  createElement: () => null,
  useRef: () => ({ current: null }),
  useEffect: () => undefined,
};

async function loadBundle() {
  const captured = [];
  globalThis.window = { __ModuleLoader__: { load: (spec) => captured.push(spec) } };
  await import(pathToFileURL(path.join(root, "plugin/client.js")).href + "?bust=" + Math.random());
  assert.equal(captured.length, 1, "one module factory");
  const spec = captured[0];
  const mod = spec.factory((name) => {
    if (name === "react") return fakeReact;
    throw new Error("unexpected require: " + name);
  });
  return { spec, mod };
}

test("the bundle registers one factory with the expected id", async () => {
  const { spec, mod } = await loadBundle();
  assert.equal(spec.id, "dsh-next-hint");
  assert.deepEqual(mod.inject, ["slots", "sessions", "locale"]);
  assert.equal(typeof mod.apply, "function");
});

test("the bundle agrees with the frozen route path", async () => {
  const { mod } = await loadBundle();
  assert.equal(mod.__internals.ROUTE_PATH, ROUTE_PATH);
});

test("a turn settles on the true to false edge only", async () => {
  const { settled } = (await loadBundle()).mod.__internals;
  assert.equal(settled(true, false), true);
  assert.equal(settled(false, false), false);
  assert.equal(settled(undefined, false), false, "an unknown start is not a settlement");
  assert.equal(settled(false, true), false);
});

test("only an empty editable draft is worth a request", async () => {
  const { requestable } = (await loadBundle()).mod.__internals;
  assert.equal(requestable({ draft: "", phase: "plain" }), true);
  assert.equal(requestable({ draft: "   ", phase: "plain" }), true);
  assert.equal(requestable({ draft: "x", phase: "plain" }), false);
  assert.equal(requestable({ draft: "", phase: "submitting" }), false);
  assert.equal(requestable(undefined), false);
});

test("a painted hint survives benign draft revisions and dies on typing", async () => {
  const { stillValid } = (await loadBundle()).mod.__internals;
  const hint = { text: "a" };
  assert.equal(stillValid({ draft: "", phase: "plain", draftRev: 4 }, hint), true);
  assert.equal(stillValid({ draft: "", phase: "plain", draftRev: 9 }, hint), true, "a revision bump is not the user typing");
  assert.equal(stillValid({ draft: "t", phase: "plain", draftRev: 4 }, hint), false);
  assert.equal(stillValid({ draft: "", phase: "submitting", draftRev: 4 }, hint), false);
  assert.equal(stillValid({ draft: "", phase: "plain" }, null), false);
});

test("the composer is found from the slot anchor, not from the document", async () => {
  const { composerOf, menuOpen } = (await loadBundle()).mod.__internals;
  const grow = { name: "grow" };
  const rootEl = {
    querySelector: (selector) => (selector === "[data-input-scroll]" ? { firstElementChild: grow } : null),
  };
  const anchor = { closest: (selector) => (selector === "[data-composer-dock]" ? { parentElement: rootEl } : null) };
  assert.equal(composerOf(anchor).grow, grow);
  assert.equal(composerOf(null), null);
  assert.equal(composerOf({ closest: () => null }), null);

  const visible = { querySelector: () => ({ children: [{ getBoundingClientRect: () => ({ height: 20 }) }] }) };
  const empty = { querySelector: () => ({ children: [{ getBoundingClientRect: () => ({ height: 0 }) }] }) };
  assert.equal(menuOpen(visible), true);
  assert.equal(menuOpen(empty), false);
  assert.equal(menuOpen({ querySelector: () => null }), false);
});
