---
name: zoeymind
description: Query, create, review, and edit functional test cases in a running ZoeyMind Desktop app through the ZoeyMind MCP tools or CLI. Use when the user mentions ZoeyMind, .zmind projects, test-case mind maps, querying or editing an open test document, or asks an agent to generate structured functional test cases in ZoeyMind.
license: Apache-2.0
compatibility: Requires Node.js 22+, a running ZoeyMind Desktop app, and either @zoeymind/mcp or @zoeymind/cli.
metadata:
  author: zoeymind
  version: "1"
---

# ZoeyMind

Operate the live test document in ZoeyMind Desktop. Prefer the `zoeymind` MCP tools when available; otherwise invoke the `zoeymind` CLI with the same operation names and JSON inputs.

## Start from intent

- When the target project is already active, call `query_current_mindmap` or `edit_current_mindmap` directly.
- When project identity or readiness is unknown, call `projects`; use `activate_project` only when the intended project is not active.
- For setup or connection failures, run `zoeymind-mcp doctor --json` or `zoeymind doctor --json`.
- A tool response is the source of truth. On a structured error, apply its repair message and retry the intended operation.
- If several projects share a title, select by `projectId` or ask which one to use.

## Read before editing

- `outline`: inspect the overall module and case-title structure. It omits steps.
- `search`: locate modules, cases, preconditions, operations, or expected results.
- `subtree`: read complete local content before changing it.
- Treat `truncated: true` as incomplete evidence. Narrow the scope or paginate; do not infer omitted content or counts.
- Require `canReplaceCompleteSubtree: true` before replacing an entire subtree.

Read [references/tool-usage.md](references/tool-usage.md) before the first edit in a session.

## Write executable test cases

Read [references/test-case-rules.md](references/test-case-rules.md) when generating, restructuring, or reviewing test cases. Preserve existing content outside the requested scope. Every change must remain valid as a ZoeyMind test document.

## Handle failures

Read [references/troubleshooting.md](references/troubleshooting.md) for Desktop, Broker, document-state, anchor, and MCP failures. Retry only after applying the specific repair; never claim configuration or an edit succeeded without a successful response.
