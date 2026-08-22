# 发布流程

单一事实源：git tag。所有 npm 包与 Desktop 安装包同版本、同时发布。

## 版本策略

- 遵循 [SemVer 2.0.0](https://semver.org)，`MAJOR.MINOR.PATCH[-prerelease]`。
- CLI/MCP 使用**同一版本号**同步发布；Desktop 版本可与 npm 包版本相同或独立，兼容性由 Broker 协议版本管理（当前 `1`）。
- 破坏性变更（CLI flag/MCP tool schema/structured error/Broker 协议）需要 major。
- 新增可选字段或非破坏行为需要 minor。
- 修复不变契约需要 patch。
- prerelease 用 `-rc.N` / `-alpha.N` / `-beta.N`。
- 弃用行为在被移除前至少经历一个 minor 的过渡期。

## Release-per-tag 契约

1. **改动累积在 `CHANGELOG.md` 顶部的 `Unreleased`**。任何用户可见改动必须落此段。
2. **发版前一次性提交版本更新**：
   ```bash
   # 用真实版本号替换 <VER>
   pnpm --filter @zoeymind/cli exec npm version <VER> --no-git-tag-version
   pnpm --filter @zoeymind/mcp exec npm version <VER> --no-git-tag-version
   # Cargo 版本
   sed -i '' "s/^version = .*/version = \"<VER>\"/" src-tauri/Cargo.toml
   # Package embedded string
   sed -i '' "s/^const PACKAGE_VERSION = .*/const PACKAGE_VERSION = \"<VER>\";/" apps/mcp/src/server.ts
   # CHANGELOG: 把 Unreleased 段改标题为 <VER> - YYYY-MM-DD, 并在其上补一个空的 Unreleased
   ```
3. **提交并打 tag**：
   ```bash
   git add -A
   USER_CONFIRMED=1 git commit -m "release: v<VER>"
   git tag -a v<VER> -m "v<VER>"
   git push origin main
   git push origin v<VER>
   ```
4. **CI 触发**：`push` tag `v*` 会驱动 `npm Release` 与 `Release` workflow。二者独立跑，都需要各自的 secret / trusted publisher 已就绪。
5. **失败时**：
   - 未 publish 到 npm：删 tag、修问题、重打相同 tag（tag 可以移动）。
   - 已 publish 到 npm：npm 版本永久占用，必须把下一版号加一，走完整流程重新发。**永远不要 `--force`**。

## 首发例外

首次发布（v0.3.0）在此机器上以 `npm login` + 本地 `npm publish` 手工完成，用于占位 `@zoeymind` scope 并沉淀首个稳定 tag；之后所有版本走上述 Release-per-tag 流程，禁止再走手工路径。

## 校验清单

发版 tag push 之前跑：

```bash
pnpm --filter @zoeymind/cli build
pnpm --filter @zoeymind/cli typecheck
pnpm --filter @zoeymind/cli test
pnpm --filter @zoeymind/mcp build
pnpm --filter @zoeymind/mcp typecheck
pnpm --filter @zoeymind/mcp test
pnpm --filter @zoeymind-desktop/web test
pnpm test:packages
cargo test --manifest-path src-tauri/Cargo.toml document_portal
cargo check --manifest-path src-tauri/Cargo.toml --locked
git diff --check
```

任何一项失败就地修正，禁止 override。
