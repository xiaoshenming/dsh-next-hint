# 测试

## 1. 分层

| 层 | 位置 | 测什么 | 依赖 |
| --- | --- | --- | --- |
| 契约 | `tests/contracts/` | 纯函数签名与不变量（`trigger` / `context`） | 无 |
| 宿主 | `tests/host/` | 取样裁剪、失败分类、缓存失效、冷却 | 假 `ctx.llm`、假时钟 |
| 客户端 | `tests/client/` | 建议流的去重与失效、植入前的 `draftRev` 检查 | 假 `input` facade |
| 冒烟 | `tests/smoke.test.mjs` | 清单自洽、两个半边形状、patch 只插一次 | 无 |

一切用 `node:test`。**不引入任何测试框架依赖。**

## 2. 必须覆盖的失败路径

- 没有可用路由
- 请求超时
- 429 / 限额
- 模型返回非 JSON、JSON 缺字段、hint 为空、hint 超长
- `draftRev` 在采纳前变化
- 同一会话连续两轮（不得重复生成同一轮的建议）
- 插件卸载（订阅与定时器全清）

## 3. 假宿主

宿主半边只依赖注入进来的东西，因此单测里给它：

```js
const fakeCtx = {
  llm: { request: async () => ({ text: JSON.stringify({ hint: "要不要先跑一下测试？" }) }) },
  logger: { warn() {}, info() {} },
  effect: (fn) => { disposers.push(fn); },
};
```

**禁止**在单测里连真实模型、真实网络、真实 `~/.dsh`。

## 4. 手工验证矩阵（每次发版前）

| 场景 | 期望 |
| --- | --- |
| 普通一轮结束，草稿为空 | 出现建议，不闪、不跳 |
| 草稿非空 | 不出现建议 |
| 建议出现后开始打字 | 建议立即消失 |
| 点建议 | 草稿追加该句，光标在句末，Ctrl+Z 可撤 |
| 切换会话 | 上一会话建议不串台 |
| 断网 | 无建议、无弹窗 |
| 停用插件 | DOM/请求/监听全清 |
| 远端地址访问 | 不渲染建议 |

## 5. CI

`.github/workflows/ci.yml`：Node 22.19 与 24 各跑一次 `node --test`。
本机没有 `npm`，本地验证一律：

```sh
"C:\Users\123\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe" --test
```
