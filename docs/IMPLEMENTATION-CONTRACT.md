# 实现合同（多智能体共享）

> 本文件是**并行开发的唯一冲突裁判**。开工前读一遍，提交前对照一遍。
> 依据：本机 `dsh-session-surgeon` 的实践 + `dsh-ecosystem-spec` 的解耦纪律 + 官方包的实测导出形状。

## 1. 硬约束（不可协商）

1. **ESM only**，`"type": "module"`，Node `^22.19.0 || >=24`。
2. **零 runtime dependencies**。`@deepseek-ai/*` 只能出现在 `peerDependencies`（默认 optional），**禁止进 `dependencies`**。
3. 单文件 **≤ 300 行**；超过 200 行先想清楚是不是承担了两个职责。
4. 纯逻辑（`src/`）**不 import cordis、不 import 官方包、不碰 DOM**；接缝全部在 `plugin/`。
5. 测试只用 **`node:test` + `node:assert/strict`**，禁止引入 vitest / jest / mocha。
6. **不改官方源码、不 patch `.asar`**；只用公开 seam（槽位、服务、路由、DOM 注入）。
7. 所有对外可见字符串走 i18n（zh / en 各一份），代码里不出现裸中文。
8. 写文件用 `write` / `edit` 工具，不用 shell 重定向。
9. **只写自己名下的文件**（见 `3）。要动别人的文件，先在 PR/issue 里说，由主控改。
10. 任何「我猜它能用」的结论不许进代码 —— 先关掉 [OPEN-QUESTIONS.md](OPEN-QUESTIONS.md) 里对应的一条。

## 2. 分支与 worktree

```sh
# 一条泳道 = 一个 worktree = 一个分支
git worktree add ../dsh-next-hint-wt/host   -b feat/host
git worktree add ../dsh-next-hint-wt/client -b feat/client
```

- 分支名：`feat/<lane>`、`fix/<lane>`、`docs/<lane>`。
- 禁止在 `main` 上直接提交功能代码；`main` 只接受 squash merge。
- 提交信息：Conventional Commits（`feat(host): …`、`fix(client): …`、`docs: …`）。
- 合并前必须：`git rebase main` + 全量 `node --test` 绿。

## 3. 文件所有权

| 路径 | owner 泳道 | 说明 |
| --- | --- | --- |
| `package.json`、`cordis.patch.yml` | **main**（主控独占） | 任何改动都要主控点头 |
| `plugin/index.mjs`、`plugin/routes.mjs` | **host** | 宿主半边入口与 `POST /api/next-hint` |
| `src/trigger.mjs`、`src/context.mjs`、`src/generate.mjs` | **host** | 纯函数（`generate.mjs` 的官方依赖全部注入） |
| `plugin/client.js` | **client** | 浏览器半边：结算判定 + 行内 ghost + 采纳 + 清理 |
| `src/contracts/` | **main**（主控独占） | 跨泳道接口冻结后不许单方面改 |
| `tests/host/`、`tests/client/`、`tests/contracts/` | 同名泳道 | 谁写谁测 |
| `tests/smoke.test.mjs` | **main** | 脚手架体检 |
| `docs/`、`README*.md`、`CHANGELOG.md` | **docs** 泳道 | 功能泳道只允许改自己那节的「实现说明」 |
| `skills/` | **main** | 更新技能 |
| `.github/` | **main** | CI |

## 4. 跨泳道接口（冻结后才许并行）

`src/contracts/` 里只有类型与纯函数签名，没有实现：

| 契约 | 内容 | 冻结时间 |
| --- | --- | --- |
| `HintRequest` | `{ sessionId, locale }` —— 浏览器 → 宿主，**不含会话原文** | M1 结束 |
| `HintResult` | `{ hint }` / `204` / `4xx`（见 [ARCHITECTURE.md](ARCHITECTURE.md) `2） | M1 结束 |
| `HintPolicy` | `shouldRequest(state, session) → boolean`（纯函数；两侧共享同一套判定语义） | M1 结束 |
| `ComposerBridge` | `captureInsertion(input) / insertText(input, text, span)` | M1 结束 |

> `SuggestionFeed`（`subscribe(onHint)`）随 [AD-0004](adr/0004-client-triggered-request.md) 一起作废：不再有 SSE 推送通道。

**冻结后的修改流程**：改契约 = 改 [ARCHITECTURE.md](ARCHITECTURE.md) + 新增 ADR + 通知全部泳道 rebase。

## 5. 每个泳道的 Definition of Done

- [ ] 只改了自己名下的文件（`git diff --name-only` 自查）
- [ ] 新逻辑有对应单测，`node --test` 全绿
- [ ] 失败路径有单测（超时 / 空输出 / 非法 JSON）
- [ ] 没有新增依赖
- [ ] 没有裸中文字符串（走 i18n）
- [ ] 没有 console.log 残留（用宿主 logger 或 client 的统一日志）
- [ ] 文档里被自己改动影响的那一节同步更新

## 6. 明确禁止

- 把 `@deepseek-ai/*` 写进 `dependencies`。
- 在 `src/` 里 import 官方运行时包。
- 自动发送任何消息；自动替用户点击发送键。
- 把会话原文写进日志、写进文件、写进测试夹具。
- 为了「看起来做了很多」而拆文件、加抽象层、加配置项。
