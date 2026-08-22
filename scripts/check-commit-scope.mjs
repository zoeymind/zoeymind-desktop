#!/usr/bin/env node
/**
 * check-commit-scope.mjs —— commit-msg 阶段检查, 拦截明显的多目的 commit.
 *
 * 单一职责原则: 一个 commit 只解决一件事. 多个功能/修复混在一起会让
 *   - 代码审查视线分散
 *   - revert 变粗粒度 (想撤 A 必须连 B 一起)
 *   - bisect 无法定位是哪块引入的
 *
 * 只看 commit message 的 subject (第一行), 因为标题最直接暴露作者是否把
 * 多件事捆一起. body 里的 bullet 是解释, 允许列多点; 单个功能可以有很多细节.
 *
 * 拦截信号 (subject line):
 *   1. ' + '   —— 用加号把两件事列出来 (最强信号)
 *   2. ' & '   —— 同义
 *   3. ' 和 '  —— 中文并列
 *   4. ' 与 '  —— 中文并列
 *   5. '、' 出现在 subject 里 (不在括号内的 scope)
 *   6. 多个 Conventional Commit 类型: 一行里出现 >= 2 个
 *      feat/fix/chore/refactor/docs/perf/test/build/ci/style
 *
 * 例:
 *   BAD:  feat(diff-view): 编辑器 diff 可视化 + 软删除 + fs 竞态修复
 *   GOOD: feat(diff-view): 编辑器 diff 可视化
 *
 * 绕过 (谨慎): git commit --no-verify
 * 例外: revert commit / merge commit 直接放行 (格式由 git 生成).
 */
import fs from "node:fs"

const MULTI_MARKERS = [
  { pattern: /\s\+\s/, describe: "subject 出现 ' + ': 用加号并列多件事" },
  { pattern: /\s&\s/, describe: "subject 出现 ' & ': 用与号并列多件事" },
  { pattern: /\s和\s/, describe: "subject 出现 ' 和 ': 中文并列" },
  { pattern: /\s与\s/, describe: "subject 出现 ' 与 ': 中文并列" },
]

const CC_TYPES = [
  "feat",
  "fix",
  "chore",
  "refactor",
  "docs",
  "perf",
  "test",
  "build",
  "ci",
  "style",
]

function stripScope(subject) {
  // 把括号里的 scope 挖掉 (scope 里的 、 是合法的, 不算并列)
  return subject.replace(/\([^)]*\)/g, "")
}

function main() {
  const msgFile = process.argv[2]
  if (!msgFile) {
    process.stderr.write("用法: check-commit-scope.mjs <commit-msg-file>\n")
    process.exit(1)
  }
  const raw = fs.readFileSync(msgFile, "utf8")
  // 剔除注释行 (# 开头 git 自动加的说明), 首行拿到 subject
  const lines = raw.split("\n").filter(line => !line.startsWith("#"))
  const subject = lines[0] ?? ""

  // 特例放行: revert / merge / fixup / squash 的自动格式
  if (
    /^revert\s/i.test(subject) ||
    /^merge\s/i.test(subject) ||
    /^fixup!/i.test(subject) ||
    /^squash!/i.test(subject)
  ) {
    return
  }

  const withoutScope = stripScope(subject)
  const violations = []

  for (const rule of MULTI_MARKERS) {
    if (rule.pattern.test(withoutScope)) violations.push(rule.describe)
  }

  // 中文顿号: 只有 scope 外的才算 (scope 内允许)
  if (/、/.test(withoutScope)) {
    violations.push("subject 出现 '、' (scope 外): 中文并列多件事")
  }

  // 多个 CC 类型出现在 subject 里
  const typePattern = new RegExp(`\\b(${CC_TYPES.join("|")})\\b`, "gi")
  const typeHits = subject.match(typePattern) ?? []
  if (typeHits.length >= 2) {
    violations.push(
      `subject 出现 ${typeHits.length} 个 Conventional Commit 类型 (${typeHits.join(", ")}): ` +
        "一个 commit 应该只有一个类型"
    )
  }

  if (violations.length === 0) return

  process.stderr.write("\nBLOCKED: commit 违反单一职责原则.\n\n")
  process.stderr.write(`  subject: ${subject}\n\n`)
  for (const msg of violations) {
    process.stderr.write(`  · ${msg}\n`)
  }
  process.stderr.write(
    "\n请把这个 commit 拆成多个独立 commit, 每个只解决一件事:\n" +
      "  git reset HEAD^  (如果已经在 amend / 用 -m 直接提交, 先撤)\n" +
      "  git add -p       (交互式选块)\n" +
      "  git commit -m '...'\n\n" +
      "绕过 (需在 commit-checklist 记录理由): git commit --no-verify\n\n"
  )
  process.exit(1)
}

main()
