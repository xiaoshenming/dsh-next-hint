# Contributing

1. 读 `docs/IMPLEMENTATION-CONTRACT.md`，确认你要改的文件归属哪条泳道。
2. 从 `main` 开分支：`feat/<lane>`，在独立 worktree 里干活。
3. 新逻辑必须带 `node:test` 单测；失败路径同样要有。
4. `node --test` 绿了再提 PR。不引入任何依赖。
5. PR 描述写清：改了什么、为什么、怎么验证的（贴一条实测命令与输出）。

约定细节（提交信息、语言、禁止事项）见 `AGENTS.md`。
