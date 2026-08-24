const FENCE_RE = /^\s{0,3}(`{3,}|~{3,})/
const BLOCK_CONTINUATION_RE = /^(\s{4,}\S|\s*([-*+]|\d+[.)])\s)/

export function splitMarkdownBlocks(markdown: string): string[] {
  const lines = markdown.split("\n")
  const blocks: string[] = []
  let current: string[] = []
  let fenceChar: string | null = null
  let pendingBlanks = 0

  const flush = () => {
    if (current.length > 0) {
      blocks.push(current.join("\n"))
      current = []
    }
    pendingBlanks = 0
  }

  for (const line of lines) {
    const fenceMatch = FENCE_RE.exec(line)
    if (fenceMatch) {
      const char = fenceMatch[1][0]
      if (fenceChar === null) fenceChar = char
      else if (char === fenceChar) fenceChar = null
    }

    if (fenceChar === null && line.trim() === "") {
      if (current.length > 0) pendingBlanks += 1
      continue
    }

    if (pendingBlanks > 0) {
      if (BLOCK_CONTINUATION_RE.test(line)) {
        for (let index = 0; index < pendingBlanks; index += 1) current.push("")
        pendingBlanks = 0
      } else {
        flush()
      }
    }
    current.push(line)
  }
  flush()
  return blocks.length > 0 ? blocks : [markdown]
}
