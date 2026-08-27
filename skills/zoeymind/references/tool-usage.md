# Tool usage

## Interface

MCP tools and CLI operations share these names:

- `projects`
- `activate_project`
- `query_current_mindmap`
- `edit_current_mindmap`

CLI form:

```bash
zoeymind <operation> '<json input>'
```

`zoeymind projects` defaults to `{ "action": "list" }`.
`projects` list accepts optional exact `projectId` and `title` filters. Use them when the target identity is already known instead of receiving unrelated project metadata.

## Query

Start broad, then narrow:

```json
{ "mode": "outline", "maxLines": 200 }
```

```json
{
  "mode": "search",
  "query": "退款超时",
  "fields": ["module", "caseTitle", "operation", "expected"],
  "limit": 20
}
```

```json
{ "mode": "subtree", "maxLines": 300 }
```

The omitted path above reads the whole document. To read a module, use its root-relative node text segments; both forms below address the same nested module because the document title is optional:

```json
{ "mode": "subtree", "path": ["订单", "退款"], "maxLines": 300 }
```

```json
{ "mode": "subtree", "path": ["电商测试", "订单", "退款"], "maxLines": 300 }
```

Retain the returned `scope`, `path`, `anchorTag`, `revision`, completeness flags, and truncation state as evidence.
Paths are root-relative node text segments; the document root may be included or omitted. A search hit's `readPath` can be passed unchanged as a subtree `path`. `modulePath` identifies owning modules and is not a substitute for `readPath` when the target is a case or step.

An untruncated outline includes `summary.caseCount` and `summary.priorityCounts`; use these structured counts instead of parsing `[P1]` text. No summary is returned for a truncated outline.

## Anchored editing

`edit_current_mindmap` accepts the latest `anchorTag` and line numbers from its associated view. Line numbers are local to that view. Send exactly one of `operations` or `patch`.

Use structured operations for common edits:

```json
{
  "anchorTag": "7C21",
  "operations": [
    {
      "op": "set_node",
      "at": 8,
      "value": "等待超过 30 秒 & 系统主动查询退款结果"
    },
    { "op": "move", "at": 12, "to": 8, "position": "after" }
  ]
}
```

Available operations:

- `set_node`: replace one node's projected row while preserving its type and children.
- `delete`: remove one node and its subtree.
- `move`: move one subtree `before`, `after`, or as the `last-child` of another visible node.
- `append_cases`: append case roots and their two-space-indented steps to a module.
- `replace_text`: replace literal text only within one module and selected `fields`; set `expect` to the exact occurrence count.

Structured edits return a compact receipt by default. Add `returnView` only when the next action requires complete post-edit content. A count mismatch, stale target, or overlapping operation rejects the whole request without mutation.

Use Tree Hashline `patch` only for complex sibling insertion or complete subtree replacement:

```text
PUT N.=N:       replace one target node or subtree
PUT <N:         insert siblings before N
PUT >N:         insert siblings after N
CUT N.=N:       delete one target node or subtree
MOVE N -> M:    move a subtree
```

Every patch header is on its own line. Every body row starts with `+`; two spaces represent one tree depth. Never mix Git patch syntax, prose, or overlapping operations. Inclusive ranges with different endpoints are unsupported.

Destructive edits require approval. First send the edit with `preview: true`; after approval, send only the returned `confirmationToken`. Do not retransmit the operation or patch. Warnings mean the edit committed: apply only the returned localized `repairPatchHint`, and never resubmit the successful edit.
