# References 同步流程

## 当前状态（2026-09-17）
- 14 个 references 文件已 commit 到 demo 仓库 `references/` 目录
- Commit: e502b369410dcfed1882e57184c67727a6bf6143
- 来源：飞书云端（架构文档 ZDaAdGuh0oLOdcxNlUscJ2uZnzD + 验收场景 U7rqbqMlbo8DO9xOIjncIU50nkf + 项目进度 NBbIbIDuroSLq2xKkg1c2aEBnwg + mvp-package-v1.zip）

## 下次同步流程

飞书云端文档更新后，重新跑 sync 脚本即可覆盖：

```bash
# 1. 在 chat 侧用 lark-cli 拉取最新云端内容到 references/ 目录

# 2. 在 demo 仓库根目录运行
GH_TOKEN=<your-pat> ./references/sync-references-to-github.sh "feat(references): 同步到 v2"
```

## 维护说明

- **谁运行**：chat 侧（陈子架构师工作伙伴）/ Codex（任何有 GH_TOKEN 的人）
- **触发**：架构文档 / 验收场景 / MVP package 任意一个更新后
- **不要**：手动改 references/ 下的文件 —— 所有来源是飞书云端，仓库是镜像
