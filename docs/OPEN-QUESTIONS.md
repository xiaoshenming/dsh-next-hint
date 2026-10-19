# 待验证（spike）

> **规则：一条不关，对应的功能就不写。** 每条都要写清「怎么验、验到什么算过」。
> 关掉一条时，把结论回填到 [RESEARCH.md](RESEARCH.md)（带出处）或 [ARCHITECTURE.md](ARCHITECTURE.md)。

## H1 — 宿主侧「一轮结束」到底是哪个事件？

- 要回答：`0.2.1-rc.2` 里，宿主插件能订阅到的轮次结算信号叫什么？在 `ctx` 的哪个服务上？payload 有没有 `sessionId` / `turnId` / 是否失败？
- 怎么验：在本机 `.dsh` 跑一个只订阅、只打印 keys 的临时宿主插件；或在 `@deepseek-ai/dsh-session` / `dsh-agent-loop` 的 `lib/` 里定位事件常量。
- 算过：拿到事件名 + 服务名 + payload 字段，并写出 3 行可运行示例。
- 风险：如果只有流式 chunk、没有结算事件，则退化为「空闲 N ms 后当作结算」。

## H2 — `ctx.llm` 的辅助请求怎么发？

- 要回答：服务名、请求形状、如何「跟随最近一次主请求的路由」、如何强制 JSON 输出、如何取消。
- 怎么验：读 `@deepseek-ai/dsh-session-title-llm` 的执行模块 + `dsh-session-title-first-prompt-llm` 的 provider（本机有源码）。
- 算过：能写出一次真实请求并拿到可解析结果；失败能拿到分类错误（无路由 / 超时 / 429）。

## H3 — 宿主如何注册自己的 HTTP 路由？

- 要回答：`webServer` 服务的确切 API（注册、SSE、鉴权边界、loopback 判定）。
- 怎么验：读 `dsh-session-surgeon/plugin/routes.mjs`（`/api/session-surgeon` 已在生产用）。
- 算过：`curl` 拿到自己路由的 JSON 与 SSE 分片。

## C1 — 浏览器半边怎么拿到「当前会话」与输入框 facade？

- 要回答：客户端 bundle 里的 `exports.inject`（**运行时服务名**，不是 package.json 里那个模块请求清单）到底该写哪些；`sessions.binding(id).ctx` 在 `0.2.1-rc.2` 是否仍是这个形状。
- 怎么验：临时客户端插件打印 `ctx` 里可用的服务键；对照 `dsh-quote-followup@0.2.10/lib/client.js` L255-300。
- 算过：能同步拿到 `input`，并成功执行一次 `insertText` 且草稿里出现文字。
- 风险：0.1.7 之后 `sessions.scope()` → `sessions.binding().ctx` 变更过；必须以本机版本实测为准。

## C2 — 建议条挂在哪里不会顶坏布局？

- 要回答：输入框卡片在 DOM 里的稳定锚点（`data-*` 属性 / 结构），以及在无会话、窄屏、多行草稿三种情况下不跳变。
- 怎么验：在真实 Web GUI 里注入一个 40px 高的节点，检查输入卡片几何是否变化；对比 `5 的 A/B/C 三方案。
- 算过：三种情况下输入框高度与滚动位置不变；切换会话不残留。

## C3 — 插件卸载能干净吗？

- 要回答：`ctx.effect` 归还的时机；client bundle 热更新（HMR）时旧节点是否被移除。
- 怎么验：装 → 用 → 在设置页停用 → 检查 DOM、监听器、EventSource、定时器全部消失。
- 算过：停用后 `document` 上无本插件监听，`performance` 里无持续请求。

## P1 — 远端浏览器与隐私边界

- 要回答：远端（非 loopback）访问时，插件路由是否可被外部打到？会话原文会不会因此越界？
- 怎么验：用 LAN 地址打开 Web GUI，请求 `/api/next-hint/stream`。
- 算过：远端被拒绝或返回空；且文档里写明策略。
