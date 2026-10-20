# Changelog

All notable changes to this project are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning: SemVer.

### Documented

- Prior art: `dsh-composer-prediction` (2026-10-17) solves the same problem with a different
  seam set. RESEARCH `3.1 records the comparison, and both READMEs warn that installing both
  paints two overlapping ghosts.

## [0.1.0] - 2026-10

First open-source release: the feature works end to end on DSH Desktop `0.2.1-rc.2`.

### Fixed

- Hints no longer vanish on a benign draft-revision bump: a ghost lives while the draft stays empty, and acceptance re-captures the insertion span.
- Trigger is per turn instead of per running-edge, so a missed status transition no longer strands the feature; mounting a session no longer spends a request.
- Auxiliary calls ask the adapter for its cheapest reasoning level and default to a 15 s timeout — the max-effort default route was outlasting the old 8 s budget.
- The instruction's null answer (`NONE`) is dropped instead of being offered as a suggestion.
- 204 replies name their reason in `x-next-hint-reason`, and the browser half logs every decision as `[next-hint] …` with `data-next-hint-state` on its anchor.

### Added

- Host half: `POST /api/next-hint` (`plugin/routes.mjs`) with loopback/origin checks, per-session gate, bounded context sampling and one decoupled auxiliary model call.
- Browser half: inline ghost in the composer (first line, over the placeholder), `Tab` to accept through `input.actions.captureInsertion/insertText`, abort on typing or session change.
- Pure modules: `src/contracts/hint.mjs`, `src/trigger.mjs`, `src/context.mjs`, `src/generate.mjs`.
- `Config` (schemastery): enable switch, route override, turn/byte/token/char/timeout/cooldown budgets, locale.
- Tests: contracts, gate, context, generation, route handler with fakes, and the browser bundle's pure helpers.
- Dual-face plugin skeleton: `plugin/index.mjs` (host) and `plugin/client.js` (browser).
- `cordis.patch.yml` bundle patch inserting the `next-hint` entry.
- Documentation set: plan, research, architecture, implementation contract, tasks, open questions, testing, release, ADR 0001-0003.
- `skills/dsh-next-hint-update` self-iteration skill.
- Smoke test over the manifest, the bundle patch and both halves.

## [0.0.0] - 2026-10

### Added

- Repository scaffold. No feature code yet.
