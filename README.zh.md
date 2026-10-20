# dsh-next-hint

> 一轮对话结束，输入框里自己浮出一句「接下来可以问什么」。**Tab 采纳，绝不自动发送。**

DeepSeek Harness 插件。对应 Claude Code / Claude Desktop 那种「回合结束后给下一步建议」的体验 ——
只不过建议是**灰字**，落在你自己的输入框里，看得见、可撤销、不替你按回车。

```text
┌────────────────────────────────────────────────────────────┐
│ 顺便把失败的那两个用例也修了                    Tab 采纳    │  ← 回合结束时浮出的灰字
└────────────────────────────────────────────────────────────┘
                     ↑ 草稿为空时才出现；你一打字它就消失
```

## 为什么值得装

- **它懂你刚才在干嘛。** 建议由一笔**独立的辅助请求**生成，读的是这个会话最近几轮的真实内容
  （改的是哪个文件、哪个测试红了、停在哪一步），不是「继续？」这种模板。
- **它不碰你的回车。** 采纳 = 往草稿里插入一段普通文本。`Ctrl+Z` 能撤回，发不发由你决定。
  代码里根本没有「发送」这条路径。
- **它很安静。** 没有可用路由、模型超时、被限流、输出不合规、你今天不想看到它 ——
  一律**没有灰字**，也不弹任何错误。日志里最多一条 warn。
- **它不把你的对话发出去。** 浏览器只发一个 `sessionId`；会话内容由宿主在本机进程内读一次，
  不落盘、不进日志、不出进程边界。

## 安装

**DSH 桌面端**：设置 → 插件 → 添加 git 包

```text
github:xiaoshenming/dsh-next-hint#main
```

CLI 等价写法：

```bash
dsh plugin --profile desktop add "github:xiaoshenming/dsh-next-hint#main"
```

装完**重启一次应用**（插件在启动时进花名册）。更新同理：在插件页点更新，或

```bash
cd ~/.dsh/profiles/desktop && pnpm update dsh-next-hint
```

## 怎么用

| 时刻 | 你会看到 |
| --- | --- |
| 一轮结束、输入框是空的 | 第一行浮出一句灰字 + 右端 `Tab 采纳` |
| 光标在输入框里，按 `Tab` | 整句写进草稿，光标落在句末，**不发送** |
| 你开始打字 | 灰字立刻消失 |
| 切到别的会话 | 灰字跟着清掉 |
| 模型两次都没给出建议 / 超时 / 没配路由 | 什么都没有（这就是正确行为） |

模型偶尔会想回一句「没什么可建议的」。插件不会就此作罢：它立刻用更严格的指令**再问一次**，
两次都不给才安静下来 —— 一次拒答不该让整轮空着。

Tab 只在「没有别的候选菜单占用它」时生效 —— `/`、`@` 菜单打开时，Tab 仍然是菜单的键。

## 配置

设置 → 插件 → dsh-next-hint。全部有默认值，不配也能用。

| 键 | 默认 | 说明 |
| --- | --- | --- |
| `enabled` | `true` | 总开关 |
| `provider` / `model` | 空 | 空 = 跟随会话最近一次请求的路由；要指定就两个一起给 |
| `locale` | `auto` | 建议用哪种语言写 |
| `maxTurns` | `3` | 采样最近几轮 |
| `maxInputBytes` | `8000` | 送进辅助请求的字节上限 |
| `maxOutputTokens` | `128` | 输出 token 上限 |
| `maxHintChars` | `48` | 建议长度上限（超出截断，跑偏成一段话就整条丢弃） |
| `timeoutMs` | `15000` | 单次调用超时 |
| `perSessionCooldownMs` | `0` | 每会话冷却；默认每轮都给 |

## 它是怎么做的

双半包 cordis 插件，与 [dsh-session-surgeon](https://github.com/xiaoshenming/dsh-session-surgeon) 同构：

```text
浏览器  session.running 由真变假 ∧ 草稿为空
          └─ POST /api/next-hint  { sessionId }        ← 只发 id，不发原文
宿主      loopback + 同源校验 → 单飞 + 冷却
          └─ ctx.sessions.get(id).deriveMessages()      ← 最近几轮文本
          └─ ctx.llm.prepareCall(...)                   ← 一笔独立请求，最低推理档
          └─ 200 { hint } / 204（静默，带 x-next-hint-reason）
浏览器  在输入框第一行画灰字 → Tab → input.actions.captureInsertion() + insertText()
```

几个刻意为之的地方：

- **判定在浏览器，生成在宿主。** 「草稿空不空、人是不是正在打字、现在看的是哪个会话」只有浏览器知道；
  让宿主去猜只会猜错两遍。
- **一次请求-响应，没有 SSE、没有长连接、没有服务端缓存。** 取消就是 `AbortController.abort()`。
- **UI 走官方槽位 `conversation.composer.dock`**，灰字节点自己画（官方没有开放行内 hint 的写入口）。
  卸载时 DOM、监听器、在飞请求一起还回去。
- **辅助请求跟会话标题插件同一套路**：独立 system instruction、独立超时、最低推理档，
  失败不影响主对话。

## 同类

社区里有两个相关插件，**都不是同款，但会撞在同一块屏幕上**：

- **思路相同**：[Composer predictions（`dsh-composer-prediction`）](https://github.com/deepseek-ai/deepseek-harness/discussions/10053)。
  两边都是「回合结束 → 一笔辅助请求 → 灰字 → Tab 采纳」，差异在接缝（它挂 overlay 槽位、自带配置页、
  按会话缓存建议、Esc 关闭；我们走官方 dock 槽位 + 宿主无状态的一次 POST）。
  **别同时装**：会画出两条重叠建议，还每轮多花一笔调用。
- **场景互补**：[输入补全（`dsh-input-assist`）](https://github.com/deepseek-ai/deepseek-harness/discussions/6313)。
  它管「你正在打字的这一句」的续写与错别字，我们管「回合结束后的下一句」。
  只有「空框停笔」时可能同时看到两条 ghost，真撞上就关掉其中一个的开关。

## 兼容性

- 实测环境：**DSH Desktop `0.2.1-rc.2`（Windows）** 与同版本的 **web profile（macOS）**。宿主半边依赖 `ctx.llm` / `ctx.sessions` /
  `ctx.webServer.register`；浏览器半边依赖 `conversation.composer.dock` 槽位与输入框 facade。
- 版本仍是 `0.x`：上游一旦改这些缝，灰字可能先坏。灰字定位依赖编辑器 DOM 的
  `[data-input-scroll]` 结构，找不到锚点时会安静地不出。
- 远端（非 loopback）来源会被路由直接拒绝。
- 官方哪天内置了这能力，本插件可以干净停用 —— 我们不假设「只有我能写输入框」。

## 开发

```bash
node --test      # 49 条，只用 node:test，零运行时依赖
```

纯逻辑在 `src/`（不 import cordis、不 import 官方包、不碰 DOM），接缝在 `plugin/`。
设计决定与实测证据都在 [docs/](docs/README.md)：从 [RESEARCH.md](docs/RESEARCH.md) 的
逐行出处，到 [ARCHITECTURE.md](docs/ARCHITECTURE.md) 的数据流与失效模式。

## 许可

MIT
