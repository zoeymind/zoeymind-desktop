# Security Policy

## Supported versions

Security fixes are provided for the latest released ZoeyMind Desktop version and the latest major versions of `@zoeymind/cli` and `@zoeymind/mcp`. Upgrade to those versions before reporting a problem that may already be fixed.

## Reporting a vulnerability

Do not open a public issue for a vulnerability. Use GitHub private vulnerability reporting in the **Security** tab of `zoeymind/zoeymind-desktop`. Include affected versions, operating system, reproduction steps, impact, and any proof-of-concept material.

If private vulnerability reporting is unavailable, contact the repository owner through the private organization channel and request a secure reporting path. Do not send Broker descriptors, Bearer tokens, customer documents, model prompts, or `.zmind` files through a public channel.

## External automation boundary

External automation is disabled by default. Enabling it starts an authenticated Broker bound only to `127.0.0.1` on an operating-system-assigned port. Destructive external edits require a separate Preferences permission and are disabled by default.

The descriptor contains a session Bearer token and is written to application-local data with owner-only permissions on Unix. Treat it as a secret. The threat model assumes processes that can read all files owned by the current OS user can act with that user's authority; the Broker is not a sandbox against a compromised local account.

## Logs and recovery

- CLI and MCP do not log tool input, document content, descriptor paths, or Bearer tokens.
- MCP stdout is reserved for JSON-RPC; startup failures go to stderr.
- Desktop runtime logs are stored in the OS application log directory or the custom directory shown under Preferences → Logs.
- Do not attach raw logs until checking them for document titles, local paths, provider configuration, and other personal data.
- After a Desktop restart, clients reread the descriptor on every request. For an invalid descriptor or protocol mismatch, disable and re-enable External automation to rotate the listener, port, and token.

## Operating-system storage

Descriptor path derivation is contract-tested for macOS Application Support, Windows `LOCALAPPDATA`, and Linux `XDG_DATA_HOME`/`~/.local/share`. Unix descriptor creation requests mode `0600`; Windows relies on the current user's application-data ACL. Installer-level permission acceptance is required in each Desktop platform release and is not inferred from path-only unit tests.
