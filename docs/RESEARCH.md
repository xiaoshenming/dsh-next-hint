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

## 3. 市场扫描（清单内没有同类）

> 这里的「没有同类」只覆盖**市场清单**与**官方代码**，不是全网结论：
> 社区 Discussions 里的先例见 [3.1](#31-复核2026-10-20发布当天出现了同类)。

`https://dsh-market.com/manifest/plugins.json` → 143 个插件（`generated: 2026-10-20`），按
`suggest | 推荐 | 补全 | ghost | auto.complete | next.prompt | 提示` 逐条过滤，无同类。
最接近的三个（都不是我们要做的）：

| 插件 | 做了什么 | 与我们的关系 |
| --- | --- | --- |
| `dsh-prompt-enhance` | 把**你已写的草稿**改写成结构化提示词 | 证明「读写输入框」可行，但方向相反 |
| `dsh-quote-followup` | 划选文本 → 以引用 chip 追加进输入框 | **本项目客户端实现的主要参照** |
| `@wingsky-1/dsh-notifier` | 回合完成/错误事件通知 | 证明宿主侧事件 → SSE → 浏览器这条链路可行 |

### 3.1 复核（2026-10-20，发布当天）：出现了同类

市场清单里仍然没有这三方中的任何一个，但官方 Discussions 里已经有人做了几乎同款：

| 项目 | 做法 | 与我们的差异 |
| --- | --- | --- |
| [`dsh-composer-prediction`](https://github.com/deepseek-ai/deepseek-harness/discussions/10053) `0.7.8`（2026-10-22） | 回合结束 → 一笔辅助请求 → 灰字画在 `conversation.input.overlay`；自带设置页与配置持久化 RPC；**按会话缓存建议**（切回来立即恢复、不重发请求）；**Esc 关闭**；按 `session + turn` 去重；序列守卫丢弃迟到响应；**0.7.7 起组合期不排期，并在检测到本插件时整段暂停（让位）；0.7.8 把共享 `data-composer-ghost` 移到实际画出的节点（per-offer）** | 我们：**同样**浏览器侧判定（`session.running` 真→假）+ 宿主无状态 POST；差异在挂载点（官方 `conversation.composer.dock` 槽位 + 自绘绝对定位节点 vs overlay）、配置走宿主 schemastery（无自带设置页）、**没有**跨会话缓存（切换即丢）、**没有** Esc（见 OPEN-QUESTIONS C5） |

两边在「复用 `ctx.llm`、推理档压到最低、绝不上屏草稿」三点上独立收敛到同一结论 —— 这说明设计的约束抓对了。

**共存（写进 README）**：两个插件都会往同一个输入框画灰字，也都会每轮各花一笔模型调用。
0.7.7 起落地**单边让位**（0.7.8 把共享属性收敛到 per-offer 节点）：它把 `dsh-next-hint` 写进 `KNOWN_GHOST_PACKAGES`，只要启动图里有本包，
或 DOM 里有 `[data-next-hint-anchor]` / `[data-next-hint-state]` / `[data-next-hint="ghost"]`，
就整段暂停自己的预测；共享属性 `data-composer-ghost` 是给第三方动态检测用的入口。
所以同装时的行为是确定的：**我们出灰字，它暂停**（≤0.7.6 的旧版仍会双画）。
0.1.3 起我们的灰字节点也带 `data-composer-ghost`，只在真的画出来时才有；
`data-next-hint-anchor` 是常驻节点，不能当「此刻正在显示」的信号。

2026-10-21 作者回复，更正了两点：他**也**在浏览器侧用 `useSession(running)` 判定，predict 路由**同样无状态**
（有状态的只是设置用的 config RPC）；所以「浏览器判定 / 宿主无状态」不是差异，差异只在挂载点、设置页、会话缓存与 Esc。
回复时两边都还没有跨插件检测，而且都在 document 级监听 keydown —— 若让位失效，一个 Tab 仍可能同时采纳两条 ghost；
他当时也同意「共享的『已有 ghost 在场』DOM 属性」是最小信号。IME 方面他没有 `compositionend` 代码：
可见性只看 composer store 的 `draft === ''`，组合文本已经反映在 store 里，所以不会闪；
他建议在 `data-composer-composing` 置位期间直接抑制 —— 0.1.2 采纳了这条（见 4.8.1 与 OPEN-QUESTIONS C5）。

2026-10-22 `dsh-input-assist` 作者在 #6313 给了更根本的诊断：他也没有 `compositionend` 代码，
可见性只对照 composer store 的 `draft/rev`，「画」和「撤」读同一对值，所以不存在晚一拍的窗口；
他认为我们那一下闪不是 IME 本身，而是**渲染与判定读了两份状态**。
0.1.4 因此在 0.1.2 的请求闸门之外，又在 `compositionstart` 时立即 `hide()` + abort
（异步结果画出来的灰字不能只等下一轮 store flush），并把组合期的 Tab 让给 IME（`isComposing` / 229）。
真实输入法逐帧复测仍是 C5。

### 3.2 不是同类，但会撞在同一块屏幕上：`dsh-input-assist`

[`dsh-input-assist`](https://github.com/deepseek-ai/deepseek-harness/discussions/6313)（`0.8.0`，2026-10-23）做的是**打字时的续写**
（Copilot 式、光标后内联、逐词 Tab、流式渐显），以及中英错别字检查；不是「回合结束后的下一句」。
两者场景基本不重叠：

| 时刻 | `dsh-input-assist` | `dsh-next-hint` |
| --- | --- | --- |
| 你正在打字 | 续写**这一句** | 不出（草稿非空） |
| 回合结束、框是空的 | 停笔 800ms 后出 | 出一整句**下一句** |

唯一重叠是「空框停笔」：可能同时看到两条 ghost。真撞上就关掉其中一个的开关 ——
一个管「把这句写完」，一个管「下一句说什么」。

0.8.0 已适配 DSH `0.2.1-rc.2`（`engines.dsh >=0.2.1-rc.2`），124 条测试；运行时依赖只剩
`@deepseek-ai/schemastery` 一个，`dsh-settings` / `cordis-plugin-loader` 已转为 type-only devDep。

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

### 4.8 首跑实测：灰字为什么「有时有、有时没有」

环境：DSH Desktop `0.2.1-rc.2`；另起一个隔离的 `web` profile（`dsh web --no-open --port <port>`，
`DSH_HOME` 指向临时目录），插件用 `link:` 装进去，用 headless Chrome + CDP 驱动真实会话。

观测手段（不靠猜）：

- 浏览器侧：`console.debug("[next-hint] …")` 与锚点上的 `data-next-hint-state`；
- 宿主侧：`204` 响应头 `x-next-hint-reason`。

结果（同一会话、四条普通回合）：

| 回合 | 结果 | 原因 |
| --- | --- | --- |
| 用一句话解释什么是栈 | `shown:11` | 正常 |
| 现在几点了 | `reply:204 empty` | 模型原样回了 `NONE`（base64 `Tk9ORQ`） |
| 谢谢 | `reply:204 empty` | 同上 |
| 给我一条整理桌面文件的建议 | `shown:20` | 正常 |

**根因不是客户端竞态，而是系统指令自己留的逃逸口**：`If nothing sensible follows, reply with the single word: NONE`。
短对话、寒暄、纯问答时模型频繁选择拒答；`cleanHint` 按约定把 `NONE` 丢掉 → `204 empty` → 没有灰字。

修复与复测：

1. 指令里删掉 `NONE`，改为「即使回合很短也要给一条具体的下一句」；
2. 收到空/拒答时用更严格的指令**再问一次**；
3. `max-tokens` 截断但有可用首行时照常采纳。

同一组提示词（含上文两条原本拒答的）复测 **4/4 都出灰字**。另外在同一环境确认：
新会话第一轮结束后 dock 槽位挂载并会补发一次请求；`Tab` 采纳会把整句写进草稿；一打字灰字立刻消失。

### 4.8.1 IME 组合期守卫（0.1.2）

按 `dsh-composer-prediction` 作者的建议：灰字在 IME 组合期一律不出现。
实现落在两处纯检查上，不新增监听器：

- `composerOf()` 读编辑器根上的 `data-composer-composing`，把 `composing` 带进结果；
- `snapshot()` 把该标记并进输入快照，`requestable()` 遇到 `composing === true` 直接返回 false。

于是请求闸门与「已画灰字是否仍有效」的检查都会在组合期关上，`compositionend` 之后由输入状态的自然发布会重新评估。
**尚未做的**：真实输入法下逐帧复测（正常提交 / 取消 / 直接按 Esc 三种结束），以及 Esc 关闭本身 —— C5 仍开着。

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
