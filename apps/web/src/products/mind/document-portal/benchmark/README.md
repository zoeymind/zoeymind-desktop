# Portal reliability benchmark

Run `pnpm --filter @zoeymind-desktop/web benchmark:document-portal`. The command builds a deterministic 30-module Test Document with 3,000 cases and two steps per case (9,031 projected lines) through the public `createMindMapDocumentPortal` seam. It writes `artifacts/document-portal-reliability-benchmark.json` and exits nonzero when any threshold fails.

## Corpus and operations

The fixture has unique module, case, operation, and expected-result text. The task corpus performs:

- one bounded default read;
- three exact cross-module case-title queries (early, middle, and late corpus) and their three target subtree reads;
- a full 3,000-hit paginated search at 137 hits per page;
- three first-attempt, two-subtree atomic replacements in separate modules;
- one invalid patch that must be rejected during validation, before the live engine runs;
- two stale concurrent-anchor conflicts; and
- one expected application failure from a deterministic fault-injecting live engine.

The benchmark calls only `listDocuments`, `read`, `search`, and `edit`; it does not use projector internals or source-text assertions. No network or model call occurs.

## Metrics and thresholds

| Metric                               | Formula                                                                                                                                    | Threshold |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | --------: |
| Search recall                        | correct exact-query results / 3 query cases                                                                                                |      1.00 |
| Target-location correctness          | correct target subtree reads / 3 query cases                                                                                               |      1.00 |
| Patch first-attempt success          | correct atomic edits on first attempt / 3 edit tasks                                                                                       |      1.00 |
| Wrong-edit rate                      | observed wrong edits / successful edits, where a wrong edit is any missing expected target text or change to any non-target live-tree node |      0.00 |
| Default bounded/truncated read       | bounded default read passes                                                                                                                |      1.00 |
| Pagination completeness              | all 3,000 unique results retrieved                                                                                                         |      1.00 |
| Concurrent-anchor conflict rejection | both stale-anchor edits rejected                                                                                                           |      1.00 |
| Atomic batch edit                    | all three two-subtree replacements applied                                                                                                 |      1.00 |

Token usage is a deterministic estimate of serialized public operation results: `ceil(JSON.stringify(value).length / 4)`. Timing uses the local monotonic clock only. Failures are attributed to retrieval, understanding, anchor, validation, or application. The JSON report labels each phase `classified` when a sample exercises it, otherwise `not-exercised`; validation and anchor safety rejections are explicitly distinguished from the expected live-engine product failure.

For each atomic task, the runner fingerprints every node's public live-tree data and child ordering immediately before and after the edit batch. It requires the two expected target nodes to contain their exact replacement text, permits structural fingerprints for their ancestors, and rejects any changed non-target node. The mutation-sentinel test proves that an extra edit in another module makes this gate fail.
