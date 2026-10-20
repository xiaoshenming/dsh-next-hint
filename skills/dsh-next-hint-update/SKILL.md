---
name: dsh-next-hint-update
description: |
  Self-iterate dsh-next-hint from community feedback. Use immediately when the user says 更新, 更新插件, 更新一下插件, 自我迭代, 逛逛社区, 再看看社区, 补扫社区, 看多一点, 查社区然后更新, update the plugin, or asks to scan DeepSeek Harness discussions and update this plugin without spelling out the steps. Also use when they want a changelog, a reply on relevant threads, and a push to origin/main. Do not use for installing the plugin (that is Settings → Plugins) or for unrelated DSH bugs.
---

# 更新插件 — dsh-next-hint 自我迭代

仓库：本文件向上两级（仓库根）；远程 `xiaoshenming/dsh-next-hint` 的 `main`。
默认简体中文。用户只说「更新」时不要再问流程，直接跑完整条。

技能索引不扫已装插件的包内目录：agent 用 `read` 直接读本文件，或把它链到用户技能根
（`~/.dsh/skills/dsh-next-hint-update`）。

## 0. 先看仓库状态（30 秒）

```sh
git status --short
git log --oneline -3
git rev-parse --short HEAD origin/main   # 推之前确认有没有落后
```

工作区可能带着用户自己的未提交改动：**不要 `git add -A` 一把混进功能提交**。
先 `git diff --stat` 分清哪些是自己的。

## 1. 阶段闸门

先读 `docs/OPEN-QUESTIONS.md`：

- 有未关闭的 spike → **不改功能代码**，只做调研与文档回填。
- 全部关闭 → 才允许进 `docs/TASKS.md` 的并行泳道，并遵守 `docs/IMPLEMENTATION-CONTRACT.md` 的文件所有权。

## 2. 扫社区

1. `github.com/xiaoshenming/dsh-next-hint` 的 issues / PR / Discussions（有新仓库后才有）。
2. `dsh-market.com/manifest/plugins.json` —— 看是否出现同类插件；有就做**差异对比**，写进 `docs/RESEARCH.md` `3。
3. DSH 官方仓库的 Discussions / Releases —— 官方是否已经内置该能力（内置了就转成「迁移指南 + 停用计划」）。
4. 用户自己的反馈渠道。

**只回真正对口、尚未说过的帖**；不做刷屏式硬广。

## 3. 判断该不该改

| 反馈 | 动作 |
| --- | --- |
| 崩溃 / 越界 / 隐私问题 | 最高优先级，当天修 |
| 建议质量差 | 先看是取样问题还是 prompt 问题，改 `src/context.mjs` / `src/generate.mjs` 的对应一侧 |
| 想要新配置 | 先问「能不能不加配置」，确实必要才加，且必须有默认值 |
| 想要自动发送 | 拒绝（见 PLAN `2） |

## 4. 改 / 测

```sh
node --test
```

- 新逻辑必须有单测；失败路径同样。
- 单文件 ≤300 行；不许新增依赖。
- 用户可见字符串走 i18n。

## 5. 收尾

1. `CHANGELOG.md` 在 `## [Unreleased]` 下按 Added / Changed / Fixed 记一笔。
2. 改版本号：加了用户可见能力 → minor，只修 bug → patch。
3. 更新受影响的文档（架构变了还要加 ADR）。
4. 提交（不改全局 git 配置；作者与仓库既有提交一致）：
   ```sh
   git -c user.name=xiaoshenming -c user.email=xiaoshenming@users.noreply.github.com commit -m "<type>(<scope>): <english subject>"
   git push origin main
   gh run list --repo xiaoshenming/dsh-next-hint --limit 1   # CI 必须绿
   ```
5. 回帖只发在对口的帖（自己的发布帖 / 有人提问的帖）；已经有准确答复的帖不再补刀。
6. 本地桌面端在「设置 → 插件 → 本插件 → 更新」验证一遍；用中文汇报：扫了什么、改了什么、
   怎么验证的、还没做什么。

## 合同（不可破）

- 不引入运行时依赖；`@deepseek-ai/*` 只进 `peerDependencies`。
- 不改官方源码、不 patch `.asar`。
- 不自动发送任何消息。
- 不把真实会话原文、密钥、绝对路径提交进 git。
- 不把 `dsh-ecosystem-spec` / 任何社区 TUI 规范当官方 Web 插件 ABI；只以官方包的实际导出与 README 为准。
