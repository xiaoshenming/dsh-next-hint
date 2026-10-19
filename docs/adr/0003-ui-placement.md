# AD-0003 建议条的放置：DOM 注入优先

- 状态：已接受（2026-10），待 C2 实测确认
- 相关：[ARCHITECTURE.md](../ARCHITECTURE.md) `5、[OPEN-QUESTIONS.md](../OPEN-QUESTIONS.md) C2

## 背景

输入区域有三个官方槽位：`conversation.input.overlay`（候选菜单浮层）、
`conversation.input.activity`（模型选择器与发送键之间的单控件）、`conversation.composer`（整体接管）。

## 决策

首选 **DOM 注入**：在输入卡片上方插入一个 peer 节点，样式与无障碍完全自控；
若实测发现锚点不稳或几何跳变，退化到 `conversation.input.activity`。

理由：
- `conversation.input.overlay` 的语义是候选菜单（list kind），塞建议条是语义入侵，且会与 `/`、`@` 的键盘仲裁打架。
- `conversation.composer` 是临时接管，代价过大 —— 我们只是想说一句话。
- DOM 注入已被 `dsh-quote-followup` 在生产验证，且插件卸载时可以精确移除。

## 后果

- 代价：依赖宿主 DOM 结构，升级要跟（记入 RELEASE `5 的「跟随上游」清单）。
- 约束：注入节点不得改变输入卡片高度、不得抢焦点、必须 `aria-live="polite"`。
- 退出条件：官方若给出「输入框下方提示条」正式槽位，立即迁移。
