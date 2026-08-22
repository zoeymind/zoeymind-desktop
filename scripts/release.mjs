#!/usr/bin/env node
/**
 * 一键发版脚本：
 *   pnpm release <version>
 *
 * 契约：
 *   - 只在 main 分支运行；
 *   - 工作树必须干净；
 *   - CHANGELOG.md 顶部必须存在 ## Unreleased 段（发版时改写为 ## X.Y.Z - DATE 并预留新的 Unreleased）；
 *   - 同步 4 处版本号：apps/cli/package.json、apps/mcp/package.json、src-tauri/Cargo.toml、apps/mcp/src/server.ts；
 *   - 跑本地校验：typecheck、test、pack、cargo check；
 *   - 生成 release commit + git tag（不自动 push，最后打印指令）。
 *
 * 触发的下游：
 *   - `git push origin main --follow-tags` → npm Release workflow（by tag）+ Desktop Release workflow（需要 workflow_dispatch，脚本尾部输出指令）。
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

function fail(message) {
  process.stderr.write(`\x1b[31m✗ ${message}\x1b[0m\n`);
  process.exit(1);
}

function ok(message) {
  process.stdout.write(`\x1b[32m✓\x1b[0m ${message}\n`);
}

function run(command, args, { cwd = root, capture = false } = {}) {
  return execFileSync(command, args, {
    cwd,
    stdio: capture ? ["ignore", "pipe", "inherit"] : "inherit",
    encoding: "utf8",
  });
}

function verifyClean() {
  const branch = run("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
    capture: true,
  }).trim();
  if (branch !== "main") fail(`当前分支 ${branch}，只允许在 main 上发版`);
  const status = run("git", ["status", "--porcelain"], {
    capture: true,
  }).trim();
  if (status) fail(`工作树未清理，先提交或 stash:\n${status}`);
  ok(`分支 main、工作树干净`);
}

function verifyVersion(version) {
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version))
    fail(`版本号不符合 SemVer：${version}`);
  const tagExists = run("git", ["tag", "--list", `v${version}`], {
    capture: true,
  }).trim();
  if (tagExists) fail(`git tag v${version} 已存在`);
  ok(`版本号 ${version} 通过 SemVer 校验`);
}

function bumpJson(path, version) {
  const abs = resolve(root, path);
  const pkg = JSON.parse(readFileSync(abs, "utf8"));
  const previous = pkg.version;
  pkg.version = version;
  writeFileSync(abs, `${JSON.stringify(pkg, null, 2)}\n`);
  ok(`${path}: ${previous} → ${version}`);
}

function bumpCargo(version) {
  const path = "src-tauri/Cargo.toml";
  const abs = resolve(root, path);
  const original = readFileSync(abs, "utf8");
  const patched = original.replace(
    /^version = ".*"$/m,
    `version = "${version}"`,
  );
  if (patched === original) fail(`Cargo.toml 中未找到 version 行`);
  writeFileSync(abs, patched);
  ok(`${path} version 已更新为 ${version}`);
  run(
    "cargo",
    [
      "update",
      "-p",
      "zoeymind-desktop",
      "--manifest-path",
      "src-tauri/Cargo.toml",
    ],
    {
      capture: true,
    },
  );
  ok(`Cargo.lock 同步`);
}

function bumpMcpServer(version) {
  const path = "apps/mcp/src/server.ts";
  const abs = resolve(root, path);
  const original = readFileSync(abs, "utf8");
  const patched = original.replace(
    /const PACKAGE_VERSION = ".*";/,
    `const PACKAGE_VERSION = "${version}";`,
  );
  if (patched === original) fail(`${path} 中未找到 PACKAGE_VERSION`);
  writeFileSync(abs, patched);
  ok(`${path} PACKAGE_VERSION 已更新为 ${version}`);
}

function bumpChangelog(version) {
  const path = "CHANGELOG.md";
  const abs = resolve(root, path);
  const original = readFileSync(abs, "utf8");
  if (!/^## Unreleased/m.test(original))
    fail(`${path} 缺少 ## Unreleased 段；发版前请在该段登记本次改动`);
  const date = new Date().toISOString().slice(0, 10);
  const patched = original.replace(
    /^## Unreleased[ \t]*\n/m,
    `## Unreleased\n\n_(no user-visible changes recorded)_\n\n## ${version} - ${date}\n`,
  );
  writeFileSync(abs, patched);
  ok(`${path} 已写入 ${version} - ${date}`);
}

function runLocalValidation() {
  process.stdout.write("→ 本地验收（typecheck/test/pack/cargo check）…\n");
  run("pnpm", ["--filter", "@zoeymind/cli", "typecheck"]);
  run("pnpm", ["--filter", "@zoeymind/cli", "test"]);
  run("pnpm", ["--filter", "@zoeymind/mcp", "typecheck"]);
  run("pnpm", ["--filter", "@zoeymind/mcp", "test"]);
  run("pnpm", ["test:packages"]);
  run("cargo", [
    "check",
    "--manifest-path",
    "src-tauri/Cargo.toml",
    "--locked",
  ]);
  ok(`本地验收通过`);
}

function commitAndTag(version) {
  run("git", ["add", "-A"]);
  run("git", ["commit", "-m", `release: v${version}`], {
    env: { ...process.env, USER_CONFIRMED: "1" },
  });
  run("git", ["tag", "-a", `v${version}`, "-m", `v${version}`]);
  ok(`已提交并打 tag v${version}`);
}

async function main() {
  const [, , version] = process.argv;
  if (!version) fail("用法：pnpm release <version>（例：pnpm release 0.3.1）");

  verifyClean();
  verifyVersion(version);
  bumpJson("apps/cli/package.json", version);
  bumpJson("apps/mcp/package.json", version);
  bumpCargo(version);
  bumpMcpServer(version);
  bumpChangelog(version);
  runLocalValidation();
  commitAndTag(version);

  process.stdout.write("\n\x1b[32m全部本地步骤完成。\x1b[0m 下一步：\n");
  process.stdout.write("\n");
  process.stdout.write("  1) 推 commit + tag：\n");
  process.stdout.write("     git push origin main --follow-tags\n");
  process.stdout.write("\n");
  process.stdout.write(
    "     tag 推送后 npm Release workflow 自动 publish CLI/MCP。\n",
  );
  process.stdout.write("\n");
  process.stdout.write("  2) 触发 Desktop 安装包构建：\n");
  process.stdout.write(
    `     gh workflow run "Release" --repo zoeymind/zoeymind-desktop \\\n`,
  );
  process.stdout.write(
    `       --field version=${version} --field release-ref=main\n`,
  );
  process.stdout.write("\n");
  process.stdout.write(
    "     workflow 会创建 GitHub Release、构建全平台安装包并转正。\n",
  );
}

main().catch((error) => fail(error.stack ?? error.message ?? String(error)));
