# 调研（一手证据 + 外部来源）

> 调研时间：2026-10（本机 DSH Desktop `0.2.1-rc.2`，build `332895e0`）
> 结论先行：**官方没有该功能，社区市场也没有该插件，但缝合点全开，且每一条都有可指认的出处。**

## 1. 本机环境事实

| 项 | 值 |
| --- | --- |
| 运行时包目录 | `D:\DeepSeek Harness\resources\app.asar\dsh\node_modules\@deepseek-ai`（306 个包） |
| profile | `C:\Users\123\.dsh\profiles\desktop`（`cordis.yml` 为空数组，实际条目由 `cordis.patch.yml` + bundles 组合） |
| 已装第三方插件 | `@linxin666/dsh-web-all`、`dsh-context`、`@liustack/modsearch`、`dsh-univer-office`、`dsh-session-surgeon` |
| node | `C:\Users\123\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe`（v24.21.0） |
| pnpm | 同上 `...\dependencies\pnpm\bin\pnpm.mjs`（用上面的 node 跑） |
| git | 2.55.0（可用）；`gh`、`npm` 本机不可用；`pwsh` 工具当前报 `powershell.exe ENOENT` |

> 因此本仓库的自动化一律用 **node 脚本**，不依赖 powershell / npm / gh。

## 2. 官方内置能力扫描（结论：没有）

- 对 306 个 `@deepseek-ai/*` 包、2815 个文件做过 `suggest` 全量检索：
  命中只有 ① 输入框 `/`、`@` 的候选菜单（`dsh-client-ui-input-trigger`，i18n 键 `suggestions.aria` = 「触发候选建议」）
  ② 会话标题生成 ③ 无关词（"suggestedName" 之类）。
- 不存在任何「回合结束后推荐下一句」的实现、配置项或槽位。

## 3. 市场扫描（结论：没有同类）

`https://dsh-market.com/manifest/plugins.json` → 142 个插件，按
`suggest | 推荐 | 补全 | ghost | auto.complete | next.prompt | 提示` 逐条过滤，无同类。
最接近的三个（都不是我们要做的）：

| 插件 | 做了什么 | 与我们的关系 |
| --- | --- | --- |
| `dsh-prompt-enhance` | 把**你已写的草稿**改写成结构化提示词 | 证明「读写输入框」可行，但方向相反 |
| `dsh-quote-followup` | 划选文本 → 以引用 chip 追加进输入框 | **本项目客户端实现的主要参照** |
| `@wingsky-1/dsh-notifier` | 回合完成/错误事件通知 | 证明宿主侧事件 → SSE → 浏览器这条链路可行 |

### 3.1 复核（2026-10-20，发布当天）：出现了同类

市场清单里仍然没有，但官方 Discussions 里已经有人做了几乎同款：

| 项目 | 做法 | 与我们的差异 |
| --- | --- | --- |
| [`dsh-composer-prediction`](https://github.com/deepseek-ai/deepseek-harness/discussions/10053)（2026-10-17） | 回合结束 → 一笔辅助请求 → 灰字画在 `conversation.input.overlay`；自带设置页与配置持久化 RPC；按会话缓存建议 | 我们：触发在浏览器（`session.running` 真→假）、宿主无状态（一次 POST）、渲染在 `conversation.composer.dock` 槽位 + 自绘绝对定位节点、配置走宿主 schemastery |

两边在「复用 `ctx.llm`、推理档压到最低、绝不上屏草稿」三点上独立收敛到同一结论 —— 这说明设计的约束抓对了。

**共存问题（写进 README）**：两个插件都会往同一个输入框画灰字，也都会每轮各花一笔模型调用；
同时装会出现两条重叠建议。谁先检测「已有 ghost 在场」谁就能让出，目前两边都没做。

## 4. 已核实的缝合点（每条都能复查）

### 4.1 包声明（双半包）

出处：`dsh-univer-office@0.3.7`、`dsh-quote-followup@0.2.10`、`dsh-session-surgeon@0.2.6` 的 `package.json`。

```json
"exports": { ".": "./plugin/index.mjs", "./client": "./plugin/client.js" },
"dsh": {
  "engines": { "dsh": ">=0.2.0-rc.1" },
  "bundle": { "patch": "./cordis.patch.yml" },
  "client": { "platform": "web", "inject": ["@deepseek-ai/dsh-client-ui-conversation"] }
}
```

- `dsh.bundle.patch` 指向 bundle patch，patch 里 `- insert: [{ id, name }]` 把条目插进 profile 花名册。
- `dsh.client.platform` 必须是 `web`；`dsh.client.inject` 列的是**客户端模块请求**（`@deepseek-ai/dsh-client-*`）。
- 官方 `@deepseek-ai/dsh-client-modules` 的 README 明确：宿主扫描 Loader 条目、按 `/plugins` 提供 bundle，浏览器懒加载。

### 4.2 浏览器半边的模块形状

出处：`dsh-quote-followup@0.2.10/lib/client.js` L19、L744-745。

```js
window.__ModuleLoader__.load({
  id: "dsh-quote-followup",
  factory: (require) => { /* … */ exports.inject = ["inputTriggers", "locale", "sessions", "uiSession"]; exports.apply = apply; return module.exports; }
});
```

即：客户端半边 = 注册一个 factory，`exports.inject` 声明要注入的**客户端服务名**，`exports.apply(ctx, config)` 是入口。

> **两个 inject 不是一回事，别写混：**
> - `package.json` 里的 `dsh.client.inject` = **模块请求**（要加载哪些 `@deepseek-ai/dsh-client-*` 包）；
> - 客户端 bundle 里的 `exports.inject` = **运行时服务名**（`sessions`、`locale`、`inputTriggers` …）。
> 前者写错 → 打包/加载失败；后者写错 → `ctx` 上拿不到服务。
（宿主半边则是 ESM 导出 `{ name, inject, Config, apply }`，出处：`@deepseek-ai/dsh-session-title-first-prompt-llm` 与 `@deepseek-ai/dsh-agent-instructions` 的 `lib/index.js` 末行导出。）

### 4.3 输入框 facade（读草稿 + 写草稿）

出处：`dsh-quote-followup@0.2.10/lib/client.js` L255-300。

```js
const scope = sessions.binding(sessionId)?.ctx ?? sessions.scope?.(sessionId); // 0.1.7+ 返回 { ctx }
const conversation = scope.get?.("conversation");
const input = conversation.input.for(scope);          // 输入框 facade
const state = input.state.getSnapshot();              // { draft, draftRev, phase, occurrences }
input.insertText(lead, { start, end, draftRev });     // 返回 true 才算成功
input.insertReference(quoteChip, { start, end, draftRev });
```

要点（原文注释里的教训，直接抄）：**binding 只在同步编辑期间借用，不跨 await 持有**；
`insertText` 只在 `draftRev` 仍然有效且编辑器可编辑时成功，异步消费者必须把拒绝结果留给用户操作。

### 4.4 输入区域的槽位

出处：`@deepseek-ai/dsh-client-ui-conversation` README（本机 0.2.1-rc.2）。

| 槽位 | 语义 |
| --- | --- |
| `conversation.input.overlay` | 输入框内浮层，列表形态（`/`、`@` 菜单就注册在这） |
| `conversation.input.activity` | 模型选择器与发送键之间的**单个控件**，可展开占满工具条 |
| `conversation.composer` | 链式选择，可临时接管整个输入框（重，不建议） |

### 4.5 宿主半边：事件 → 辅助 LLM → 通道路由

- 辅助 LLM 请求的先例：`@deepseek-ai/dsh-session-title-first-prompt-llm` —— 通过 `ctx.llm` 发一笔**与主请求解耦**的请求，自带 system instruction 与 JSON 框架，独立 `provider/model` 路由，失败保留兜底且不影响主流程。
- 路由先例：`dsh-session-surgeon` 宿主半边 `inject = ["tools", "webServer"]`，在 `plugin/routes.mjs` 里注册 `/api/session-surgeon`。
- 事件推送先例：`@wingsky-1/dsh-notifier` 用 `/api/dsh-notifier/events` 的 EventSource 把**宿主侧**判定的事件推给浏览器。

### 4.6 结论：推荐实现路径

**宿主半边**判定轮次结束 → 组装最小上下文 → `ctx.llm` 辅助请求 → 得到一句建议 →
挂在插件自己的路由上（SSE 或轮询）→ **浏览器半边**渲染建议条 → 采纳时走 4.3 的 `insertText`。

### 4.7 源码复核（`0.2.1-rc.2`，逐条对照 file:line）

> 复核方式：直接读本机 `D:\DeepSeek Harness\resources\app.asar\dsh\node_modules\@deepseek-ai\` 下的发行版产物。
> 只记「能指到行」的结论；没跑起来的一律标成「待首跑」。

| # | 结论 | 出处 |
| --- | --- | --- |
| 1 | 输入区域的公开子槽位不止三个：`conversation.composer.bar` 声明了 `attachments`(single)、`overlay`(list)、`permission`(single)、`left`(list)、`plan`(single)、`right`(list)、`model`(single)、`activity`(single)、**`dock`(list)**，作用域都是 `session`（`attachments` 为 `session-maybe`） | `dsh-client-ui-conversation/lib/client.js` L19880-19920 |
| 2 | `conversation.composer.dock` 渲染在**输入卡下方**那一行，与上下文占用环同排（`.dock{display:flex;gap:12px;padding-top:4px}`） | 同文件 L19161-19168、L18703 |
| 3 | `conversation.input.overlay` 是卡片顶边的绝对定位浮层（`.overlayAnchor{height:0;position:absolute;inset:0 0 auto}`），`/`、`@` 菜单就在里面 | 同文件 L18997-19001；`dsh-client-ui-input-trigger/lib/client.js` L1913 |
| 4 | 输入框自带**行内 ghost**：`.input p:last-child:after{content:var(--dsh-composer-hint)}`，变量由 `DraftEditor` 的 `hint` prop 写入（JSON.stringify），来源只有「已认领的 `/命令`」的 `input.claim.hint` | 同文件 L18703、L18141-18172、L18964-18969 |
| 5 | 输入框公共动作面：`captureInsertion()` / `insertText(text, span)` / `setDraft(text)` / `submit()`；快照字段 `draft, attachmentIds, draftRev, phase, claim?, occurrences, queue` | 同文件 L14912-14937、L15676-15686 |
| 6 | 客户端插件形状：`exports.inject` 是**运行时服务名**；`ctx.inject([...], scope => ...)`；`scope.slots.inject(name, () => scope.slots.register({ name, id, order, locale, inject }, View))`；`ctx.effect(() => ctx.locale.register(NS, { zh, en }))` | `dsh-client-ui-input-trigger/lib/client.js` L1894-1941 |
| 7 | 客户端 bundle 可直接 `require("react")` / `require("react/jsx-runtime")` / `require("react-dom")`，第三方包同样如此 —— 无需构建步骤也能写 UI | 同文件 L1-10；`@linxin666/dsh-web-all/lib/client.js` 首行 |
| 8 | 插件可自行注入样式：`document.createElement("style")` + `dataset.pluginCss` 去重（官方包就是这么干的） | `dsh-client-ui-conversation/lib/client.js` L19176-19181 |
| 9 | 宿主辅助请求：`ctx.llm.prepareCall({provider, model, maxTokens}, signal, adjust)` → `{ config, stream(options) }`；`createUserMessage` + `BlockAssembler` 来自 `@deepseek-ai/dsh-llm`；超时用 `deadline(signal, ms, code)` | `dsh-session-title-llm/lib/index.js`（`executeSessionTitleLlm`） |
| 10 | 宿主路由：`ctx.webServer.register({ kind: "exact", path, handler })` → disposer；重复注册抛错；匹配 exact → 最长前缀 → fallback | `dsh-host-webserver/lib/index.js` L326-333、L381-394 |
| 11 | 宿主能按 `sessionId` 取会话：`ctx.sessions.get(id)` / `list()`；`session.deriveMessages()` 给出派生消息历史，`session.requestHeader()` 记录上次请求路由，`session.snapshotEvents(fromSeq)` 给窗口 | `dsh-session/lib/index.js` L1980-1987、L1672-1687、L1612、L1452 |
| 12 | 会话事件里轮次用的是 `turn/start` 与 `turn/end` | `dsh-session/lib/index.js`（事件字面量） |
| 13 | 浏览器侧有会话运行位：`session.running` + `handleRunning(running)` 同步 | `dsh-api-session-controller/lib/types/client/sessions/session.js` L54、L438-448 |

**这些结论改变了设计**：见 [AD-0004](adr/0004-client-triggered-request.md)（判定在浏览器、一次请求-响应，SSE 与宿主轮次订阅取消）
与 [AD-0005](adr/0005-rendering-seams.md)（槽位优先，`dock` 取代「DOM 注入」成为 M1 首选）。

## 5. 外部调研

| 来源 | 采纳了什么 |
| --- | --- |
| [dsh-ecosystem-spec](https://github.com/T-Auto/dsh-ecosystem-spec)（社区互操作规范，非官方） | 「解耦优于到处 import 上游包」的工程纪律；但**不把它当 ABI**（这也是 `dsh-session-surgeon` 更新技能里明确写过的教训） |
| [dsh 插件开发教程（DEV）](https://dev.to/henry_lin_3ac6363747f45b4/deepseek-harness-dsh-cha-jian-kai-fa-jiao-cheng-4h6j) | 插件的四个导出 `name / inject / Config / apply` —— 已在本机包内逐一核对属实 |
| [awesome-deepseek-harness](https://github.com/libukai/awesome-deepseek-harness) | 生态现状；确认没有同类 |
| [Claude Code sub-agents](https://code.claude.com/docs/zh-CN/sub-agents)、[agent teams](https://code.claude.com/docs/zh-CN/agent-teams) | 并行 agent 的职责边界：一个 agent 一个窄目标、独立上下文、结果用结构化回传 |
| Git worktree 并行开发实践（多篇） | 一条并行泳道 = 一个 worktree + 一个分支；冲突在合并前解决，不在共享工作区里抢写 |
| 本机先例 `dsh-session-surgeon/docs/IMPLEMENTATION-CONTRACT.md` | **文件所有权表**：多 agent 并行时，谁写哪个文件写死在合同里，禁止越界 |

## 6. 多智能体并行开发：本项目采用的做法

1. **接口先行**：并行前先把 `src/` 的纯函数签名与数据结构冻结（`docs/ARCHITECTURE.md` §4），写进 `src/contracts/`。
2. **一个泳道一个 worktree**：`git worktree add ../dsh-next-hint-wt/<lane> -b feat/<lane>`，互不共享工作区。
3. **文件所有权**：合同里的表说了算；需要改别人的文件 → 提 issue 式留言给主控，不直接动手。
4. **每个泳道自带测试**：`node --test tests/<lane>/` 必须绿，否则不许合并。
5. **主控只做三件事**：冻结接口、合并顺序、跑集成矩阵。不做功能实现，避免自己成为冲突源。
6. **合并顺序**：契约层 → 宿主半边 → 浏览器半边 → 配置/i18n → 文档。每步 rebase 到最新 `main` 后跑全量测试。

## 7. 未解决

见 [OPEN-QUESTIONS.md](OPEN-QUESTIONS.md)。凡是「我猜它能用」的都还没写进这里。
