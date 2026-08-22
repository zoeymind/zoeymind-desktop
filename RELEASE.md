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

## Desktop 一键发布契约

1. 普通 push 只运行 CI，不创建 Release。
2. 用户明确要求发布时，先确保 `main` 已包含并通过当前改动。
3. 触发 `Release` workflow，只传 `release-ref`；默认是 `main`。
4. Workflow 读取 GitHub 最新已发布版本，并统计该 tag 到 release commit 的 commit 数，将这个数量累加到 PATCH：例如 `v0.3.39` 之后有 7 个 commit，则发布 `v0.3.46`。
5. Workflow 创建 tag 和 Draft Release，为 Windows x64、macOS ARM64、macOS Intel、Linux 构建安装包及 Tauri 2 updater 签名，生成 `latest.json` 和 `SHA256SUMS.txt`，全部成功后再发布并设为 Latest。
6. 构建已成功但最终汇总或上传失败时，使用 recovery 输入复用该 run 的 artifacts，不重新构建。

源码中的开发版本保持 `0.0.0`；正式版本只在 workflow 构建时注入。若需要改变 MAJOR 或 MINOR，先调整发布策略，不手动修改源码版本或创建 tag。

## 谁能发版

多层防护，任一层失守都不影响其他层：

1. **`gh` 触发权限**：只有仓库 write 权限成员可以 `git push` tag 或 `workflow_dispatch`。Clone / fork 不带 write。
2. **workflow 步骤内 actor 断言**：`npm Release` 与 `Release` workflow 首步硬编码 `github.actor == "caishilong"`；非本人触发直接失败。
3. **`npm` environment secret 隔离**：`NODE_AUTH_TOKEN` 只挂在 `npm` environment，并配置 `deployment-branch-policies` 只接受 `main` 分支 push 与 `v*.*.*` tag。其他分支/tag 拿不到 token。
4. **npm granular token 权限最小**：只对 `@zoeymind` scope 读写，1 年过期。泄漏后 revoke 一次即可。
5. **Desktop 更新签名**：`TAURI_SIGNING_PRIVATE_KEY` 只被 `Release` workflow 使用，用于对 macOS updater 打包签名，非签名产物不会被安装端接受。

以后要接手第二个 maintainer：改 `ALLOWED` 变量或将其挪到 secret，同时在 npm environment 加 reviewer。切勿把发布权直接接给 CI bot。

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
