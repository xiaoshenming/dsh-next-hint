# 文档索引

按阅读顺序排列。**编码前必读 1、2、4、6。**

| # | 文档 | 什么时候读 |
| --- | --- | --- |
| 1 | [PLAN.md](PLAN.md) | 想确认「做什么 / 不做什么」 |
| 2 | [RESEARCH.md](RESEARCH.md) | 想确认「这个 API 真的存在吗」——每条都有出处 |
| 3 | [ARCHITECTURE.md](ARCHITECTURE.md) | 想改结构、加减模块 |
| 4 | [IMPLEMENTATION-CONTRACT.md](IMPLEMENTATION-CONTRACT.md) | 任何并行开发之前，以及每次提交之前 |
| 5 | [TASKS.md](TASKS.md) | 领取任务、看验收标准 |
| 6 | [OPEN-QUESTIONS.md](OPEN-QUESTIONS.md) | 当前阶段所有「还不知道」都在这里 |
| 7 | [TESTING.md](TESTING.md) | 写测试、跑回归、手工验证 |
| 8 | [RELEASE.md](RELEASE.md) | 发版本、发 npm、桌面端安装与更新 |
| 9 | [adr/](adr/) | 想知道某个决定为什么是这样 |

## 文档纪律

1. 结论写在文档里，出处写在结论旁边（包名 + 版本 + 文件 + 行号，或链接）。
2. 没有实测过的说法，一律进 [OPEN-QUESTIONS.md](OPEN-QUESTIONS.md)，不写进架构文档。
3. 决定变了就改 ADR，并在 CHANGELOG 里记一笔；不要留下两份互相矛盾的描述。
4. 文档用中文写，代码注释与提交信息用英文；README 中英各一份。
