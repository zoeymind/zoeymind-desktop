# Troubleshooting

| Signal                              | Meaning                                                                              | Repair                                                                                   |
| ----------------------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `APP_UNAVAILABLE`                   | Desktop is closed, External automation is disabled, or its descriptor is unavailable | Start Desktop, enable External automation in Preferences, wait until ready, rerun doctor |
| `DOCUMENT_NOT_OPEN`                 | No test document is open                                                             | Open a project or call `projects` then `activate_project`                                |
| `DOCUMENT_NOT_READY`                | The active mind map is still mounting                                                | Wait briefly and retry the read                                                          |
| Anchor expired or conflict          | The document changed after the anchored read                                         | Query the affected scope again and rebuild the patch from the new view                   |
| MCP initialize / JSON parse failure | The executable cannot start or stdout contains non-protocol output                   | Run `zoeymind-mcp doctor --json`; reinstall `@zoeymind/mcp` if stdio fails               |
| Broker unauthorized / timeout       | Desktop restarted or the Web bridge is unavailable                                   | Retry so the client reloads the new descriptor; inspect Desktop logs if it persists      |
| `active-document` doctor warning    | Broker works but no active ready project exists                                      | Open or activate the intended project, then rerun doctor                                 |

## Verification boundary

A package installation, written config, or successful Host listing is not sufficient evidence. Completion requires:

1. Doctor reports no `fail` checks.
2. The Host exposes all four ZoeyMind MCP tools when MCP is selected.
3. A read-only `outline` call succeeds for the active document.
4. If the current Agent process cannot reload newly installed MCP or skills, report that restart requirement explicitly. Use the CLI for the immediate read-only smoke check; do not claim the current session has MCP tools until a new session discovers them.
