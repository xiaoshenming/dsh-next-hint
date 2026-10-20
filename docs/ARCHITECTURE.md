# 架构

> 本文件只写**已核实**的接口（出处见 [RESEARCH.md](RESEARCH.md) `4.7）。
> 任何尚未实测的假设一律进 [OPEN-QUESTIONS.md](OPEN-QUESTIONS.md)，不在这里冒充事实。

## 1. 双半包

```text
┌──────────────────────── 宿主（Node / cordis） ────────────────────────┐
│  plugin/index.mjs   export { name, inject, Config, apply }           │
│    ├─ 路由       → plugin/routes.mjs   POST /api/next-hint           │
│    ├─ 取样       → src/context.mjs     ctx.sessions.get(id)          │
│    ├─ 辅助请求   → src/generate.mjs    ctx.llm.prepareCall           │
│    └─ 预算限流   → src/trigger.mjs     冷却 / 字节 / token / 超时     │
└──────────────────────────────────────────────────────────────────────┘
                                  ↕ HTTP POST（同源、loopback 优先）
┌──────────────────────── 浏览器（client bundle） ──────────────────────┐
│  plugin/client.js   window.__ModuleLoader__.load({ id, factory })    │
│    ├─ 结算判定   → src/watch.mjs       session.running × draft       │
│    ├─ 建议条     → 槽位 conversation.composer.dock（M1）              │
│    │              行内 ghost 皮肤（M2，见 AD-0005）                   │
│    └─ 采纳写入   → input.actions.captureInsertion / insertText       │
└──────────────────────────────────────────────────────────────────────┘
```

**为什么拆两半**：`ctx.llm` 与 `ctx.sessions` 在宿主；输入框 facade 与会话运行位在浏览器。
判定在浏览器、生成在宿主、一次请求-响应（[AD-0004](adr/0004-client-triggered-request.md)）。

## 2. 数据流（一次成功路径）

1. 主回合结束：浏览器侧 `session.running` 由真变假。
2. 判定（`src/watch.mjs`，纯函数）：开关打开 ∧ 草稿为空 ∧ 输入框可编辑 ∧ 该会话是当前可见会话 ∧ 不在冷却期
   ∧ 用户没有正在输入法组合 —— 任一不满足就不发请求。
3. 请求：`POST /api/next-hint`，body `{ sessionId, locale }`。**不传会话原文。**
4. 取样（`src/context.mjs`，纯函数）：宿主按 `sessionId` 取最近 2-4 轮用户/助手文本 + 工作区名，裁到 `maxInputBytes`。
5. 生成（`src/generate.mjs`）：一笔独立请求（system 要求只输出一句可直接发送的话），
   长度受 `maxHintChars`，超时 `timeoutMs`；路由默认跟随会话最近一次请求的 `{ provider, model }`。
6. 响应：`200 { hint }` / `204`（没有建议）/ `4xx`（拒绝：来源不对、会话不存在）。
7. 渲染：建议条出现（`aria-live="polite"`）；用户开始打字 / 切换会话 / 采纳 / Esc → 消失。
8. 采纳：`captureInsertion()` 取当前位置 → `insertText(hint, span)` → 成功则收起建议条并把焦点交回编辑器。

## 3. 宿主半边职责

| 职责 | 说明 |
| --- | --- |
| 路由 | `ctx.webServer.register({ kind: "exact", path: "/api/next-hint", handler })`，返回 disposer |
| 来源校验 | 只接受同源、loopback 来源；`sessionId` 解析不到直接 400 |
| 取样 | `ctx.sessions.get(id)` → 最近几轮文本；不落盘、不进日志 |
| 预算守卫 | `maxInputBytes` / `maxOutputTokens` / `timeoutMs` / `perSessionCooldownMs` / 单会话并发 1 |
| 降级 | 无路由 / 429 / 超时 / 输出不合规 → `204` + 一条 warn；不返回错误正文 |

## 4. 浏览器半边职责

| 职责 | 说明 |
| --- | --- |
| 结算判定 | `session.running` + `input.state` 快照；判定不通过就不发请求 |
| 会话绑定 | 只对「当前可见会话」请求与渲染（槽位把 `sessionId` 注进来） |
| 建议条 | 位置见 `5；不抢焦点、不改变输入卡片高度 |
| 采纳 | `captureInsertion()` → `insertText()`；`draftRev` 失效就静默放弃（用户已经在打字了） |
| 取消 | 用户开始打字 / 切会话 / 停用插件 → `AbortController.abort()` |
| 清理 | 卸载时删掉 DOM、`<style>`、监听器与在飞请求（走 `ctx.effect` 归还） |

## 5. UI 放置（AD-0005，取代 AD-0003）

| 方案 | 优点 | 缺点 | 取舍 |
| --- | --- | --- | --- |
| A. `conversation.composer.dock`（list） | 官方槽位；就在输入卡下方一行；零 DOM 依赖 | 位置在卡下方，不是「框里的灰字」 | **M1 首选** |
| B. 行内 ghost（脱离 React 树的绝对定位节点） | 最接近 Claude 的观感 | 依赖 Lexical 的 DOM 结构 | **M2 皮肤**，锚点找不到就退回 A |
| C. `conversation.input.overlay`（list） | 浮层，视觉自由 | 与 `/`、`@` 菜单抢浮层与键盘仲裁 | 不用 |
| D. `conversation.input.activity`（single） | 官方槽位 | 只有一个控件的位置，装不下一句话 | 备选 |
| E. `conversation.composer`（chain） | 完全自控 | 临时接管整个输入框，代价过大 | 不用 |

补充事实：输入框自带行内 ghost 机制 `.input p:last-child:after{content:var(--dsh-composer-hint)}`，
但只有「已认领的 `/命令`」能设置该变量，官方无写入口 —— 上游一旦开放，M2 立即改用官方 API。

## 6. 输入框 facade（已核实签名）

```js
// 在槽位组件里：sessionId 由槽位注入；在服务里：sessions.binding(id)?.ctx
const input = scope.get("conversation").input.for(scope);
const state = input.state.getSnapshot();          // { draft, draftRev, phase, claim?, occurrences, queue }
const span  = input.actions.captureInsertion();   // { start, end, draftRev }
input.actions.insertText(text, span);             // 返回 true 才算成功
```

要点：**binding 只在同步编辑期间借用，不跨 await 持有**；异步消费者必须把拒绝结果留给用户操作。

## 7. 失效模式

| 情况 | 表现 | 处理 |
| --- | --- | --- |
| 没有可用模型路由 | 无建议 | `204` + warn 一次，冷却期内不再重试 |
| 模型超时 / 429 | 无建议 | 记 metric，退避 |
| 输出为空 / 太长 / 带多余 Markdown | 无建议 | 丢弃，不重试本轮 |
| 用户已在打字 | 建议不出现或立即消失 | 发请求前判空草稿；渲染前比对 `draftRev` |
| 会话切换 | 建议跟着清空 | 以 `sessionId` 为键 |
| 宿主版本不兼容（无 facade / 无槽位） | 功能整体不启用 | 启动时探测，写一条 warn |
| 插件被停用 | DOM、样式、监听、请求全清 | `ctx.effect` 归还 |

## 8. 配置项草案

> 触发策略：**每轮结束都出**（用户 2026-10 决定）。`idle` / `shortcut` 两种模式本轮不做，等有人真需要再加。

| 键 | 类型 | 默认 | 边界 |
| --- | --- | --- | --- |
| `enabled` | boolean | `true` | 总开关 |
| `provider` / `model` | string | 空 = 跟随会话最近一次主请求的路由（`session.requestContext()`） | 两者必须同时给或同时空 |
| `maxTurns` | number | 3 | 1–8 |
| `maxInputBytes` | number | 8000 | ≥ 512 |
| `maxOutputTokens` | number | 128 | ≥ 32 |
| `maxHintChars` | number | 48 | 8–200，生成后再次截断 |
| `timeoutMs` | number | 8000 | 1000–60000 |
| `perSessionCooldownMs` | number | 0（每轮都出） | ≥ 0 |
| `locale` | `auto` / `zh` / `en` | `auto` | 跟随 locale 服务 |

> 配置项以 `Config`（schemastery）声明，官方设置页会自动生成表单 —— 与 `dsh-session-title-first-prompt-llm` 同款。

## 9. 安全与隐私

- 只在用户自己配置的模型路由上跑；不引入任何第三方端点。
- 浏览器只发 `sessionId`，会话原文由宿主在进程内取用一次，不落盘、不进日志、不跨进程。
- 远端（非 loopback）来源：路由直接拒绝，与市场插件的既定边界一致。
- 建议条是**建议**：无论内容多像指令，都不自动发送。
