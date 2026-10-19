import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));

test("manifest declares a dual-face dsh plugin", () => {
  assert.equal(pkg.type, "module");
  assert.equal(pkg.exports["."], "./plugin/index.mjs");
  assert.equal(pkg.exports["./client"], "./plugin/client.js");
  assert.equal(pkg.dsh.bundle.patch, "./cordis.patch.yml");
  assert.equal(pkg.dsh.client.platform, "web");
  assert.ok(Array.isArray(pkg.dsh.client.inject), "client.inject must be an array");
  assert.ok(typeof pkg.dsh.engines.dsh === "string", "minimum dsh version is declared");
});

test("every path the manifest points at exists", () => {
  const paths = [
    pkg.exports["."],
    pkg.exports["./client"],
    pkg.dsh.bundle.patch,
    "README.md",
    "README.zh.md",
    "CHANGELOG.md",
    "LICENSE",
  ];
  for (const rel of paths) assert.ok(existsSync(path.join(root, rel)), rel + " is missing");
});

test("bundle patch inserts the plugin exactly once", () => {
  const patch = readFileSync(path.join(root, pkg.dsh.bundle.patch), "utf8");
  assert.equal(patch.match(/- id: next-hint\b/g)?.length ?? 0, 1);
  assert.equal(patch.match(/- id: (\w+)/g)?.length ?? 0, 1);
  assert.match(patch, /name: dsh-next-hint/);
});

test("host half keeps the host plugin shape", async () => {
  const host = await import(pathToFileURL(path.join(root, pkg.exports["."])).href);
  assert.equal(host.name, "next-hint");
  assert.ok(Array.isArray(host.inject));
  assert.equal(typeof host.apply, "function");
});

test("browser half registers one module factory", () => {
  const client = readFileSync(path.join(root, pkg.exports["./client"]), "utf8");
  assert.match(client, /window\.__ModuleLoader__\.load\(/);
  assert.match(client, /id: "dsh-next-hint"/);
  assert.match(client, /exports\.inject = /);
  assert.match(client, /exports\.apply = /);
});

test("documentation set is present", () => {
  for (const rel of [
    "docs/PLAN.md",
    "docs/RESEARCH.md",
    "docs/ARCHITECTURE.md",
    "docs/IMPLEMENTATION-CONTRACT.md",
    "docs/TASKS.md",
    "docs/OPEN-QUESTIONS.md",
    "docs/TESTING.md",
    "docs/RELEASE.md",
    "docs/adr/0001-dual-face-plugin.md",
    "docs/adr/0002-auxiliary-llm-request.md",
    "docs/adr/0003-ui-placement.md",
    "skills/dsh-next-hint-update/SKILL.md",
  ]) assert.ok(existsSync(path.join(root, rel)), rel + " is missing");
});
