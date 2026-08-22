#!/usr/bin/env node
/**
 * 校验 latest.json 结构和外部 URL，防止发布指向不存在的资产。
 *
 * Pre-flight checks:
 *   - Required fields (version / notes / pub_date / platforms)
 *   - At least one platform
 *   - Each platform has url + non-empty signature
 *   - Optional: HEAD 请求确认 URL 可达（默认关闭，release upload 之前 URL 还不存在）
 */
import { readFileSync } from "node:fs"
import process from "node:process"

const [, , manifestPath] = process.argv
if (!manifestPath) {
  console.error("Usage: validate-updater-manifest.mjs <path/to/latest.json>")
  process.exit(2)
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"))

const errors = []
for (const key of ["version", "notes", "pub_date", "platforms"]) {
  if (!(key in manifest)) errors.push(`Missing required field: ${key}`)
}
if (typeof manifest.version !== "string" || !/^\d+\.\d+\.\d+/.test(manifest.version)) {
  errors.push(`Invalid version: ${manifest.version}`)
}
const platforms = manifest.platforms ?? {}
const platformIds = Object.keys(platforms)
if (platformIds.length === 0) {
  errors.push("No platforms declared in manifest")
}
for (const [id, entry] of Object.entries(platforms)) {
  if (typeof entry.url !== "string" || !/^https?:/.test(entry.url)) {
    errors.push(`${id}: invalid url`)
  }
  if (typeof entry.signature !== "string" || entry.signature.length < 100) {
    errors.push(`${id}: signature missing or truncated`)
  }
  if (typeof entry.url === "string" && !entry.url.includes(`/${manifest.version ? "v" + manifest.version : ""}/`) &&
      !entry.url.includes(`releases/download/`)) {
    errors.push(`${id}: url is not a GitHub Releases download URL`)
  }
}

if (errors.length) {
  console.error("Manifest validation failed:")
  for (const e of errors) console.error(`  ✗ ${e}`)
  process.exit(1)
}

console.log(`✓ Manifest valid: ${manifest.version}, ${platformIds.length} platform(s): ${platformIds.join(", ")}`)
