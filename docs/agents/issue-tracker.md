# Issue tracker: GitHub

这个 repo 的 issues 和 PRDs 存放在 GitHub issues 中 (`zoeymind/zoeymind-desktop`)。所有操作都使用 `gh` CLI。

## Conventions

- **Create an issue**: `gh issue create --title "..." --body "..."`. 多行 body 使用 heredoc。
- **Read an issue**: `gh issue view <number> --comments`；或直接 `read issue://<number>`。
- **List issues**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'`, 按需加 `--label` / `--state` filters。
- **Comment on an issue**: `gh issue comment <number> --body "..."`
- **Apply / remove labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **Close**: `gh issue close <number> --comment "..."`

从 `git remote -v` 推断 repo；在 clone 内运行时，`gh` 会自动处理。

## When a skill says "publish to the issue tracker"

创建一个 GitHub issue。

## When a skill says "fetch the relevant ticket"

运行 `gh issue view <number> --comments` 或 `read issue://<number>`。
