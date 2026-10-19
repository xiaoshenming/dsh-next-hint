# AD-0001 双半包（宿主 + 浏览器）

- 状态：已接受（2026-10）
- 相关：[ARCHITECTURE.md](../ARCHITECTURE.md) `1、[RESEARCH.md](../RESEARCH.md) `4.5

## 背景

能力分散在两个进程：`ctx.llm`（辅助模型请求）、会话事件、路由注册都在宿主；输入框 facade 在浏览器。
单半边做不到闭环 —— 宿主半边看不见输入框，浏览器半边拿不到模型服务。

## 决策

拆成双半包，同一个 npm 包内两个入口：

- `exports["."] → plugin/index.mjs`：宿主半边，导出 `{ name, inject, Config, apply }`。
- `exports["./client"] → plugin/client.js`：浏览器半边，注册 `window.__ModuleLoader__.load({ id, factory })`，导出 `{ inject, apply }`。

两半之间**只**通过插件自己的 HTTP 路由通信（同源、loopback 优先）。

## 后果

- 好处：与 `dsh-session-surgeon`、`dsh-notifier` 同构，风险最低；任一半边出问题可独立降级。
- 代价：多一条 HTTP 通道与一次序列化；需要自己处理断连、重连与鉴权边界。
- 约束：路由必须默认限制在 loopback；远端浏览器不渲染建议条。
