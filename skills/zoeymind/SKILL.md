---
name: zoeymind
description: Query, create, review, and edit functional test cases in a running ZoeyMind Desktop app through the ZoeyMind MCP tools or CLI. Use when the user mentions ZoeyMind, .zmind projects, test-case mind maps, querying or editing an open test document, or asks an agent to generate structured functional test cases in ZoeyMind.
license: Apache-2.0
compatibility: Requires Node.js 22+, ZoeyMind Desktop with External automation enabled, and either @zoeymind/mcp or @zoeymind/cli.
metadata:
  author: zoeymind
  version: "1"
---

# ZoeyMind

Operate the live test document in ZoeyMind Desktop. Prefer the `zoeymind` MCP tools when available; otherwise invoke the `zoeymind` CLI with the same operation names and JSON inputs.

## Establish readiness

1. Run `zoeymind-mcp doctor --json` when using MCP, or `zoeymind doctor --json` when using CLI.
2. Treat every `fail` check as blocking. Apply its repair message, then rerun doctor.
3. A warning for `active-document` means Desktop is connected but no ready document is active. Ask the user to open a project, or use `projects` followed by `activate_project`.
4. Completion criterion: doctor has no `fail`, and the intended project is active and ready.

## Choose the project

- Call `projects` with `{ "action": "list" }` before acting when the target project is not explicit.
- Call `activate_project` with the selected `projectId` when it is not already active and ready.
- Never infer project identity from a title when multiple matches exist.

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

Read [references/troubleshooting.md](references/troubleshooting.md) for Desktop, Broker, document-state, anchor, and MCP failures. Retry only after applying the specific repair. Report the exact doctor check or structured `errorCode`; never claim configuration or an edit succeeded without a successful response.
