<p align="center">
  <img src=".github/assets/logo.svg" alt="ZoeyMind" width="180" />
</p>

<h1 align="center">ZoeyMind Desktop</h1>

<p align="center">
  <b>Functional test-case editor</b> for QA · mind maps × AI Agent
</p>

<p align="center">
  <a href="https://github.com/zoeymind/zoeymind-desktop/releases/latest"><img src="https://img.shields.io/github/v/release/zoeymind/zoeymind-desktop?display_name=tag&sort=semver" alt="Latest release"></a>
  <a href="https://www.npmjs.com/package/@zoeymind/cli"><img src="https://img.shields.io/npm/v/@zoeymind/cli?label=%40zoeymind%2Fcli" alt="npm @zoeymind/cli"></a>
  <a href="https://www.npmjs.com/package/@zoeymind/mcp"><img src="https://img.shields.io/npm/v/@zoeymind/mcp?label=%40zoeymind%2Fmcp" alt="npm @zoeymind/mcp"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-Apache%202.0-blue.svg" alt="License"></a>
</p>

<p align="center">
  <a href="https://zoeymind.com/en">Website</a> ·
  <a href="https://github.com/zoeymind/zoeymind-desktop/releases/latest">Download</a> ·
  <a href="https://zoeymind.com/en/changelog">Changelog</a> ·
  <a href="./README.md">中文</a>
</p>

<hr />

<p align="center">
  <img src=".github/assets/agent-in-action.jpeg" alt="ZoeyMind Desktop working with an AI Agent to fill in test cases" width="920" />
</p>

ZoeyMind Desktop is a **functional test-case editor** for QA engineers. It organizes cases as mind maps, lets an AI Agent finish them for you, and interoperates two-way with your team's existing XMind / MeterSphere workflow.

**Three differentiators**:

- 🛡 **Fully local**: `.zmind` files live wherever you put them on disk. No cloud, no account, no signup, no login — test data never leaves the machine.
- 🔑 **BYOK AI**: bring your own OpenAI / Anthropic / Gemini / Ollama key. You choose the model you trust; cost stays on your bill. ZoeyMind does not proxy, forward, or cache.
- 🔁 **Two-way XMind × MeterSphere flow**: import your team's existing `.xmind`, export in MeterSphere case format, and share the clipboard with XMind / Feishu MindMap.

## Screenshots

<table>
  <tr>
    <td width="33%"><a href="./.github/assets/library.jpeg"><img src=".github/assets/library.jpeg" alt="Case library" /></a><br><sub><b>Library</b> — one <code>.zmind</code> per module or project</sub></td>
    <td width="33%"><a href="./.github/assets/canvas-overview.jpeg"><img src=".github/assets/canvas-overview.jpeg" alt="Case overview" /></a><br><sub><b>Overview</b> — module → case → step structure</sub></td>
    <td width="33%"><a href="./.github/assets/agent-mode.jpeg"><img src=".github/assets/agent-mode.jpeg" alt="AI Agent mode" /></a><br><sub><b>Agent mode</b> — built-in tools + optional MCP</sub></td>
  </tr>
</table>

## Features

**Test-case native structure**

- Module / case / precondition / step / expected result are first-class nodes — not overloaded tags;
- Priority (P0 / P1 / P2 / P3), labels, icons, defect links;
- High-performance mode for large documents; smooth at 2000+ nodes;
- Undo/redo, multi-tab, crash recovery, external-change detection.

**AI Agent (BYOK)**

- Built-in Mind AI Agent produces structured cases from raw requirements or an existing skeleton: boundaries, exceptions, permissions, data validation;
- Supports OpenAI · OpenAI-compatible (Groq / DeepSeek / Kimi …) · Anthropic · Google Gemini · Ollama (local);
- Optional human-in-the-loop "edit review": see the diff before the Agent commits;
- Attach external MCP servers to extend the toolset (Desktop is also an MCP host).

**Interop and migration**

- Import: standard XMind, MeterSphere XMind, Markdown, nested ZIP;
- Export: MeterSphere XMind, standard XMind, PDF / PNG / SVG / Markdown / JSON / TXT / ZIP;
- Clipboard compatible with XMind and Feishu MindMap.

**External automation (opt-in)**

- [`@zoeymind/cli`](https://www.npmjs.com/package/@zoeymind/cli): command `zoeymind`, drive Desktop from scripts or local tools;
- [`@zoeymind/mcp`](https://www.npmjs.com/package/@zoeymind/mcp): stdio MCP server that exposes Desktop to Claude Code / OMP / Codex / OpenCode;
- Disabled by default; enable in Preferences, with destructive-edit permission gated separately;
- Communicates over authenticated loopback; a fresh token per launch; no public ports.

**Platforms and formats**

- Native builds for macOS (Intel + Apple Silicon), Windows x64, Linux (`.AppImage` / `.deb`);
- Auto-update via Tauri Updater;
- Theme presets + light/dark; English and Chinese UI.

## Install

```bash
# Desktop app (recommended)
# Download the installer for your platform from GitHub Releases
# https://github.com/zoeymind/zoeymind-desktop/releases/latest

# CLI / MCP (optional)
npm install -g @zoeymind/cli
npm install -g @zoeymind/mcp
```

MCP host config:

```json
{
  "mcpServers": {
    "zoeymind": { "command": "zoeymind-mcp" }
  }
}
```

**First run**: ZoeyMind does not carry an Apple / Microsoft code-signing certificate, so the OS asks you once to allow it.

- **macOS**: after dragging the `.dmg` into Applications, right-click ZoeyMind in Launchpad → Open → click **Open** on "developer cannot be verified"; or System Settings → Privacy & Security → find ZoeyMind → **Open Anyway**. Not asked again.
- **Windows**: on SmartScreen "Windows protected your PC", click **More info** → **Run anyway**. Not asked again.
- **Linux**: for AppImage, `chmod +x` and run; for `.deb`, `sudo apt install ./ZoeyMind_*.deb`.

> Internally, updates are verified by Tauri Updater's own cryptographic signature — independent of OS code signing.

## Local development

```bash
pnpm install
pnpm tauri:dev
```

Full acceptance commands for CLI/MCP, Portal, Broker, and native code are in [`RELEASE.md`](./RELEASE.md).

## Feedback and security

- **General feedback**: <https://github.com/zoeymind/zoeymind-desktop/issues>
- **Commercial licensing**: <1103837067@qq.com>
- **Security vulnerabilities**: GitHub private vulnerability reporting or the email above — see [`SECURITY.md`](./SECURITY.md).

## License

Apache License 2.0. You may freely use, modify, distribute, and use commercially, provided that you retain [`LICENSE`](./LICENSE) and [`NOTICE`](./NOTICE) and preserve the attribution notices in the source.

Copyright © 2026 ZoeyMind. Maintained by [@caishilong](https://github.com/caishilong).
