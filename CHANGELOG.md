# Changelog

This file records user-visible changes to `@zoeymind/cli` and `@zoeymind/mcp`. Both packages are released together from this repository.

## Unreleased

### Added

- Public package contracts: `@zoeymind/cli` with `zoeymind`, and `@zoeymind/mcp` with `zoeymind-mcp`.
- Compiled Node.js 22 executables with bundled Broker Client code.
- Native external-automation and destructive-edit permissions, both disabled by default.
- Packed-artifact, real stdio, protocol compatibility, and tool-schema validation.
- License: PolyForm Noncommercial 1.0.0；商业使用需先联系 <https://github.com/zoeymind> 获取书面授权。

## Versioning policy

- Package versions follow SemVer and are kept identical for coordinated releases.
- A breaking CLI argument, MCP tool/schema, structured error, or Broker protocol change requires a major package version.
- Additive optional fields and new non-breaking behavior require a minor version.
- Fixes that preserve public contracts require a patch version.
- Deprecated behavior remains documented for at least one minor release before removal. Removal is a major change.
- Desktop releases may use a different version. Compatibility is determined by the Broker protocol version, currently `1`, not by comparing npm and Desktop package versions.
