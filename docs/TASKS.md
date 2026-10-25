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

> 2026-10 复核：H1 / H2 / H3 / C1 已用源码证据关闭（[RESEARCH](RESEARCH.md) `4.7），设计随之改为
> [AD-0004](adr/0004-client-triggered-request.md) / [AD-0005](adr/0005-rendering-seams.md)。
> 剩下的是「首跑才知道」的项，不必再单独立阶段 —— 跟着竖切一起关。

| # | 任务 | 产物 | 状态 |
| --- | --- | --- | --- |
| S-1 | H1 轮次结算事件 | 结论：宿主不再需要（AD-0004） | ✅ 关闭 |
| S-2 | H2 `ctx.llm` 辅助请求 | RESEARCH `4.7 #9 | ✅ 签名关闭，首跑留 M2 |
| S-3 | H3 宿主路由 | RESEARCH `4.7 #10 | ✅ 关闭 |
| S-4 | C1 客户端 facade | RESEARCH `4.7 #5 #6 | ✅ 签名关闭，首跑留 M2 |
| S-5 | C2 UI 放置 | AD-0005 | 🟡 改为「dock 观感实测」 |
| S-6 | 冻结 `src/contracts/` | `src/contracts/*.mjs` + 类型注释 | ⬜ 待做（契约已按 AD-0004 改） |
| S-7 | C4 Tab 与候选菜单的仲裁 | OPEN-QUESTIONS C4 | ⬜ 待做 |
| S-8 | H4 宿主按 sessionId 取上下文 | OPEN-QUESTIONS H4 | ⬜ 待做 |

## 阶段 2 · 竖切（四条泳道并行）

| 泳道 | 任务 | 产物 | 验收 |
| --- | --- | --- | --- |
| **host** | 路由 → 取样 → 生成 | `plugin/index.mjs`、`plugin/routes.mjs`、`src/{trigger,context,generate}.mjs` | `POST /api/next-hint` 能拿到一句话；失败路径返回 204 |
| **client** | 结算判定 → 建议条 → 采纳 | `plugin/client.js`、`src/watch.mjs` | 真实 GUI 里轮次结束后出现建议条，点击后草稿多出那句话 |
| **docs** | 把 spike 结论回填、写实现说明 | 对应文档 | 文档里没有「TODO 待验证」 |
| **tests** | 假宿主 + 假 LLM + 失败路径 | `tests/host/`、`tests/client/` | 覆盖率覆盖 `6 全部失效模式 |

并行前提：S-6 冻结完成；`host` 与 `client` 只通过契约通信，不互相 review 实现细节。

**2026-10 进度**：两条泳道的第一版已落地（`plugin/routes.mjs`、`plugin/client.js` 及其 `src/` 纯函数，43 条单测绿）。
剩下的是首跑验收：真机装一次、看 ghost 位置、确认 `deriveMessages()` 形状（H4）与 Tab 仲裁（C4）。

## 阶段 3 · 打磨

| 任务 | 泳道 | 验收 |
| --- | --- | --- |
| `Config`（schemastery）+ 设置项落地 | host | 设置页能改、重启后仍在 |
| i18n zh/en（含建议条 aria 文案） | client | 切语言即时生效 |
| 冷却 / 退避 / 成本上限 | host | 单测覆盖 |
| 无障碍与键盘（快捷键采纳、Esc 关闭） | client | 只用键盘可完成采纳 |
| 远端浏览器策略 | host | 单测 + 手工验证 |

## 阶段 3.5 · 社区经验吸收（2026-10-25）

| # | 任务 | 来源 | 状态 |
| --- | --- | --- | --- |
| S-9 | owner 鉴权（`connection.admit`，owner principal） | Stijnus 1.2.2 | ✅ 0.1.5 |
| S-10 | refused insertion 后隐藏 stale ghost | Stijnus 1.2.2 | ✅ 0.1.5 |
| S-11 | Esc 关闭 + 组合结束后重试 | Amir / Stijnus | ⬜ C5 |
| S-12 | 切回会话恢复灰字（按会话缓存） | Amir 0.7.x | ⬜ C6 |
| S-13 | 设置页（schemastery Config → UI） | 三家 | ⬜ |
| S-14 | npm 发布 + 自定义市场索引 | Stijnus / jabingu | ⬜ |
| S-15 | 多候选循环（Alt+↑/↓） | Stijnus 1.2.x | ⬜ |
| S-16 | 用量 / 费用统计 | jabingu 0.1.x | ⬜ |
| S-17 | 单一 draft 真值重构 | honlnk #6313 | ⬜ |
| S-18 | 预算下调（128→96 token；8000→4000 bytes） | jabingu / Amir | ⬜ |

## 阶段 4 · 发布

- [ ] CHANGELOG 按 Keep a Changelog 写
- [ ] `package.json` 去掉 `private`，版本 `0.1.0`
- [ ] 桌面端按 [RELEASE.md](RELEASE.md) 装一遍、更新一遍
- [ ] README 补截图与 GIF
- [ ] 市场提交（可选）
