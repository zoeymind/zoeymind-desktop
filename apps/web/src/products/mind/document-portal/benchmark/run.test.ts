import { describe, expect, it } from "vitest"
import { BENCHMARK_CASE_COUNT, createBenchmarkPortalFixture } from "./fixture"
import {
  BENCHMARK_THRESHOLDS,
  evaluateEditState,
  fingerprintLiveDocument,
  formatBenchmarkSummary,
  runBenchmark,
} from "./run"

describe("Portal reliability benchmark", () => {
  it("exercises the public Portal seam against the deterministic large document", async () => {
    const report = await runBenchmark()

    expect(report.corpus).toEqual({
      cases: BENCHMARK_CASE_COUNT,
      modules: 30,
      projectedLines: 9_031,
    })
    expect(report.metrics).toMatchObject({
      searchRecall: BENCHMARK_THRESHOLDS.searchRecall,
      targetLocationCorrectness: BENCHMARK_THRESHOLDS.targetLocationCorrectness,
      patchFirstAttemptSuccess: BENCHMARK_THRESHOLDS.patchFirstAttemptSuccess,
      wrongEditRate: BENCHMARK_THRESHOLDS.wrongEditRate,
      defaultReadBounded: BENCHMARK_THRESHOLDS.defaultReadBounded,
      paginationCompleteness: BENCHMARK_THRESHOLDS.paginationCompleteness,
      conflictRejection: BENCHMARK_THRESHOLDS.conflictRejection,
      atomicBatchEdit: BENCHMARK_THRESHOLDS.atomicBatchEdit,
    })
    expect(report.outcomes).toMatchObject({
      passed: true,
      failuresByPhase: { anchor: 2, validation: 1, application: 1 },
    })
    expect(
      report.outcomes.samples.find(sample => sample.id === "anchor-conflict-module-9")
    ).toMatchObject({ outcome: "failed", failurePhase: "anchor" })
    expect(formatBenchmarkSummary(report)).toContain("PASS Portal reliability benchmark")
  }, 30_000)
  it("records multiple edit attempts and distinguishes safety rejections from live application failure", async () => {
    const report = await runBenchmark()

    expect(report.metrics.patchFirstAttemptSuccess).toBe(1)
    expect(report.metrics.wrongEditRate).toBe(0)
    expect(
      report.outcomes.samples.filter(
        sample => sample.operation === "edit" && sample.outcome === "passed"
      )
    ).toHaveLength(3)
    expect(
      report.outcomes.samples.filter(sample => sample.failurePhase === "validation")
    ).toHaveLength(1)
    expect(
      report.outcomes.samples.filter(sample => sample.failurePhase === "application")
    ).toHaveLength(1)
    expect(report.outcomes.samples.find(sample => sample.id === "invalid-patch")).toMatchObject({
      expectedSafetyRejection: true,
    })
    expect(
      report.outcomes.samples.find(sample => sample.id === "live-engine-failure")
    ).toMatchObject({ expectedProductFailure: true })
  }, 30_000)

  it("detects an unintended non-target live-tree mutation", () => {
    const { root } = createBenchmarkPortalFixture()
    const before = fingerprintLiveDocument(root)
    root.children[0]!.children[0]!.data.text = "Case 0001 updated & Ready"
    root.children[1]!.children[0]!.data.text = "unintended mutation"

    const evaluation = evaluateEditState(before, fingerprintLiveDocument(root), {
      "root.0.0": "Case 0001 updated & Ready",
    })

    expect(evaluation.expectedTargetsChanged).toBe(true)
    expect(evaluation.nonTargetPaths).toEqual(["root.1.0"])
    expect(evaluation.isCorrect).toBe(false)
  })

  it("permits a non-growing anchored public Portal edit on a preexisting document over the node limit", async () => {
    const { portal, root } = createBenchmarkPortalFixture()
    const read = portal.read({
      documentId: "portal-reliability",
      view: "subtree",
      path: ["Module 01"],
    })

    const patch =
      "PUT 2.=2:\n+[P1] Case 0001 corrected & Ready\n+  Open fixture 0001 & Fixture opens\n+  Submit fixture 0001 & Submission succeeds"
    const preview = await portal.edit({
      documentId: "portal-reliability",
      anchorTag: read.anchorTag,
      patch,
      preview: true,
    })
    await expect(
      portal.edit({
        documentId: "portal-reliability",
        anchorTag: read.anchorTag,
        patch,
        confirmationToken: preview.confirmationToken,
      })
    ).resolves.toMatchObject({ dirty: true })
    expect(
      root.children[0]?.children.some(node => node.data.text === "Case 0001 corrected & Ready")
    ).toBe(true)
  })
})
