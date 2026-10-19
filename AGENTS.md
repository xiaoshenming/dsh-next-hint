# 仓库约定（给所有 agent）

本文件对任何在本仓库工作的 agent 生效，先于个人习惯。

## 必读顺序

1. `docs/PLAN.md` — 做什么、明确不做什么
2. `docs/IMPLEMENTATION-CONTRACT.md` — 硬约束 + 文件所有权（并行前必读）
3. `docs/OPEN-QUESTIONS.md` — 当前还有哪些「不知道」；**不要绕过未关闭的 spike 写功能**
4. `docs/ARCHITECTURE.md` — 结构

## 语言

- 文档、CHANGELOG、issue 回复：简体中文。
- 代码注释、提交信息、标识符：英文。
- 用户可见字符串：走 i18n（zh / en）。

## 环境（本机实测）

| 用途 | 命令 |
| --- | --- |
| 跑测试 | `"C:\Users\123\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe" --test` |
| pnpm（需要时） | `node "C:\Users\123\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\pnpm\bin\pnpm.mjs"` |
| git | 可用（2.55） |

本机**没有** `npm` / `gh`；`pwsh` 工具当前报 `powershell.exe ENOENT`。
所以：自动化一律写成 node 脚本，不要依赖 shell 或 powershell 的语法。

## 并行开发规则

- 一条泳道 = 一个 worktree（`../dsh-next-hint-wt/<lane>`）+ 一个分支（`feat/<lane>`）。
- 只写 `docs/IMPLEMENTATION-CONTRACT.md` `3 里自己名下的文件。
- 跨泳道只认 `src/contracts/` 里的冻结接口；要改契约先改文档 + 加 ADR。
- 提交前自查：`git diff --name-only` 是否越界、`node --test` 是否绿。

## 提交

Conventional Commits，英文：

```text
feat(host): subscribe to turn settlement
fix(client): drop a hint whose draft revision moved
docs: close spike H2 with measured evidence
```

## 「更新」技能

本仓库自带自我迭代技能 `skills/dsh-next-hint-update/SKILL.md`。
用户说「更新 / 更新插件 / 自我迭代 / 逛逛社区」时，加载它并按其步骤执行：
扫社区 → 判断该不该改 → 改/测/CHANGELOG → 对口回复 → 推送 → 中文汇报。

DSH 的技能索引**不扫已装插件的包内目录**，所以要么让 agent 直接 `read` 这个文件，
要么把它链到用户技能根：`~/.dsh/skills/dsh-next-hint-update`。

## 禁止

- 改 `package.json` / `cordis.patch.yml`（主控独占）。
- 引入运行时依赖。
- 把 `@deepseek-ai/*` 写进 `dependencies`。
- 在 `src/` 里 import cordis 或 DOM。
- 自动发送消息、自动点击发送键。
- 提交真实会话原文、密钥、绝对路径到 git。
