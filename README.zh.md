# dsh-next-hint

> **状态：pre-alpha 脚手架。** 本仓库现在只有插件骨架、工程合同和调研笔记，
> 还没有功能实现。所有设计决定都归档在 [docs/](docs/README.md)。

一个 DeepSeek Harness 插件：**一轮对话结束后，在输入框里推荐下一句要问什么** ——
对标 Claude Code 的 prompt suggestions。采纳建议只是往草稿里写入一段可撤销的普通文本，
任何内容都不会在没有人点击的情况下被发出去。

## 为什么要做

本机 DSH（0.2.1-rc.2）没有这个能力；社区市场 142 个插件里也没有人做（调研日期见
[docs/RESEARCH.md](docs/RESEARCH.md)）。但缝合点是开着的：

- 输入框：`conversation.input.for(scope)` 返回的 facade 提供 `state.getSnapshot()`
  （草稿、`draftRev`、`phase`）与 `insertText(text, { start, end, draftRev })`；
- 宿主：`ctx.llm` 可以发一笔与主请求解耦的辅助请求（会话标题插件就是这么做的）；
- 通道：宿主半边可以注册自己的 HTTP 路由，把结果推给浏览器半边。

以上每一条都有可指认的出处，见 [docs/RESEARCH.md](docs/RESEARCH.md)。

## 形状

**双半包 cordis 插件**，与 [`dsh-session-surgeon`](https://github.com/xiaoshenming/dsh-session-surgeon) 同构：

```text
package.json          dsh.bundle.patch + dsh.client{platform,inject}
cordis.patch.yml      把条目插入 profile 花名册
plugin/index.mjs      宿主半边 —— 轮次结算、辅助 LLM 请求、路由
plugin/client.js      浏览器半边 —— 建议条、采纳写入输入框
src/                  纯逻辑，不碰 cordis，用 node:test 单测
docs/                 规划、调研、架构、合同、任务、ADR、发布
skills/               仓库内的「更新」技能，用于自我迭代
```

## 开发

```sh
node --test                 # 无需安装依赖，只用 node:test
```

本机请用随 DSH 分发的 node（PATH 里没有全局 node）：

```
C:\Users\123\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe
```

## 文档导航

| 文档 | 作用 |
| --- | --- |
| [PLAN.md](docs/PLAN.md) | 做什么、明确不做什么、里程碑 |
| [RESEARCH.md](docs/RESEARCH.md) | 已核实的缝合点、市场扫描、同类实现、来源 |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | 双半包、数据流、失效模式、配置 |
| [IMPLEMENTATION-CONTRACT.md](docs/IMPLEMENTATION-CONTRACT.md) | 硬约束与文件所有权（并行前必读） |
| [TASKS.md](docs/TASKS.md) | 分阶段任务与并行泳道 |
| [OPEN-QUESTIONS.md](docs/OPEN-QUESTIONS.md) | 进入编码前必须关闭的 spike |
| [TESTING.md](docs/TESTING.md) | 单测、假宿主、手工矩阵、CI |
| [RELEASE.md](docs/RELEASE.md) | 版本、发布、桌面端安装与更新 |
| [adr/](docs/adr/) | 已接受的决策记录 |

## 许可

MIT
