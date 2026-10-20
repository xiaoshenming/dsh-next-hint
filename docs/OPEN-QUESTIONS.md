# 待验证（spike）

> **规则：一条不关，对应的功能就不写。** 每条都要写清「怎么验、验到什么算过」。
> 关掉一条时，把结论回填到 [RESEARCH.md](RESEARCH.md)（带出处）或 [ARCHITECTURE.md](ARCHITECTURE.md)。
>
> 2026-10 复核 `0.2.1-rc.2` 源码后：H1 / H2 / H3 / C1 已关闭（证据见 [RESEARCH.md](RESEARCH.md) `4.7）。
> 剩下的是「首跑才知道」的项，不是「摸黑猜」的项。

## 已关闭

### H1 — 宿主侧「一轮结束」是哪个事件 —— 已关闭（设计上不再需要）

- 结论：会话事件里存在 `turn/start` 与 `turn/end`（`@deepseek-ai/dsh-session`），
  但 **AD-0004 之后宿主不再订阅轮次事件**：结算判定搬到浏览器（`session.running` 由
  `handleRunning` 同步），宿主只在收到 `POST /api/next-hint` 时才干活。
- 影响：`src/trigger.mjs` 从「宿主事件判定」退化为「宿主侧限流/预算判定」，`src/feed.mjs`、`src/store.mjs` 删除。
- 若将来真需要宿主主动触发：订阅 `turn/end` 即可，不影响本设计的其它部分。

### H2 — `ctx.llm` 的辅助请求怎么发 —— 已关闭（签名已核实）

- 出处：`@deepseek-ai/dsh-session-title-llm/lib/index.js` `executeSessionTitleLlm`。
- 形状（照抄可用）：
  ```js
  const call = await ctx.llm.prepareCall({ provider, model, maxTokens }, signal, (controls) => controls);
  const assembler = new BlockAssembler();                 // @deepseek-ai/dsh-llm
  for await (const chunk of call.stream({ ...call.config, messages, system, sessionId, purpose: "next-hint", signal })) assembler.push(chunk);
  ```
- 消息用 `createUserMessage({ content: [{ type: "text", text }], source: { kind: "..." } })`；
  超时用 `deadline(signal, timeoutMs, code)`（`@deepseek-ai/dsh-timeout`）；
  终止原因 `finish.kind` ∈ `stop | tool-calls | max-tokens | error | aborted`。
- 仍未跑真的部分：一笔真实请求的返回值 —— 属于 M2 首跑验收，不是设计未知。

### H3 — 宿主如何注册 HTTP 路由 —— 已关闭

- 出处：`@deepseek-ai/dsh-host-webserver/lib/index.js` `register(route)`。
- 形状：`ctx.webServer.register({ kind: "exact", path: "/api/next-hint", handler: (req, res) => {} })`，返回 disposer；
  同 path 重复注册抛错。匹配顺序：exact → 最长前缀 → fallback。
- 宿主插件 `inject` 需含 `"llm"`、`"sessions"`、`"webServer"`。

### C1 — 浏览器半边怎么拿到输入框 facade —— 已关闭

- 出处：`dsh-client-ui-conversation/lib/client.js` `SessionInputShell.actions`（L14912-14937）与 `compose()`（L15676-15686）。
- 形状：
  ```js
  input.state.getSnapshot();            // { draft, draftRev, phase, claim?, occurrences, queue }
  const span = input.actions.captureInsertion();   // { start, end, draftRev }
  input.actions.insertText(text, span);            // 返回 true 才算成功
  ```
- 插件内拿到 `input`：`ctx.inject(["slots", "sessions", ...], (scope) => ...)`，再 `sessions.binding(id)?.ctx`
  按会话解析（注册进槽位的组件由槽位把 `sessionId` 注进来）。
- 未跑真的部分：一次真实 `insertText` —— M2 首跑验收。

## 未关闭

### H4 — 宿主怎么按 `sessionId` 取「最近几轮」

- 要回答：`ctx.sessions.get(id).deriveMessages()` 返回什么形状？长会话下单次开销可接受吗？取尾部 N 轮的边界在哪？
- 怎么验：在临时宿主插件里对真实会话打印 `deriveMessages().slice(-4).map(m => m.content)`。
- 算过：能稳定拿到最近 2-4 轮纯文本（不含 tool-call 块），且不阻塞主循环。
- 如果开销大：改用 `snapshotEvents(fromSeq)` 的尾部窗口，或只取 `turn/start` 之后的 `user/message` / `assistant/message`。

### C2 — 建议条放哪、会不会跳变

- 要回答：`conversation.composer.dock` 这一行（输入卡下方、与上下文占用环同排）塞一句话会不会挤？无会话、窄屏、多行草稿三种情况下几何是否稳定？
- 怎么验：M1 落地后，在真实 Web GUI 里对比三种草稿状态的 `getBoundingClientRect`。
- 算过：输入卡高度与滚动位置不变；切换会话不残留；建议条不抢焦点。

### C4 — Tab 与 `/`、`@` 候选菜单的按键仲裁

- 要回答：`/`、`@` 菜单打开时按 Tab 归菜单；菜单没开时我们的 Tab 才能采纳建议。怎么判「菜单开着」？
- 候选：`input.state.getSnapshot()` 里有 `occurrences` / `phase`，但没看到「菜单是否展开」的字段；可能得读 DOM（`[data-composer-overlay]` 是否有子节点）。
- 算过：菜单打开时采纳不触发；菜单关闭时采纳生效；不确定时**宁可不出**。
- 兜底：`trigger: "shortcut"` 用非 Tab 的组合键（如 `Alt+Enter`），或只做点击采纳。

### C3 — 插件卸载能干净吗

- 要回答：`ctx.effect` 归还时机、槽位 disposer、client bundle HMR 时旧节点是否移除。
- 怎么验：装 → 用 → 设置页停用 → 检查 DOM、监听器、`<style data-plugin-css>`、在飞请求全部消失。

### P1 — 远端浏览器与隐私边界

- 要回答：LAN 地址打开 Web GUI 时，`POST /api/next-hint` 是否可被外部打到并驱动一笔模型请求？
- 怎么验：用 LAN 地址发一次同名请求。
- 算过：非 loopback 来源被拒绝；文档写明策略。
