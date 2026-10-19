# src/ — 纯逻辑

这一层是**没有 cordis、没有 DOM、没有官方包 import** 的纯函数与数据结构。
宿主半边与浏览器半边都从这里取逻辑，因此它必须先被测试、后被人依赖。

## 冻结时间表

| 文件 | owner | 何时出现 |
| --- | --- | --- |
| `contracts/` | 主控 | M1 结束（spike S-6） |
| `trigger.mjs`（要不要给建议） | host | M2 |
| `context.mjs`（取样与裁剪） | host | M2 |
| `generate.mjs`（辅助请求的拼装与解析） | host | M2 |
| `store.mjs`（按会话缓存与失效） | host | M2 |
| `feed.mjs`（浏览器侧订阅） | client | M2 |

> 现在这里是空的，这是**故意的**：M1 的 spike 没关之前，写进来的都是猜。
