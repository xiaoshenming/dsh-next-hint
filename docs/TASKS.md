# 任务与并行泳道

> 一个任务 = 一个可验收的产物。没有验收标准的不叫任务，叫想法。
> 泳道与文件所有权一一对应，见 [IMPLEMENTATION-CONTRACT.md](IMPLEMENTATION-CONTRACT.md) `3。

## 阶段 0 · 脚手架（已完成）

- [x] 仓库骨架、双半包占位、`cordis.patch.yml`
- [x] 文档体系（PLAN / RESEARCH / ARCHITECTURE / CONTRACT / TASKS / TESTING / RELEASE / ADR）
- [x] 冒烟测试：清单自洽 + 两个半边形状正确
- [x] CI（Node 22.19 / 24 双跑）

## 阶段 1 · Spike（串行，主控自己跑）

**不许并行**：这一阶段的结论会改架构，并行只会返工。

| # | 任务 | 产物 | 验收 |
| --- | --- | --- | --- |
| S-1 | 关闭 H1（轮次结算事件） | RESEARCH `4.7 新增一节 | 事件名 + 服务名 + payload + 3 行示例 |
| S-2 | 关闭 H2（`ctx.llm` 辅助请求） | 同上 | 一次真实请求跑通 + 失败分类 |
| S-3 | 关闭 H3（宿主路由） | 同上 | `curl` 拿到 JSON 与 SSE |
| S-4 | 关闭 C1（客户端 facade） | 同上 | `insertText` 实测成功 |
| S-5 | 关闭 C2（UI 锚点） | AD-0003 更新 | 三方案实测结论 |
| S-6 | 冻结 `src/contracts/` | `src/contracts/*.mjs` + 类型注释 | 四条契约可被 import 且无实现 |

## 阶段 2 · 竖切（四条泳道并行）

| 泳道 | 任务 | 产物 | 验收 |
| --- | --- | --- | --- |
| **host** | 结算 → 取样 → 生成 → 缓存 → 路由 | `plugin/index.mjs`、`plugin/routes.mjs`、`src/{trigger,context,generate,store}.mjs` | 宿主日志里能看到「生成了建议」；路由返回该建议 |
| **client** | 建议流 → 建议条 → 采纳 | `plugin/client.js`、`src/feed.mjs` | 真实 GUI 里出现建议条，点击后草稿多出那句话 |
| **docs** | 把 spike 结论回填、写实现说明 | 对应文档 | 文档里没有「TODO 待验证」 |
| **tests** | 假宿主 + 假 LLM + 失败路径 | `tests/host/`、`tests/client/` | 覆盖率覆盖 `6 全部失效模式 |

并行前提：S-6 冻结完成；`host` 与 `client` 只通过契约通信，不互相 review 实现细节。

## 阶段 3 · 打磨

| 任务 | 泳道 | 验收 |
| --- | --- | --- |
| `Config`（schemastery）+ 设置项落地 | host | 设置页能改、重启后仍在 |
| i18n zh/en（含建议条 aria 文案） | client | 切语言即时生效 |
| 冷却 / 退避 / 成本上限 | host | 单测覆盖 |
| 无障碍与键盘（快捷键采纳、Esc 关闭） | client | 只用键盘可完成采纳 |
| 远端浏览器策略 | host | 单测 + 手工验证 |

## 阶段 4 · 发布

- [ ] CHANGELOG 按 Keep a Changelog 写
- [ ] `package.json` 去掉 `private`，版本 `0.1.0`
- [ ] 桌面端按 [RELEASE.md](RELEASE.md) 装一遍、更新一遍
- [ ] README 补截图与 GIF
- [ ] 市场提交（可选）
