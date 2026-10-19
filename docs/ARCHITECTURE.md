# 架构

> 本文件只写**已核实**的接口（出处见 [RESEARCH.md](RESEARCH.md)）。
> 任何尚未实测的假设一律进 [OPEN-QUESTIONS.md](OPEN-QUESTIONS.md)，不在这里冒充事实。

## 1. 双半包

```text
┌──────────────────────── 宿主（Node / cordis） ────────────────────────┐
│  plugin/index.mjs                                                    │
│    ├─ 轮次结算监听  →  src/trigger.mjs   （何时该给建议）              │
│    ├─ 上下文取样    →  src/context.mjs   （最近几轮压到预算内）        │
│    ├─ 辅助请求      →  src/generate.mjs  （ctx.llm，自成一笔）          │
│    ├─ 结果缓存      →  src/store.mjs     （按会话，TTL + 失效）         │
│    └─ 路由          →  plugin/routes.mjs （/api/next-hint，SSE/轮询）  │
└───────────────────────────────────────────────────────────────────────┘
                                  ↕ HTTP（同源、loopback 优先）
┌──────────────────────── 浏览器（client bundle） ──────────────────────┐
│  plugin/client.js                                                    │
│    ├─ 订阅建议流    →  src/feed.mjs                                   │
│    ├─ 建议条 UI     →  plugin/client.js 内（DOM 注入或槽位）           │
│    └─ 采纳写入      →  conversation.input.for(scope).insertText(...)  │
└───────────────────────────────────────────────────────────────────────┘
```

**为什么拆两半**：`ctx.llm` 与轮次事件在宿主侧；输入框 facade 在浏览器侧。跨半边唯一的通道是 HTTP 路由 —— 与 `dsh-session-surgeon`、`dsh-notifier` 同构，风险最低。

## 2. 数据流（一次成功路径）

1. 主回合结算，助手最后一条可见消息落地。
2. 触发判定（`src/trigger.mjs`，纯函数）：是否开启、是否有可用路由、是否在冷却期 —— **只看宿主已知事实，不猜浏览器状态**。
3. 取样（`src/context.mjs`，纯函数）：最近 N 轮的用户/助手文本 + 工作区名 + 是否失败轮次，裁到 `maxInputBytes`。
4. 生成（`src/generate.mjs`）：一笔独立请求，system instruction 要求输出一条 JSON（`{ hint: string }`），长度受 `maxHintChars` 限制，超时 `timeoutMs`。
5. 缓存（`src/store.mjs`）：按 `sessionId` 存 `{ hint, turnId, createdAt }`；同一轮不重复生成；TTL 到期或用户发新消息即失效。
6. 推送：路由把「本会话的新建议」推给浏览器（SSE 优先，轮询兜底）。
7. 渲染：建议条出现，`aria-live="polite"`；用户开始打字 / 切换会话 / 采纳 / 关闭 → 消失。
8. 采纳：`captureInsertion()` 取当前位置 → `insertText(hint, span)` → 成功则收起建议条并让焦点回到编辑器。

## 3. 宿主半边职责

| 职责 | 说明 |
| --- | --- |
| 监听结算 | 只订阅已核实的事件（spike H1）；订阅失败 = 功能自禁用 |
| 预算守卫 | `maxInputBytes` / `maxOutputTokens` / `timeoutMs` / `perSessionCooldownMs` |
| 路由 | `GET /api/next-hint/stream?sessionId=`（SSE）、`POST /api/next-hint/dismiss`（可选，做成本记录） |
| 降级 | 没有路由 / 429 / 超时 / 输出不合规 → 记一条 warn，什么都不推 |
| 隐私 | 只在本进程内保留取样；不落盘原文；日志里不出现用户原文 |

## 4. 浏览器半边职责

| 职责 | 说明 |
| --- | --- |
| 会话绑定 | 只对「当前可见会话」渲染建议（spike C2：`sessions` / `uiSession` 的确切用法） |
| 建议条 | 位置见 §5；不抢焦点、不改变输入框布局高度（避免跳动） |
| 采纳 | §6 的 `insertText`；`draftRev` 失效就静默放弃（用户已经在打字了） |
| 清理 | 卸载时删掉 DOM 与监听（用 `ctx.effect` 归还，参照 `dsh-quote-followup` L740-741） |

## 5. UI 放置方案（AD-0003）

| 方案 | 优点 | 缺点 | 取舍 |
| --- | --- | --- | --- |
| A. `conversation.input.activity` 槽位 | 官方槽位，不碰 DOM | 只能放「一个控件」，展开会顶掉工具条；样式受宿主约束 | 备选 |
| B. `conversation.input.overlay` 槽位 | 就在输入框内浮层 | 该槽位语义是候选菜单（list kind），塞建议条有语义入侵风险 | 备选 |
| C. DOM 注入（输入框卡片上方一个 peer 节点） | 完全自控样式与无障碍；`dsh-quote-followup` 已验证可行 | 依赖宿主 DOM 结构；宿主改版要跟 | **首选**，A 作为 fallback |

> 宿主要是哪天真给出「输入框下方提示条」的正式槽位，立刻迁过去 —— 记进 RELEASE 的「跟随上游」清单。

## 6. 输入框 facade（已核实签名）

```js
const scope = sessions.binding(sessionId)?.ctx;   // 0.1.7+ 返回 { ctx }
const input = scope.get("conversation").input.for(scope);
const state = input.state.getSnapshot();          // { draft, draftRev, phase, occurrences }
input.insertText(text, { start, end, draftRev }); // 返回 true 才算成功
```

## 7. 失效模式

| 情况 | 表现 | 处理 |
| --- | --- | --- |
| 没有可用模型路由 | 无建议 | warn 一次，冷却期内不再重试 |
| 模型超时 / 429 | 无建议 | 记 metric，退避 |
| 输出不是 JSON / 太长 / 为空 | 无建议 | 丢弃，不重试本轮 |
| 用户已在打字 | 建议不出现或立即消失 | 渲染前比对 `draftRev` |
| 会话切换 | 建议跟着切或清空 | 以 `sessionId` 为键 |
| 宿主版本不兼容（无 facade） | 功能整体不启用 | 启动时探测，写一条 warn |
| 插件被停用 | DOM 与后台任务全清 | `ctx.effect` 归还 |

## 8. 配置项草案

| 键 | 类型 | 默认 | 边界 |
| --- | --- | --- | --- |
| `enabled` | boolean | `true` | 总开关 |
| `trigger` | `auto` / `idle` / `shortcut` | `auto` | 自动出 / 仅空闲 / 快捷键才出 |
| `provider` / `model` | string | 空 = 跟随最近一次主请求的路由 | 两者必须同时给或同时空 |
| `maxInputBytes` | number | 8000 | ≥ 512 |
| `maxOutputTokens` | number | 128 | ≥ 32 |
| `maxHintChars` | number | 40（CJK）/ 80（拉丁） | 采纳前再次截断 |
| `timeoutMs` | number | 8000 | 1000–60000 |
| `perSessionCooldownMs` | number | 30000 | ≥ 0 |
| `locale` | `auto` / `zh` / `en` | `auto` | 跟随 locale 服务 |

> 配置项以 `Config`（schemastery）声明，官方设置页会自动生成表单 —— 与 `dsh-session-title-first-prompt-llm` 的 `Config` 同款。

## 9. 安全与隐私

- 只在用户自己配置的模型路由上跑；不引入任何第三方端点。
- 会话原文只在内存里参与一次请求，不落盘、不进日志。
- 远端（非 loopback）浏览器：默认不渲染建议条，与市场插件的既定边界一致。
- 建议条是**建议**：无论内容多像指令，都不自动发送。
