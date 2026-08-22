# Changelog

This file records user-visible changes to `@zoeymind/cli` and `@zoeymind/mcp`. Both packages are released together from this repository.

## 0.3.0 - 2026-08-22

### Added

- Public package contracts: `@zoeymind/cli` with `zoeymind`, and `@zoeymind/mcp` with `zoeymind-mcp`.
- Compiled Node.js 22 executables with bundled Broker Client code.
- Native external-automation and destructive-edit permissions, both disabled by default.
- Packed-artifact, real stdio, protocol compatibility, and tool-schema validation.
- License: Apache License 2.0。

## Versioning policy

- Package versions follow SemVer and are kept identical for coordinated releases.
- A breaking CLI argument, MCP tool/schema, structured error, or Broker protocol change requires a major package version.
- Additive optional fields and new non-breaking behavior require a minor version.
- Fixes that preserve public contracts require a patch version.
- Deprecated behavior remains documented for at least one minor release before removal. Removal is a major change.
- Desktop releases may use a different version. Compatibility is determined by the Broker protocol version, currently `1`, not by comparing npm and Desktop package versions.
