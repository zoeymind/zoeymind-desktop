import { mkdir, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { performance } from "node:perf_hooks"
import type { DocumentPortal } from "../document-portal"
import {
  BENCHMARK_DOCUMENT_ID,
  BENCHMARK_CASE_COUNT,
  BENCHMARK_MODULE_COUNT,
  benchmarkCaseText,
  createBenchmarkPortalFixture,
  type BenchmarkNode,
} from "./fixture"

export const BENCHMARK_THRESHOLDS = {
  searchRecall: 1,
  targetLocationCorrectness: 1,
  patchFirstAttemptSuccess: 1,
  wrongEditRate: 0,
  defaultReadBounded: 1,
  paginationCompleteness: 1,
  conflictRejection: 1,
  atomicBatchEdit: 1,
} as const

type FailurePhase = "retrieval" | "understanding" | "anchor" | "validation" | "application"
type OperationName = "read" | "search" | "edit"
type FailureExpectation = "safety-rejection" | "product-failure"

export interface BenchmarkSample {
  id: string
  operation: OperationName
  elapsedMs: number
  outcome: "passed" | "failed"
  tokenEstimate: number
  failurePhase?: FailurePhase
  expectedSafetyRejection?: boolean
  expectedProductFailure?: boolean
  detail: string
}

export interface BenchmarkReport {
  corpus: { cases: number; modules: number; projectedLines: number }
  thresholds: typeof BENCHMARK_THRESHOLDS
  metrics: {
    searchRecall: number
    targetLocationCorrectness: number
    patchFirstAttemptSuccess: number
    wrongEditRate: number
    defaultReadBounded: number
    paginationCompleteness: number
    conflictRejection: number
    atomicBatchEdit: number
    tokenEstimate: number
    elapsedMs: number
  }
  outcomes: {
    passed: boolean
    failuresByPhase: Record<FailurePhase, number>
    failureClassification: Record<FailurePhase, "classified" | "not-exercised">
    samples: BenchmarkSample[]
  }
}

export interface LiveDocumentFingerprint {
  nodes: Record<string, { data: string; children: string }>
}

export interface EditStateEvaluation {
  expectedTargetsChanged: boolean
  nonTargetPaths: string[]
  isCorrect: boolean
}

function fingerprintNode(
  node: BenchmarkNode,
  path: string,
  nodes: LiveDocumentFingerprint["nodes"]
): void {
  nodes[path] = {
    data: JSON.stringify(node.data),
    children: JSON.stringify(node.children.map(child => child.data.uid)),
  }
  node.children.forEach((child, index) => fingerprintNode(child, `${path}.${index}`, nodes))
}

export function fingerprintLiveDocument(root: BenchmarkNode): LiveDocumentFingerprint {
  const nodes: LiveDocumentFingerprint["nodes"] = {}
  fingerprintNode(root, "root", nodes)
  return { nodes }
}

function isTargetOrDescendant(path: string, targetPath: string): boolean {
  return path === targetPath || path.startsWith(`${targetPath}.`)
}

function isAncestor(path: string, targetPath: string): boolean {
  return targetPath.startsWith(`${path}.`)
}

export function evaluateEditState(
  before: LiveDocumentFingerprint,
  after: LiveDocumentFingerprint,
  expectedTargetTexts: Readonly<Record<string, string>>
): EditStateEvaluation {
  const targetPaths = Object.keys(expectedTargetTexts)
  const paths = new Set([...Object.keys(before.nodes), ...Object.keys(after.nodes)])
  const changedPaths = [...paths].filter(
    path => JSON.stringify(before.nodes[path]) !== JSON.stringify(after.nodes[path])
  )
  const expectedTargetsChanged = targetPaths.every(
    target =>
      changedPaths.some(path => isTargetOrDescendant(path, target)) &&
      JSON.parse(after.nodes[target]?.data ?? "{}").text === expectedTargetTexts[target]
  )
  const nonTargetPaths = changedPaths
    .filter(path => {
      if (targetPaths.some(target => isTargetOrDescendant(path, target))) return false
      if (!targetPaths.some(target => isAncestor(path, target))) return true
      return before.nodes[path]?.data !== after.nodes[path]?.data
    })
    .sort()
  return {
    expectedTargetsChanged,
    nonTargetPaths,
    isCorrect: expectedTargetsChanged && nonTargetPaths.length === 0,
  }
}

function estimateTokens(value: unknown): number {
  return Math.ceil(JSON.stringify(value).length / 4)
}

function classifyFailure(operation: OperationName, error: unknown): FailurePhase {
  const code =
    typeof error === "object" && error !== null && "code" in error ? String(error.code) : ""
  if (code === "DOCUMENT_EDIT_CONFLICT" || code === "DOCUMENT_ANCHOR_EXPIRED") return "anchor"
  if (code === "INVALID_DOCUMENT_EDIT_PATCH") return "validation"
  if (operation === "read" || operation === "search") return "retrieval"
  return "application"
}

function evaluateMetric(
  value: number,
  threshold: number,
  direction: "minimum" | "maximum" = "minimum"
): boolean {
  return direction === "minimum" ? value >= threshold : value <= threshold
}

async function measure<T>(
  samples: BenchmarkSample[],
  id: string,
  operation: OperationName,
  action: () => T | Promise<T>,
  assertion: (value: T) => boolean,
  detail: string,
  expectedFailure?: FailureExpectation
): Promise<T | null> {
  const started = performance.now()
  try {
    const value = await action()
    const passed = assertion(value)
    samples.push({
      id,
      operation,
      elapsedMs: performance.now() - started,
      outcome: passed ? "passed" : "failed",
      tokenEstimate: estimateTokens(value),
      ...(passed ? {} : { failurePhase: operation === "edit" ? "understanding" : "retrieval" }),
      detail,
    })
    return value
  } catch (error) {
    const failurePhase = classifyFailure(operation, error)
    samples.push({
      id,
      operation,
      elapsedMs: performance.now() - started,
      outcome: "failed",
      tokenEstimate: 0,
      failurePhase,
      ...(expectedFailure === "safety-rejection" ? { expectedSafetyRejection: true } : {}),
      ...(expectedFailure === "product-failure" ? { expectedProductFailure: true } : {}),
      detail: `${detail}: ${error instanceof Error ? error.message : String(error)}`,
    })
    return null
  }
}

function allPages(portal: DocumentPortal) {
  const hits = []
  let cursor: string | undefined
  do {
    const page = portal.search({
      documentId: BENCHMARK_DOCUMENT_ID,
      query: "cross-module",
      fields: ["caseTitle"],
      limit: 137,
      cursor,
    })
    hits.push(...page.hits)
    cursor = page.nextCursor
  } while (cursor !== undefined)
  return hits
}

async function applyDestructiveEdit(portal: DocumentPortal, anchorTag: string, patch: string) {
  const preview = await portal.edit({
    documentId: BENCHMARK_DOCUMENT_ID,
    anchorTag,
    patch,
    preview: true,
  })
  const confirmationToken = preview.confirmationToken
  if (!confirmationToken)
    throw new Error("benchmark destructive preview did not issue a confirmation token")
  return portal.edit({ documentId: BENCHMARK_DOCUMENT_ID, anchorTag, patch, confirmationToken })
}
function moduleName(module: number): string {
  return `Module ${String(module).padStart(2, "0")}`
}

function atomicPatch(firstCase: number): string {
  const first = String(firstCase).padStart(4, "0")
  const second = String(firstCase + 1).padStart(4, "0")
  return `PUT 2.=2:\n+[P1] Case ${first} updated & Ready\n+  Open fixture ${first} & Fixture opens\n+  Submit fixture ${first} & Submission succeeds\nPUT 5.=5:\n+[P1] Case ${second} updated & Ready\n+  Open fixture ${second} & Fixture opens\n+  Submit fixture ${second} & Submission succeeds`
}

export async function runBenchmark(): Promise<BenchmarkReport> {
  const started = performance.now()
  const { portal, root } = createBenchmarkPortalFixture()
  const samples: BenchmarkSample[] = []
  const defaultRead = await measure(
    samples,
    "default-read",
    "read",
    () => portal.read({ documentId: BENCHMARK_DOCUMENT_ID, view: "outline" }),
    value => value.lineCount === 200 && value.truncated,
    "default context is bounded and truncated"
  )

  const queryCases = [1733, 1, 2900]
  const searches = await Promise.all(
    queryCases.map(number =>
      measure(
        samples,
        `cross-module-search-${number}`,
        "search",
        () =>
          portal.search({
            documentId: BENCHMARK_DOCUMENT_ID,
            query: `cross-module-${String(number).padStart(4, "0")}`,
            fields: ["caseTitle"],
          }),
        value => value.total === 1 && value.hits[0]?.readPath.at(-1) === benchmarkCaseText(number),
        "known cross-module case-title target"
      )
    )
  )
  const targetReads = await Promise.all(
    searches.map((search, index) =>
      search?.hits[0]
        ? measure(
            samples,
            `target-read-${queryCases[index]}`,
            "read",
            () =>
              portal.read({
                documentId: BENCHMARK_DOCUMENT_ID,
                view: "subtree",
                path: search.hits[0]?.readPath,
              }),
            value =>
              value.content.includes(benchmarkCaseText(queryCases[index]!)) &&
              value.lineCount === 3,
            "target subtree reaches the searched case"
          )
        : Promise.resolve(null)
    )
  )

  const paged = await measure(
    samples,
    "pagination",
    "search",
    () => allPages(portal),
    value =>
      value.length === BENCHMARK_CASE_COUNT &&
      new Set(value.map(hit => hit.readPath.join("/"))).size === BENCHMARK_CASE_COUNT,
    "pagination returns every cross-module case without treating one page as the document"
  )

  const editModules = [1, 3, 5]
  const beforeEditState = fingerprintLiveDocument(root)
  const edits = await Promise.all(
    editModules.map(async module => {
      const read = await measure(
        samples,
        `edit-read-module-${module}`,
        "read",
        () =>
          portal.read({
            documentId: BENCHMARK_DOCUMENT_ID,
            view: "subtree",
            path: [moduleName(module)],
            maxLines: 400,
          }),
        value => !value.truncated,
        "module slice supplies edit anchors"
      )
      const firstCase = (module - 1) * (BENCHMARK_CASE_COUNT / BENCHMARK_MODULE_COUNT) + 1
      return read
        ? measure(
            samples,
            `atomic-batch-edit-module-${module}`,
            "edit",
            () => applyDestructiveEdit(portal, read.anchorTag, atomicPatch(firstCase)),
            value => value.dirty,
            "first-attempt atomic two-subtree replacement"
          )
        : null
    })
  )
  const atomic =
    edits.every(edit => edit !== null) &&
    [1, 3, 5].every(module =>
      root.children[module - 1]?.children.some(node => node.data.text.includes("updated"))
    )
  const expectedTargetTexts = Object.fromEntries(
    editModules.flatMap(module => {
      const firstCase = (module - 1) * (BENCHMARK_CASE_COUNT / BENCHMARK_MODULE_COUNT) + 1
      return [
        [`root.${module - 1}.0`, `Case ${String(firstCase).padStart(4, "0")} updated & Ready`],
        [`root.${module - 1}.1`, `Case ${String(firstCase + 1).padStart(4, "0")} updated & Ready`],
      ]
    })
  )
  const editState = evaluateEditState(
    beforeEditState,
    fingerprintLiveDocument(root),
    expectedTargetTexts
  )

  const invalidRead = portal.read({
    documentId: BENCHMARK_DOCUMENT_ID,
    view: "subtree",
    path: [moduleName(7)],
  })
  const invalid = await measure(
    samples,
    "invalid-patch",
    "edit",
    () =>
      portal.edit({
        documentId: BENCHMARK_DOCUMENT_ID,
        anchorTag: invalidRead.anchorTag,
        patch: "MOVE 2 -> 3:",
      }),
    () => false,
    "invalid patch must be rejected before live application",
    "safety-rejection"
  )
  const validationRejected = invalid === null && samples.at(-1)?.failurePhase === "validation"

  const conflicts = await Promise.all(
    [9, 10].map(async module => {
      const conflictRead = portal.read({
        documentId: BENCHMARK_DOCUMENT_ID,
        view: "subtree",
        path: [moduleName(module)],
      })
      root.children[module - 1]!.data.text = `${moduleName(module)} concurrently changed`
      return measure(
        samples,
        `anchor-conflict-module-${module}`,
        "edit",
        () =>
          portal.edit({
            documentId: BENCHMARK_DOCUMENT_ID,
            anchorTag: conflictRead.anchorTag,
            patch: "PUT 1.=1:\n+# stale module",
          }),
        () => false,
        "concurrent anchor conflict must reject",
        "safety-rejection"
      )
    })
  )
  const conflictRejected =
    conflicts.every(conflict => conflict === null) &&
    samples.filter(sample => sample.failurePhase === "anchor" && sample.expectedSafetyRejection)
      .length === 2

  const faulty = createBenchmarkPortalFixture({ failCommandAt: 1 })
  const faultyRead = faulty.portal.read({
    documentId: BENCHMARK_DOCUMENT_ID,
    view: "subtree",
    path: [moduleName(12)],
  })
  const applicationFailure = await measure(
    samples,
    "live-engine-failure",
    "edit",
    () =>
      faulty.portal.edit({
        documentId: BENCHMARK_DOCUMENT_ID,
        anchorTag: faultyRead.anchorTag,
        patch: "PUT 2.=2:\n+[P1] Case 1101 engine failure & Ready",
      }),
    () => false,
    "fault-injecting live engine reports application failure",
    "product-failure"
  )
  const applicationClassified =
    applicationFailure === null &&
    samples.at(-1)?.failurePhase === "application" &&
    samples.at(-1)?.expectedProductFailure === true

  const failuresByPhase: Record<FailurePhase, number> = {
    retrieval: 0,
    understanding: 0,
    anchor: 0,
    validation: 0,
    application: 0,
  }
  for (const sample of samples) if (sample.failurePhase) failuresByPhase[sample.failurePhase] += 1
  const failureClassification = Object.fromEntries(
    (Object.keys(failuresByPhase) as FailurePhase[]).map(phase => [
      phase,
      failuresByPhase[phase] > 0 ? "classified" : "not-exercised",
    ])
  ) as Record<FailurePhase, "classified" | "not-exercised">
  const unexpectedFailures = samples.filter(
    sample =>
      sample.outcome === "failed" &&
      !sample.expectedSafetyRejection &&
      !sample.expectedProductFailure
  ).length
  const successfulEdits = samples.filter(
    sample => sample.operation === "edit" && sample.outcome === "passed"
  )
  const successfulAtomicEdits = successfulEdits.filter(sample =>
    sample.id.startsWith("atomic-batch-edit-module-")
  )
  const wrongEdits =
    successfulEdits.length - successfulAtomicEdits.length + (editState.isCorrect ? 0 : 1)
  const metrics = {
    searchRecall: searches.every(search => search?.total === 1) ? 1 : 0,
    targetLocationCorrectness: targetReads.every(read => read !== null) ? 1 : 0,
    patchFirstAttemptSuccess:
      successfulAtomicEdits.length === editModules.length && atomic && editState.isCorrect ? 1 : 0,
    wrongEditRate: successfulEdits.length === 0 ? 1 : wrongEdits / successfulEdits.length,
    defaultReadBounded: defaultRead ? 1 : 0,
    paginationCompleteness: paged ? 1 : 0,
    conflictRejection: conflictRejected ? 1 : 0,
    atomicBatchEdit: atomic ? 1 : 0,
    tokenEstimate: samples.reduce((total, sample) => total + sample.tokenEstimate, 0),
    elapsedMs: performance.now() - started,
  }
  const passed =
    unexpectedFailures === 0 &&
    validationRejected &&
    applicationClassified &&
    Object.values(failureClassification).every(
      status => status === "classified" || status === "not-exercised"
    ) &&
    evaluateMetric(metrics.searchRecall, BENCHMARK_THRESHOLDS.searchRecall) &&
    evaluateMetric(
      metrics.targetLocationCorrectness,
      BENCHMARK_THRESHOLDS.targetLocationCorrectness
    ) &&
    evaluateMetric(
      metrics.patchFirstAttemptSuccess,
      BENCHMARK_THRESHOLDS.patchFirstAttemptSuccess
    ) &&
    evaluateMetric(metrics.wrongEditRate, BENCHMARK_THRESHOLDS.wrongEditRate, "maximum") &&
    evaluateMetric(metrics.defaultReadBounded, BENCHMARK_THRESHOLDS.defaultReadBounded) &&
    evaluateMetric(metrics.paginationCompleteness, BENCHMARK_THRESHOLDS.paginationCompleteness) &&
    evaluateMetric(metrics.conflictRejection, BENCHMARK_THRESHOLDS.conflictRejection) &&
    evaluateMetric(metrics.atomicBatchEdit, BENCHMARK_THRESHOLDS.atomicBatchEdit)
  return {
    corpus: {
      cases: BENCHMARK_CASE_COUNT,
      modules: BENCHMARK_MODULE_COUNT,
      projectedLines: 1 + BENCHMARK_MODULE_COUNT + BENCHMARK_CASE_COUNT * 3,
    },
    thresholds: BENCHMARK_THRESHOLDS,
    metrics,
    outcomes: { passed, failuresByPhase, failureClassification, samples },
  }
}

export function formatBenchmarkSummary(report: BenchmarkReport): string {
  const status = report.outcomes.passed ? "PASS" : "FAIL"
  return `${status} Portal reliability benchmark\nCases: ${report.corpus.cases}; projected lines: ${report.corpus.projectedLines}\nSearch recall: ${report.metrics.searchRecall}/${report.thresholds.searchRecall}\nTarget location: ${report.metrics.targetLocationCorrectness}/${report.thresholds.targetLocationCorrectness}\nPatch first attempt: ${report.metrics.patchFirstAttemptSuccess}/${report.thresholds.patchFirstAttemptSuccess}\nWrong edit rate: ${report.metrics.wrongEditRate}/${report.thresholds.wrongEditRate}\nToken estimate: ${report.metrics.tokenEstimate}\nFailures: ${Object.entries(
    report.outcomes.failuresByPhase
  )
    .map(([phase, count]) => `${phase}=${count}`)
    .join(", ")}`
}

async function main() {
  const report = await runBenchmark()
  const outputDirectory = resolve(process.cwd(), "artifacts")
  const outputPath = resolve(outputDirectory, "document-portal-reliability-benchmark.json")
  await mkdir(outputDirectory, { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`)
  process.stdout.write(`${formatBenchmarkSummary(report)}\nArtifact: ${outputPath}\n`)
  if (!report.outcomes.passed) process.exitCode = 1
}

if (import.meta.url === `file://${process.argv[1]}`) void main()
