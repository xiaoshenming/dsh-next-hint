# Changelog

All notable changes to this project are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning: SemVer.

## [0.1.5] - 2026-10-25

### Fixed

- `POST /api/next-hint` now requires an authenticated owner: the host asks
  `ctx.connection.admit(req)` and checks `peer.principal.kind === "owner"` before
  reading a session or spending tokens. Loopback and origin stay as defense in
  depth, but they are no longer the only fence (adopted from
  `dsh-composer-predictions` 1.2.2).
- A refused insertion now hides the ghost instead of leaving a stale offer that
  can no longer be accepted.

### Documented

- Four same-kind plugins are now live (this one, `dsh-composer-prediction`,
  `dsh-composer-predictions`, `dsh-reply-suggestions`). RESEARCH 3.3 records the
  comparison and a prioritized backlog: Esc, session-switch restore, settings
  page, npm publishing, candidate cycling, usage stats, single-source draft.
- DSH `0.2.1-rc.3` released: a source scan of its composer package still finds
  every seam this plugin uses; a real rc.3 run is still pending.

## [0.1.4] - 2026-10-23

### Fixed

- Starting an IME composition now dismisses a painted ghost and aborts its
  in-flight request instead of waiting for the next draft publication; Tab during
  composition stays with the IME (`isComposing` / keyCode 229). The gap was
  diagnosed by the `dsh-input-assist` author: a ghost painted from an async
  result can outlive the state that justified it until the next flush.

### Documented

- `dsh-composer-prediction@0.7.8` moved its shared `data-composer-ghost` marker
  from the always-mounted anchor to the painted node (the per-offer rule we
  adopted in 0.1.3); `dsh-input-assist@0.8.0` now targets DSH 0.2.1-rc.2 with
  124 tests and one runtime dependency.
- Update instructions corrected: the desktop plugin page's update check only compares
  npm-registry sources, so a `github:` install always reads as "latest"; documented
  `pnpm update dsh-next-hint` and uninstall/re-add instead.

## [0.1.3] - 2026-10-22

### Changed

- The painted ghost now carries the shared `data-composer-ghost` attribute, so other
  ghost-text plugins can defer to it dynamically instead of depending on this plugin's
  namespaced markers. The always-mounted `data-next-hint-anchor` is not a "ghost is
  visible" signal; the shared attribute is only on the painted node.

### Documented

- `dsh-composer-prediction@0.7.7` now gates on IME and stands down when this plugin is
  present (boot-manifest id or `data-next-hint*` markers). Updated the related-work
  comparison; the hard double-ghost conflict is gone on their side, while versions up
  to 0.7.6 still double-paint.

## [0.1.2] - 2026-10-21

### Fixed

- The ghost no longer paints during an IME composition: the request gate and the
  painted-hint validity check now read the editor's `data-composer-composing`
  marker, so the settle window cannot paint into an active composition (guard
  suggested by the `dsh-composer-prediction` author).

### Documented

- Corrected the related-work comparison after the prior-art author's reply: both
  plugins decide in the browser and both prediction routes are stateless; the
  differences are the mount slot, the settings page, the per-session cache and Esc.

## [0.1.1] - 2026-10-20

### Fixed

- Hints no longer vanish after a short or social turn: the instruction stopped
  offering a `NONE` escape hatch, and a declined answer is re-asked once with a
  stricter instruction. Measured on DSH Desktop 0.2.1-rc.2: 2 of 4 turns produced
  a hint before the change, 4 of 4 after.
- A usable first line survives a `max-tokens` cut instead of being dropped with
  the whole answer.
- A browser that leaves mid-call now aborts the auxiliary request and frees the
  per-session gate, so the next turn can no longer be refused as `gated`.

### Documented

- Prior art re-checked on 2026-10-20: `dsh-composer-prediction@0.7.6` adds per-turn dedupe,
  session-switch restore and Esc dismiss with the same seam family; `dsh-input-assist@0.7.1`
  is complementary (typing completion), not a competitor. RESEARCH `3.1/3.2 records both
  comparisons, and READMEs warn which pair must not be installed together.
- Install docs corrected: the desktop profile is owned by the app, so the CLI example now
  targets a self-managed profile (`web`) instead of the refused `--profile desktop`.

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
