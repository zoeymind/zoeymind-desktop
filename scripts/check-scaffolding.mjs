#!/usr/bin/env node
/**
 * check-scaffolding.mjs —— pre-commit 阶段扫描 staged diff, 拦截调试脚手架残留.
 *
 * 只看 `git diff --cached` 里的**新增行** (以 `+` 开头, 但不含 `+++` 元数据).
 * 已存在的代码不管, 避免把老代码合并成噪音.
 *
 * 命中即 exit 1, 并把 file:line 打给 stderr; 用户可以 --no-verify 绕过.
 *
 * 触发规则 (每条独立):
 *   1. console.log / console.debug     — 忘删的临时打印
 *   2. debugger                        — 忘删的断点
 *   3. .only 挂在 describe/it/test     — 会静默跳过其他用例
 *   4. throw new Error("...")          — 里带 "not implemented" / "todo" /
 *                                       "unimplemented" / "xxx" 的占位实现
 *
 * 排除文件:
 *   - Markdown / MDX (.md, .mdx) — 文档里 TODO 合法
 *   - 构建产物: dist, target, node_modules
 *   - 本脚本自身 (否则会命中自己里的规则示例)
 *
 * 用法:
 *   node scripts/check-scaffolding.mjs
 *   USER_CONFIRMED=1 pnpm exec husky ... 时也走这一步 (由 pre-commit 触发).
 */
import { execFileSync } from "node:child_process"

const rules = [
  {
    id: "console-scaffold",
    pattern: /\bconsole\.(log|debug)\s*\(/,
    describe: "console.log / console.debug (临时打印, 请删除或改 logger.*)",
  },
  {
    id: "debugger-statement",
    pattern: /(?:^|;|\s)debugger\s*(?:;|$)/,
    describe: "debugger 断点语句 (请删除)",
  },
  {
    id: "test-only",
    pattern: /\b(describe|it|test)\.only\s*\(/,
    describe: ".only 会静默跳过其他用例; 请删除或改回普通的 describe/it/test",
  },
  {
    id: "throw-placeholder",
    pattern:
      /throw\s+new\s+Error\s*\(\s*["'`][^"'`]*\b(not\s+implemented|unimplemented|todo|fixme|xxx)\b/i,
    describe: "throw new Error 里带占位符 (TODO/not implemented 等), 请给出真实实现",
  },
]

const excludeFile = (path) => {
  if (path === "scripts/check-scaffolding.mjs") return true
  if (path.endsWith(".md") || path.endsWith(".mdx")) return true
  if (path.startsWith("dist/") || path.includes("/dist/")) return true
  if (path.startsWith("target/") || path.includes("/target/")) return true
  if (path.startsWith("node_modules/") || path.includes("/node_modules/")) return true
  return false
}

/**
 * 解析 `git diff --cached --unified=0` 的输出, 提取每个新增行的 (file, line, text).
 * 只关心 `+` 开头的行 (排除 `+++` 元数据).
 */
function collectAdditions() {
  const diff = execFileSync(
    "git",
    ["diff", "--cached", "--unified=0", "--no-color", "--diff-filter=ACMR"],
    { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }
  )
  const additions = []
  let currentFile = null
  let currentLine = 0
  for (const rawLine of diff.split("\n")) {
    if (rawLine.startsWith("diff --git ")) {
      currentFile = null
      currentLine = 0
      continue
    }
    if (rawLine.startsWith("+++ b/")) {
      currentFile = rawLine.slice(6)
      continue
    }
    if (rawLine.startsWith("@@")) {
      // @@ -a,b +c,d @@  ← 只关心 +c,d
      const match = /\+(\d+)(?:,\d+)?/.exec(rawLine)
      currentLine = match ? Number(match[1]) : 0
      continue
    }
    if (!currentFile) continue
    if (rawLine.startsWith("+") && !rawLine.startsWith("+++")) {
      additions.push({ file: currentFile, line: currentLine, text: rawLine.slice(1) })
      currentLine += 1
    }
    // 上下文和 `-` 行在 --unified=0 下不会出现; 保险起见忽略
  }
  return additions
}

function main() {
  const additions = collectAdditions()
  if (additions.length === 0) return

  const violations = []
  for (const entry of additions) {
    if (excludeFile(entry.file)) continue
    for (const rule of rules) {
      if (rule.pattern.test(entry.text)) {
        violations.push({ ...entry, rule })
      }
    }
  }

  if (violations.length === 0) return

  process.stderr.write("\nBLOCKED: 检测到调试脚手架残留, 请清理后再 commit:\n\n")
  for (const v of violations) {
    process.stderr.write(`  ${v.file}:${v.line}  [${v.rule.id}] ${v.rule.describe}\n`)
    process.stderr.write(`    +${v.text.trimEnd()}\n`)
  }
  process.stderr.write(
    "\n绕过 (谨慎, 需在 commit-checklist 里说明理由): git commit --no-verify\n\n"
  )
  process.exit(1)
}

main()
