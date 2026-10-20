# 发布与安装

## 1. 版本

- SemVer。`0.x` 期间：加了用户可见能力 → minor；只修 bug → patch。
- `CHANGELOG.md` 按 Keep a Changelog，`## [Unreleased]` 永远在最上面。
- 提交前把 `dsh.engines.dsh` 与实测过的 DSH 版本对齐（写在 README 顶部）。

## 2. 首发检查表

1. `package.json`：去掉 `private`，版本改 `0.1.0`，补 `repository` / `homepage` / `bugs`。
2. `node --test` 全绿。
3. 桌面端按 `3 装一遍，走一遍 [TESTING.md](TESTING.md) `4 的手工矩阵。
4. `README.md` / `README.zh.md` 补截图（建议条 + 采纳后）。
5. git tag `v0.1.0`，push 到 `main`。

## 3. 安装（DSH Desktop）

```
设置 → 插件 → 添加：github:<owner>/dsh-next-hint#main
```

CLI 等价物**只适用于自管 profile**（桌面 profile 由应用独占，CLI 会拒绝 `--profile desktop`）：

```sh
dsh plugin --profile web add "github:<owner>/dsh-next-hint#main"
```

装出来的是一份**没有 .git 的拷贝**（pnpm 从 codeload 解出来的 tarball），因此：

- **用户侧更新** = 设置 → 插件 → 本插件 → 更新（官方 in-process manager 重新解析 `#main`）；通常热更新，没生效就重启一次。
- 本地开发 = `link:` 指向 checkout，改完重启 Web GUI。

## 4. 本地开发闭环

```sh
# 在 profile 里链接本地 checkout（只做一次）
cd ~/.dsh/profiles/desktop
pnpm add "link:D:/project/chap2/dsh-next-hint"
# 重启 DSH / 重开 Web GUI 窗口
```

> 本机没有全局 pnpm，用随运行时分发的那份：
> `node "C:/Users/123/.dsh/dsh-runtimes/dsh-primary-runtime/dependencies/pnpm/bin/pnpm.mjs"`

## 5. 跟随上游（每次 DSH 升级后必看）

| 依赖的 seam | 出处 | 失效信号 |
| --- | --- | --- |
| `conversation.input.for(scope)` | `dsh-client-ui-conversation` | 采纳无效 / facade 不存在 |
| `sessions.binding(id).ctx` | 客户端 `sessions` 服务 | 拿不到 scope |
| 宿主轮次结算事件 | 宿主 session 事件 | 建议不再触发 |
| `webServer` 路由 | `dsh-session-surgeon` 已验证 | 路由 404 |
