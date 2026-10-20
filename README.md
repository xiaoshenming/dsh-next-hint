# dsh-next-hint

> When a turn ends, the composer suggests the next message by itself.
> **Tab accepts, nothing is ever sent.**

A [DeepSeek Harness](https://www.deepseek.com/harness/) plugin that brings
Claude Code–style prompt suggestions to DSH — as **ghost text** inside your own
composer: visible, undoable, and never on the return key.

```text
┌────────────────────────────────────────────────────────────┐
│ fix the two failing cases as well              Tab accept   │  ← ghost, appears on settle
└────────────────────────────────────────────────────────────┘
                     ↑ only while the draft is empty; typing dismisses it
```

## Why install it

- **It knows what you were doing.** One **decoupled auxiliary request** reads the
  last few turns of *this* session — the file you touched, the test that went red,
  where the work stopped — instead of a template like "continue?".
- **It never touches your Enter key.** Accepting inserts ordinary text into the
  draft. `Ctrl+Z` undoes it; sending stays your decision. There is no send path in
  the code at all.
- **It stays quiet.** No route, timeout, rate limit, malformed output, or a plain
  "not today" all end as **no ghost** and no error surface — at most one warn in
  the log.
- **It does not ship your conversation anywhere.** The browser posts a
  `sessionId`; the host reads the transcript inside its own process, writes it
  nowhere, logs no text, and keeps it on this machine.

## Install

**DSH Desktop**: Settings → Plugins → add a git package

```text
github:xiaoshenming/dsh-next-hint#main
```

CLI equivalent:

```bash
dsh plugin --profile desktop add "github:xiaoshenming/dsh-next-hint#main"
```

Restart the app once — plugins join the roster at boot. Update the same way:

```bash
cd ~/.dsh/profiles/desktop && pnpm update dsh-next-hint
```

## What you get

| Moment | What happens |
| --- | --- |
| A turn settles, draft is empty | One grey line at the composer's first line, `Tab accept` on the right |
| `Tab` with focus in the composer | The sentence lands in the draft, caret at its end, **not sent** |
| You start typing | The ghost disappears |
| You switch sessions | The ghost is dropped |
| No route / timeout / nothing to say | Nothing at all — the correct outcome |

Tab only fires when no candidate menu owns it: with the `/` or `@` menu open,
Tab still belongs to the menu.

## Configuration

Settings → Plugins → dsh-next-hint. Every key has a default; nothing is required.

| Key | Default | Meaning |
| --- | --- | --- |
| `enabled` | `true` | Master switch |
| `provider` / `model` | empty | Empty follows the session's last route; set both or neither |
| `locale` | `auto` | Language of the suggestion |
| `maxTurns` | `3` | Exchanges sampled |
| `maxInputBytes` | `8000` | Input budget for the auxiliary request |
| `maxOutputTokens` | `128` | Output token cap |
| `maxHintChars` | `48` | Hint length cap; a paragraph is dropped, a long sentence truncated |
| `timeoutMs` | `15000` | Per-call timeout |
| `perSessionCooldownMs` | `0` | Per-session cooldown; default suggests every turn |

## How it works

A dual-face cordis plugin, the same shape as
[dsh-session-surgeon](https://github.com/xiaoshenming/dsh-session-surgeon):

```text
browser   session.running true → false, draft empty
            └─ POST /api/next-hint  { sessionId }        ← id only, no transcript
host      loopback + origin check → single flight + cooldown
            └─ ctx.sessions.get(id).deriveMessages()      ← recent turns
            └─ ctx.llm.prepareCall(...)                   ← one decoupled call, cheapest effort
            └─ 200 { hint } / 204 (silent, with x-next-hint-reason)
browser  paint the ghost on line one → Tab → input.actions.captureInsertion() + insertText()
```

Deliberate choices:

- **Decide in the browser, generate in the host.** Only the browser knows whether
  the draft is empty, whether you are typing, and which session is on screen;
  asking the host to guess gets it wrong twice.
- **One request/response.** No SSE, no long-lived connections, no server-side
  cache. Cancelling is `AbortController.abort()`.
- **Official slot, own pixels.** The component mounts in
  `conversation.composer.dock`; the ghost node is ours because the host exposes
  no inline-hint write path. Unmounting removes the node, the listeners, and the
  in-flight request.
- **The auxiliary call follows the session-title recipe**: its own system
  instruction, its own timeout, the cheapest reasoning level, and a failure that
  cannot touch the main conversation.

## Related work

The community already has a plugin built on the same idea:
[Composer predictions (`dsh-composer-prediction`)](https://github.com/deepseek-ai/deepseek-harness/discussions/10053).
Both turn "a turn settled" into one auxiliary request and a ghost line; the seams differ
(they mount the overlay slot and ship their own settings page, this one uses the official
dock slot and a stateless host POST). **Do not install both** — you would get two
overlapping ghosts and two auxiliary calls per turn.

## Compatibility

- Measured on **DSH Desktop `0.2.1-rc.2` (Windows)**. The host half needs
  `ctx.llm`, `ctx.sessions`, and `ctx.webServer.register`; the browser half needs
  the `conversation.composer.dock` slot and the composer input facade.
- Still `0.x`: if upstream moves those seams, the ghost breaks first. Its position
  relies on the editor's `[data-input-scroll]` structure; a missing anchor means
  no ghost, silently.
- Requests from outside loopback are refused by the route.
- If DSH ships this natively, this plugin can be disabled cleanly — nothing here
  assumes it is the only writer of the composer.

## Development

```bash
node --test      # 45 tests, node:test only, zero runtime dependencies
```

Pure logic lives in `src/` (no cordis, no official packages, no DOM); seams live
in `plugin/`. Design decisions and the evidence behind them are in
[docs/](docs/README.md), from the line-by-line sources in
[RESEARCH.md](docs/RESEARCH.md) to the data flow and failure modes in
[ARCHITECTURE.md](docs/ARCHITECTURE.md).

## License

MIT
