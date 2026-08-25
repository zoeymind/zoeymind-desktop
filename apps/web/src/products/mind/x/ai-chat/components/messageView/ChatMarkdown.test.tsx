// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

const { embedMock, finalizeMock } = vi.hoisted(() => ({
  embedMock: vi.fn(),
  finalizeMock: vi.fn(),
}))

vi.mock("vega-embed", () => ({ default: embedMock }))
import { ChatMarkdown } from "./ChatMarkdown"

beforeAll(() => {
  class IntersectionObserverMock implements IntersectionObserver {
    readonly root = null
    readonly rootMargin = "0px"
    readonly thresholds = [0]
    private readonly callback: IntersectionObserverCallback

    disconnect() {
      // No observer resources in jsdom.
    }
    observe(target: Element) {
      this.callback([{ isIntersecting: true, target } as IntersectionObserverEntry], this)
    }
    takeRecords(): IntersectionObserverEntry[] {
      return []
    }
    unobserve() {
      // No observer resources in jsdom.
    }

    constructor(callback: IntersectionObserverCallback) {
      this.callback = callback
    }
  }

  vi.stubGlobal("IntersectionObserver", IntersectionObserverMock)
})

afterEach(() => {
  cleanup()
  embedMock.mockReset()
  finalizeMock.mockReset()
})

describe("ChatMarkdown", () => {
  it("renders incomplete streaming Markdown without exposing delimiters", () => {
    render(<ChatMarkdown content="**Streaming answer" isStreaming />)

    expect(screen.getByText("Streaming answer").tagName).toBe("SPAN")
    expect(document.body.textContent).not.toContain("**")
  })

  it("renders GFM tables", () => {
    render(<ChatMarkdown content={"| Case | Status |\n| --- | --- |\n| Login | Pass |"} />)

    expect(screen.getByRole("table")).toBeTruthy()
    expect(screen.getByRole("columnheader", { name: "Case" })).toBeTruthy()
    expect(screen.getByRole("cell", { name: "Pass" })).toBeTruthy()
  })

  it("renders highlighted fenced code with controls", async () => {
    render(<ChatMarkdown content={"```ts\nconst answer = 42\n```"} />)

    const code = screen.getByText("const answer = 42")
    expect(code.closest("pre")).toBeTruthy()
    expect(code.closest('[data-streamdown="code-block"]')).toBeTruthy()
    expect(await screen.findByRole("button", { name: "Copy Code" })).toBeTruthy()
  })

  it("renders KaTeX math", () => {
    render(<ChatMarkdown content={"$$E = mc^2$$"} />)

    expect(document.querySelector(".katex")).toBeTruthy()
  })

  it("renders CJK emphasis adjacent to punctuation", () => {
    render(<ChatMarkdown content="**中文文本（带括号）。**这句继续。" />)

    expect(screen.getByText("中文文本（带括号）。").getAttribute("data-streamdown")).toBe("strong")
  })

  it("registers Mermaid diagrams without download controls", async () => {
    render(<ChatMarkdown content={"```mermaid\ngraph TD\nA --> B\n```"} />)

    expect(await screen.findByRole("button", { name: "Copy Code" })).toBeTruthy()
    expect(document.querySelector('[data-streamdown="mermaid-block"]')).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Download diagram" })).toBeNull()
  })

  it("renders self-contained Vega-Lite fences", async () => {
    embedMock.mockImplementation(async (container: HTMLElement) => {
      container.textContent = "Rendered chart"
      return { finalize: finalizeMock }
    })
    render(
      <ChatMarkdown
        content={
          '```vega-lite\n{"data":{"values":[{"x":"A","y":1}]},"mark":"bar","encoding":{"x":{"field":"x"},"y":{"field":"y"}}}\n```'
        }
      />
    )

    expect(await screen.findByText("Rendered chart")).toBeTruthy()
    expect(embedMock).toHaveBeenCalledOnce()
    expect(embedMock.mock.calls[0]?.[2]).toMatchObject({ actions: false, renderer: "svg" })
  })

  it("defers incomplete Vega-Lite fences", () => {
    render(<ChatMarkdown content={'```vega-lite\n{"mark":"bar"'} isStreaming />)

    expect(embedMock).not.toHaveBeenCalled()
    expect(document.querySelector('[data-streamdown="code-block"]')).toBeTruthy()
  })

  it("accepts saved Vega-Lite v5 specs without forwarding the legacy schema", async () => {
    embedMock.mockResolvedValue({ finalize: finalizeMock })
    render(
      <ChatMarkdown
        content={
          '```vega-lite\n{"$schema":"https://vega.github.io/schema/vega-lite/v5.json","data":{"values":[]},"mark":"bar"}\n```'
        }
      />
    )

    await vi.waitFor(() => expect(embedMock).toHaveBeenCalledOnce())
    expect(embedMock.mock.calls[0]?.[1]).not.toHaveProperty("$schema")
  })

  it("reports invalid and external Vega-Lite specs", async () => {
    const { rerender } = render(<ChatMarkdown content={"```vega-lite\nnot-json\n```"} />)
    expect((await screen.findByRole("alert")).textContent).toMatch(/JSON/)
    expect(embedMock).not.toHaveBeenCalled()

    rerender(
      <ChatMarkdown
        content={'```vega-lite\n{"data":{"url":"https://example.com/data.json"}}\n```'}
      />
    )
    expect((await screen.findByRole("alert")).textContent).toMatch(/External resources/)
    expect(embedMock).not.toHaveBeenCalled()
  })

  it("preserves legacy mention presentation through sanitization", () => {
    render(
      <ChatMarkdown content={'Target <span class="mention-tag nid-node-1">Login case</span>'} />
    )

    expect(screen.getByText("Login case").classList.contains("mention-tag")).toBe(true)
  })

  it("removes executable HTML from model output", () => {
    render(<ChatMarkdown content={'Safe<script>alert("unsafe")</script>'} />)

    expect(document.querySelector("script")).toBeNull()
    expect(document.body.textContent).not.toContain("alert")
  })
})
