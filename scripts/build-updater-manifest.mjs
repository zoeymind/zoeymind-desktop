#!/usr/bin/env node
/**
 * 从 release-assets/ 目录里的 updater sidecar 生成 latest.json。
 *
 * 用法:
 *   node scripts/build-updater-manifest.mjs \
 *     --dir release-assets \
 *     --tag v0.3.0 \
 *     --repo zoeymind/zoeymind-desktop
 *
 * 契约:
 *   - Tauri Updater 每个平台的 sidecar 由 pubkey 内嵌的应用决定；本脚本按平台去 dir
 *     里找 `<platform_glob>.tar.gz(.sig)` 或 `<platform_glob>.nsis.zip(.sig)`。
 *   - 至少要有一个平台产出，否则退出。
 *   - 缺 signature 的 platform 直接跳过并 warn；不 fail (让 caller 决定是否 fail)。
 *   - 输出到 <dir>/latest.json。
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs"
import { basename, resolve } from "node:path"
import process from "node:process"

const PLATFORMS = [
  {
    id: "darwin-aarch64",
    match: (name) => /aarch64.*\.app\.tar\.gz$/.test(name) || /\.app\.tar\.gz$/.test(name) && /aarch/.test(name),
    // Tauri v2 macOS artifact naming: <ProductName>.app.tar.gz —— 我们的 workflow 只在
    // macOS Apple Silicon matrix 里产 macos/*.app.tar.gz，Intel matrix 未启用 app bundle 时
    // 需要额外识别。这里的策略：优先看是否有 arch 关键字，否则回落到第一个 `.app.tar.gz`。
    fallback: (name) => /\.app\.tar\.gz$/.test(name),
  },
  {
    id: "darwin-x86_64",
    match: (name) => /x64.*\.app\.tar\.gz$/.test(name) || (/\.app\.tar\.gz$/.test(name) && /intel|x86/i.test(name)),
  },
  {
    id: "linux-x86_64",
    match: (name) => /\.AppImage\.tar\.gz$/.test(name),
  },
  {
    id: "windows-x86_64",
    match: (name) => /\.nsis\.zip$/.test(name),
  },
]

function parseArgs() {
  const out = { dir: null, tag: null, repo: null, notes: null, notesFile: null }
  const args = process.argv.slice(2)
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    const value = args[i + 1]
    if (arg === "--dir") { out.dir = value; i++ }
    else if (arg === "--tag") { out.tag = value; i++ }
    else if (arg === "--repo") { out.repo = value; i++ }
    else if (arg === "--notes") { out.notes = value; i++ }
    else if (arg === "--notes-file") { out.notesFile = value; i++ }
  }
  if (!out.dir || !out.tag || !out.repo) {
    console.error("Usage: build-updater-manifest.mjs --dir <path> --tag v0.3.0 --repo owner/repo [--notes-file file] [--notes text]")
    process.exit(2)
  }
  return out
}

function main() {
  const { dir, tag, repo, notes, notesFile } = parseArgs()
  const absDir = resolve(dir)
  const files = readdirSync(absDir)
  const platforms = {}
  const usedNames = new Set()

  for (const def of PLATFORMS) {
    let candidate = files.find((name) => def.match(name) && !usedNames.has(name))
    if (!candidate && def.fallback) {
      candidate = files.find((name) => def.fallback(name) && !usedNames.has(name))
    }
    if (!candidate) continue
    const sig = files.find((name) => name === `${candidate}.sig`)
    if (!sig) {
      console.warn(`⚠ ${def.id}: found ${candidate} but no ${candidate}.sig — skipping`)
      continue
    }
    usedNames.add(candidate)
    usedNames.add(sig)
    platforms[def.id] = {
      url: `https://github.com/${repo}/releases/download/${tag}/${candidate}`,
      signature: readFileSync(resolve(absDir, sig), "utf8").trim(),
    }
    console.log(`✓ ${def.id}: ${candidate}`)
  }

  if (Object.keys(platforms).length === 0) {
    console.error("No updater sidecar payloads found; refusing to write manifest.")
    process.exit(1)
  }

  const notesText = notesFile
    ? readFileSync(notesFile, "utf8")
    : notes ?? ""

  const manifest = {
    version: tag.replace(/^v/, ""),
    notes: notesText,
    pub_date: new Date().toISOString().replace(/\.\d+Z$/, "Z"),
    platforms,
  }
  const outPath = resolve(absDir, "latest.json")
  writeFileSync(outPath, `${JSON.stringify(manifest, null, 2)}\n`)
  console.log(`Wrote ${outPath} with ${Object.keys(platforms).length} platform(s).`)
}

main()
