# AD-0002 建议由辅助 LLM 请求生成

- 状态：已接受（2026-10）
- 相关：[ARCHITECTURE.md](../ARCHITECTURE.md) `2、[OPEN-QUESTIONS.md](../OPEN-QUESTIONS.md) H2

## 背景

两条路：① 规则/模板（「继续？」「要跑测试吗？」）；② 一次真实模型请求。

## 决策

走 ②，但**必须与主请求解耦**：独立一笔、独立 system instruction、独立超时与 token 上限、
可选独立路由；失败静默。参照 `@deepseek-ai/dsh-session-title-first-prompt-llm` 的成熟做法。

## 后果

- 好处：建议能贴合上下文（改哪个文件、哪个测试红了），模板做不到。
- 代价：每轮多花一次 token。用 `maxInputBytes` / `maxOutputTokens` / 冷却 / 「仅空闲时生成」四项控成本。
- 代价：迟到的结果必须被丢弃（`draftRev` / `turnId` 校验），否则会插到别的语境里。
- 不做：绝不复用主对话的上下文窗口发这笔请求；它是旁路，不参与主对话历史。
