# Security Policy

## Supported versions

Security fixes are provided for the latest released ZoeyMind Desktop version and the latest major versions of `@zoeymind/cli` and `@zoeymind/mcp`. Upgrade to those versions before reporting a problem that may already be fixed.

## Reporting a vulnerability

Do not open a public issue for a vulnerability. Use GitHub private vulnerability reporting in the **Security** tab of `zoeymind/zoeymind-desktop`. Include affected versions, operating system, reproduction steps, impact, and any proof-of-concept material.

If private vulnerability reporting is unavailable, contact the repository owner through the private organization channel and request a secure reporting path. Do not send Broker descriptors, Bearer tokens, customer documents, model prompts, or `.zmind` files through a public channel.

## External automation boundary

External automation is disabled by default. Enabling it starts an authenticated Broker bound only to `127.0.0.1` on an operating-system-assigned port. Destructive external edits require a separate Preferences permission and are disabled by default.

The descriptor contains a session Bearer token and is written to application-local data with owner-only permissions on Unix. Treat it as a secret. The threat model assumes processes that can read all files owned by the current OS user can act with that user's authority; the Broker is not a sandbox against a compromised local account.
