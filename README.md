# dsh-next-hint

> **Status: pre-alpha scaffold.** This repository currently ships the plugin
> skeleton, the engineering contracts, and the research notes — not the feature.
> Every design decision below is tracked in [docs/](docs/README.md).

A [DeepSeek Harness](https://www.deepseek.com/harness/) plugin that proposes the
next prompt in the composer after a turn settles — the DSH counterpart of Claude
Code's prompt suggestions. Accepting a suggestion writes it into the draft as an
ordinary, undoable edit; nothing is ever sent without a human action.

## Why this exists

DSH 0.2.1-rc.2 ships no such feature, and the community market (142 plugins at
2026-10) has no plugin that does it either. The seams are open, though: the
composer exposes a scoped input facade with `insertText`/`insertReference`,
the host exposes `ctx.llm` for auxiliary requests, and a plugin can serve its
own HTTP route. See [docs/RESEARCH.md](docs/RESEARCH.md) for the verified
evidence, including exact APIs and the packages that prove each one.

## Shape

A **dual-face cordis plugin**, the same shape as
[`dsh-session-surgeon`](https://github.com/xiaoshenming/dsh-session-surgeon):

```text
package.json          dsh.bundle.patch + dsh.client{platform,inject}
cordis.patch.yml      inserts the entry into a profile roster
plugin/index.mjs      host half   — turn settlement, auxiliary LLM request, route
plugin/client.js      browser half — suggestion strip, accept into the composer
src/                  pure logic, no cordis, unit-tested with node:test
docs/                 plan, research, architecture, contract, tasks, ADR, release
skills/               the in-repo "更新" skill for self-iteration
```

## Develop

```sh
node --test                 # no dependencies to install; node:test only
```

On this machine the runtime for that command is the bundled one:

```
C:\Users\123\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe
```

## Documentation

| Document | Purpose |
| --- | --- |
| [PLAN.md](docs/PLAN.md) | what we build, what we refuse to build, milestones |
| [RESEARCH.md](docs/RESEARCH.md) | verified seams, market scan, prior art, sources |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | halves, data flow, failure modes, config |
| [IMPLEMENTATION-CONTRACT.md](docs/IMPLEMENTATION-CONTRACT.md) | hard constraints and file ownership for parallel agents |
| [TASKS.md](docs/TASKS.md) | phased work breakdown with parallel lanes |
| [OPEN-QUESTIONS.md](docs/OPEN-QUESTIONS.md) | the spikes that must close before phase 2 |
| [TESTING.md](docs/TESTING.md) | unit, fake host, manual matrix, CI |
| [RELEASE.md](docs/RELEASE.md) | versioning, publishing, desktop install/update |
| [adr/](docs/adr/) | accepted decision records |

## License

MIT
