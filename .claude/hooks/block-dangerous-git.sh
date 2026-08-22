#!/bin/bash
# 拦截会丢掉工作区改动的 git 命令。
#
# 为什么存在: agent 曾把用户正在写的代码当成"无关污染", 用 git checkout 和
# git stash 抹掉两次。这类命令不经过 pre-commit hook, 只能在执行前拦。
#
# 判据是「会不会让用户的未提交改动消失」, 不是「是不是写操作」——
# git add / git commit 不在名单里, 它们不销毁任何东西。

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command')

DANGEROUS_PATTERNS=(
  # 远端与历史
  "git push"
  "push --force"
  "git reset --hard"
  "reset --hard"
  "git branch -D"
  # 丢弃工作区改动 —— 含指定路径的形式, agent 实际踩的就是这两个
  "git checkout --"
  "git checkout \."
  "git restore"
  "git clean -f"
  # 挪走别人的改动: 藏起来也是拿走
  "git stash"
)

for pattern in "${DANGEROUS_PATTERNS[@]}"; do
  if echo "$COMMAND" | grep -qE "$pattern"; then
    cat >&2 <<MSG
BLOCKED: '$COMMAND'
命中禁用模式 '$pattern'。

这条命令可能丢弃工作区里未提交的改动，而那些改动可能是用户正在写的代码。
你没有处置用户工作区的授权。

需要时请让用户自己执行，或改用不销毁数据的方式（如只 git add 你自己的文件）。
MSG
    exit 2
  fi
done

exit 0
