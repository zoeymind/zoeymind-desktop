# Changelog

This file records user-visible changes to `@zoeymind/cli` and `@zoeymind/mcp`. Both packages are published from this repository and may version independently.

## Unreleased

## 0.5.0 - 2026-08-28

### Added

- Add exact project filters and structured case/priority counts to CLI and MCP read results without changing Broker protocol compatibility.
- Add precise `set_node`, `delete`, `move`, `append_cases`, and scoped `replace_text` operations with exact-count conflict protection and compact receipts.
- Document root-relative paths and reusable search `readPath` values; tolerate extra Agent context and normalize only executable fields at the Broker seam.
- Let configured Agents act directly from user intent; reserve Doctor for installation acceptance and failure diagnosis.

### Fixed

- Ensure the installed `zoeymind` executable always dispatches commands when invoked through npm's global or local bin symlink.
- Remove obsolete External automation switch instructions; Desktop now starts its authenticated local Broker automatically.

## 0.4.0 - 2026-08-27

### Added

- Read-only `doctor --json` flows for both `zoeymind` and `zoeymind-mcp`, covering Desktop Broker access, active-document reads, and real MCP stdio tool discovery.
- Open Agent Skill under `skills/zoeymind` with tool workflow, anchored editing, troubleshooting, and functional test-case rules.
- Copyable For Agent onboarding for Claude Code, Codex, OpenCode, and OMP in Desktop Help.

## 0.3.0 - 2026-08-22

### Added

- Public package contracts: `@zoeymind/cli` with `zoeymind`, and `@zoeymind/mcp` with `zoeymind-mcp`.
- Compiled Node.js 22 executables with bundled Broker Client code.
- Native external-automation and destructive-edit permissions, both disabled by default.
- Packed-artifact, real stdio, protocol compatibility, and tool-schema validation.
- License: Apache License 2.0。

## Versioning policy

- Package versions follow SemVer and may advance independently. Consumers using `@latest` receive each package's newest release.
- A breaking CLI argument, MCP tool/schema, structured error, or Broker protocol change requires a major package version.
- Additive optional fields and new non-breaking behavior require a minor version.
- Fixes that preserve public contracts require a patch version.
- Deprecated behavior remains documented for at least one minor release before removal. Removal is a major change.
- Desktop releases may use a different version. Compatibility is determined by the Broker protocol version, currently `1`, not by comparing npm and Desktop package versions.
