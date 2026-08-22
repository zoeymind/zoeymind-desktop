#!/usr/bin/env node
/**
 * 从 conventional commit 前缀生成分类版本说明，写回 GitHub Release body。
 *
 * 用法：
 *   node scripts/generate-release-notes.mjs <tag> [prev-tag]
 *   node scripts/generate-release-notes.mjs --tag v0.3.0
 *   node scripts/generate-release-notes.mjs --all
 *
 * 依赖：
 *   - GITHUB_TOKEN 或已登录的 gh CLI（脚本读 `gh auth token`）
 *   - REPO 环境变量或默认 zoeymind/zoeymind-desktop
 */
import { execFileSync } from "node:child_process"
import process from "node:process"

const REPO = process.env.REPO || "zoeymind/zoeymind-desktop"
const TOKEN =
  process.env.GITHUB_TOKEN ||
  (() => {
    try {
      return execFileSync("gh", ["auth", "token"], { encoding: "utf8" }).trim()
    } catch {
      return ""
    }
  })()

if (!TOKEN) {
  console.error("Missing GITHUB_TOKEN (or gh auth token)")
  process.exit(1)
}

const CATEGORY_DEFS = [
  { id: "feat", title: "✨ Features", types: ["feat"] },
  { id: "fix", title: "🐛 Fixes", types: ["fix"] },
  { id: "perf", title: "⚡ Performance", types: ["perf"] },
  { id: "refactor", title: "♻️ Refactor", types: ["refactor"] },
  { id: "docs", title: "📝 Documentation", types: ["docs"] },
  { id: "test", title: "✅ Tests", types: ["test"] },
  { id: "chore", title: "🔧 Chore", types: ["chore", "build", "ci", "style"] },
  { id: "other", title: "📦 Other", types: [] },
]

const CATEGORY_PATTERN = /^(feat|fix|perf|refactor|docs|test|chore|build|ci|style)(\(([^)]+)\))?!?:\s*(.+)$/i

function categorize(message) {
  const firstLine = message.split("\n")[0].trim()
  const match = firstLine.match(CATEGORY_PATTERN)
  if (!match)
    return { id: "other", scope: null, subject: firstLine.replace(/\s*\(#\d+\)\s*$/, "") }
  const type = match[1].toLowerCase()
  const scope = match[3] ?? null
  const subject = match[4].trim().replace(/\s*\(#\d+\)\s*$/, "")
  const def = CATEGORY_DEFS.find((c) => c.types.includes(type))
  return { id: def?.id ?? "other", scope, subject }
}

async function github(path, init = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${TOKEN}`,
      "x-github-api-version": "2022-11-28",
      ...(init.headers ?? {}),
      ...(init.body ? { "content-type": "application/json" } : {}),
    },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`${init.method || "GET"} ${path} → ${res.status}: ${text}`)
  }
  return res.json()
}

async function listReleases() {
  return github(`/repos/${REPO}/releases?per_page=100`)
}

async function fetchCompareCommits(base, head) {
  const data = await github(`/repos/${REPO}/compare/${base}...${head}`)
  return data.commits ?? []
}

function renderBody({ commits, compareUrl }) {
  const buckets = new Map(CATEGORY_DEFS.map((c) => [c.id, []]))
  for (const c of commits) {
    const parsed = categorize(c.commit.message)
    buckets.get(parsed.id).push({
      scope: parsed.scope,
      subject: parsed.subject,
      sha: c.sha.slice(0, 7),
      url: c.html_url,
    })
  }
  const sections = CATEGORY_DEFS.filter((def) => (buckets.get(def.id) ?? []).length > 0).map(
    (def) => {
      const items = buckets.get(def.id)
      const lines = items.map((item) => {
        const scope = item.scope ? `**${item.scope}**: ` : ""
        return `- ${scope}${item.subject} ([${item.sha}](${item.url}))`
      })
      return `### ${def.title}\n\n${lines.join("\n")}`
    },
  )
  const summary = commits.length
    ? `${commits.length} commits since previous release.`
    : "No commits in this range."
  return `${summary}\n\n${sections.join("\n\n")}\n\n---\n\n**Full Changelog**: ${compareUrl}\n`
}

async function updateRelease(release, body) {
  if (release.body === body) {
    console.log(`= ${release.tag_name} unchanged`)
    return
  }
  await github(`/repos/${REPO}/releases/${release.id}`, {
    method: "PATCH",
    body: JSON.stringify({ body }),
  })
  console.log(`✓ ${release.tag_name} updated`)
}

function pickPrevTag(releases, index) {
  for (let i = index + 1; i < releases.length; i++) {
    if (!releases[i].draft) return releases[i].tag_name
  }
  return null
}

async function processOne(tag) {
  const releases = (await listReleases())
    .filter((r) => !r.draft)
    .sort((a, b) => new Date(b.published_at) - new Date(a.published_at))
  const index = releases.findIndex((r) => r.tag_name === tag)
  if (index < 0) throw new Error(`Release ${tag} not found`)
  const release = releases[index]
  const prev = pickPrevTag(releases, index)
  if (!prev) {
    console.log(`- ${tag} skipped (no previous tag to compare)`)
    return
  }
  const commits = await fetchCompareCommits(prev, tag)
  const body = renderBody({
    commits,
    compareUrl: `https://github.com/${REPO}/compare/${prev}...${tag}`,
  })
  await updateRelease(release, body)
}

async function processAll() {
  const releases = (await listReleases())
    .filter((r) => !r.draft)
    .sort((a, b) => new Date(b.published_at) - new Date(a.published_at))
  for (let i = 0; i < releases.length; i++) {
    const prev = pickPrevTag(releases, i)
    const current = releases[i]
    if (!prev) {
      console.log(`- ${current.tag_name} skipped (initial release)`)
      continue
    }
    const commits = await fetchCompareCommits(prev, current.tag_name)
    const body = renderBody({
      commits,
      compareUrl: `https://github.com/${REPO}/compare/${prev}...${current.tag_name}`,
    })
    await updateRelease(current, body)
  }
}

async function main() {
  const args = process.argv.slice(2)
  const flag = args[0]
  if (!flag) {
    console.error("Usage: node scripts/generate-release-notes.mjs <tag>|--all")
    process.exit(1)
  }
  if (flag === "--all") return processAll()
  const tag = flag.startsWith("--tag") ? args[1] : flag
  if (!tag) throw new Error("Tag required")
  return processOne(tag)
}

main().catch((err) => {
  console.error(err.message ?? err)
  process.exit(1)
})
