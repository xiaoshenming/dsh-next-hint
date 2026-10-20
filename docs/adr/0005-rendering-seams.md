# AD-0005 渲染：槽位优先，行内 ghost 作为皮肤

- 状态：已接受（2026-10），取代 [AD-0003](0003-ui-placement.md)
- 相关：[ARCHITECTURE.md](../ARCHITECTURE.md) `5、[OPEN-QUESTIONS.md](../OPEN-QUESTIONS.md) C2 C4

## 背景

AD-0003 首选 DOM 注入，因为当时只知道三个槽位。复核 `dsh-client-ui-conversation@0.2.1-rc.2` 的 `conversation.composer.bar` 声明后，可选项多了两个，而且语义比原来那三个更贴：

| 槽位 | kind / scope | 实际位置（源码） | 判断 |
| --- | --- | --- | --- |
| `conversation.composer.dock` | list / session | 输入卡**下方**那一行，与上下文占用环同排 | **M1 首选**：公开、零 DOM 依赖 |
| `conversation.input.overlay` | list / session | 卡片顶边的绝对定位浮层，`/`、`@` 菜单住这里 | 不用：抢浮层与键盘仲裁 |
| `conversation.input.activity` | single / session | 模型位与发送键之间的单控件，展开会占满工具条 | 备选：太小，装不下一句话 |
| `conversation.composer` | chain | 临时接管整个输入框 | 不用：代价过大 |

另一个发现：输入框**已经有行内 ghost 机制** —— `.input p:last-child:after { content: var(--dsh-composer-hint) }`，
只有「已认领的 `/命令`」能设置这个 CSS 变量，官方没有开放写入口。它证明行内灰字是官方已接受的视觉语言，但也说明我们想要那种观感只能自己画。

## 决策

1. **M1 用 `conversation.composer.dock`**：官方槽位、不碰 DOM、卸载即净。
2. **M2 再加「行内 ghost」皮肤**：一个脱离 React 树的绝对定位节点，贴到编辑器末行；锚点找不到就静默退回 M1。
3. 数据源与生成链路只有一份，两个渲染器可切换 —— 观感升级不改引擎。

## 后果

- 好处：M1 几乎没有上游耦合，可以先把「生成 → 展示 → 采纳」跑通，再谈像素。
- 代价：M1 的位置在输入卡**下方**，不是 Claude 那种「输入框里的灰字」。
- 代价：M2 依赖 Lexical 的 DOM 结构，宿主改版要跟（记入 RELEASE 的「跟随上游」清单）。
- 退出条件：上游若开放 hint 写入口（哪怕只是 `input.setHint(text)`），M2 立即改用官方 API 并删除自定义节点。
