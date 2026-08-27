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
{ "mode": "subtree", "path": ["订单", "退款"], "maxLines": 300 }
```

Retain the returned `scope`, `path`, `anchorTag`, `revision`, completeness flags, and truncation state as evidence.

## Anchored editing

`edit_current_mindmap` accepts the latest `anchorTag` and line numbers from its associated view. Line numbers are local to that view.

```text
PUT N.=N:       replace one target node or subtree
PUT <N:         insert siblings before N
PUT >N:         insert siblings after N
CUT N.=N:       delete one target node or subtree
MOVE N -> M:    move a subtree
```

Rules:

1. Each operation header is on its own line and has no `+` prefix.
2. Every inserted or replacement body row starts with `+`.
3. Two spaces represent one tree depth.
4. Use only line numbers visible in the anchored view.
5. Do not mix Git patch syntax, prose, or overlapping operations into a Tree Hashline Patch.
6. Inclusive ranges with different endpoints are unsupported. Use one operation per target; never emit `PUT N.=M` or `CUT N.=M` when `N` and `M` differ.
7. Use `preview: true` before deletion, replacement, or a broad structural edit when the host does not already enforce preview.

Example:

```json
{
  "anchorTag": "7C21",
  "patch": "PUT 8.=8:\n+      等待超过 30 秒 & 系统主动查询退款结果并保持订单为退款处理中\nPUT >8:\n+      查询成功 & 页面展示最终退款状态",
  "returnView": { "view": "subtree", "maxLines": 200 }
}
```

A successful edit returns a fresh bounded view and anchor. Continue from that view when the next target is present and not truncated. Query again only when the next target is outside it, the view is incomplete, or the anchor conflicts.

Warnings mean the edit committed. Apply only the returned localized `repairPatchHint` using the fresh anchor; do not resubmit the successful patch.
