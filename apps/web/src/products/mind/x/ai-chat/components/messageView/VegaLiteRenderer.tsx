import embed from "vega-embed"
import type { VisualizationSpec } from "vega-embed"
import { useEffect, useRef, useState } from "react"
import {
  CodeBlockContainer,
  CodeBlockHeader,
  CodeBlockSkeleton,
  type CustomRendererProps,
} from "streamdown"

function parseSelfContainedSpec(source: string): VisualizationSpec {
  const spec: unknown = JSON.parse(source)
  if (!spec || typeof spec !== "object" || Array.isArray(spec)) {
    throw new Error("Vega-Lite chart must be a JSON object")
  }

  const record = spec as Record<string, unknown>
  if (
    typeof record.$schema === "string" &&
    /^https:\/\/vega\.github\.io\/schema\/vega-lite\/v5(?:\.\d+)*\.json$/.test(record.$schema)
  ) {
    delete record.$schema
  }

  const visit = (value: unknown): void => {
    if (!value || typeof value !== "object") return
    for (const [key, child] of Object.entries(value)) {
      if (key === "url") {
        throw new Error("External resources are not allowed in Vega-Lite charts")
      }
      visit(child)
    }
  }
  visit(spec)
  return spec as VisualizationSpec
}

export function VegaLiteRenderer({ code, language, isIncomplete }: CustomRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (isIncomplete || !container) return

    let cancelled = false
    let finalize: (() => void) | undefined

    const renderChart = async () => {
      try {
        const spec = parseSelfContainedSpec(code)
        if (cancelled) return

        container.replaceChildren()
        const result = await embed(container, spec, {
          actions: false,
          renderer: "svg",
        })
        finalize = result.finalize
        if (!cancelled) setError(null)
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : String(cause))
        }
      }
    }

    void renderChart()
    return () => {
      cancelled = true
      finalize?.()
    }
  }, [code, isIncomplete])

  return (
    <CodeBlockContainer isIncomplete={isIncomplete} language={language}>
      <CodeBlockHeader language={language} />
      {isIncomplete ? <CodeBlockSkeleton /> : null}
      {error ? (
        <pre
          role="alert"
          className="overflow-x-auto rounded-md bg-destructive/10 p-3 text-xs text-destructive"
        >
          {error}
        </pre>
      ) : null}
      <div
        ref={containerRef}
        className={
          isIncomplete || error ? "hidden" : "overflow-x-auto rounded-md bg-background p-4"
        }
      />
    </CodeBlockContainer>
  )
}
