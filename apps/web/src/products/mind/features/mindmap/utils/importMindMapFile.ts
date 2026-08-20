import type { MindMapNodeTree } from "simple-mind-map"

import { parseMarkdownFile } from "./markdownParser"
import { importFromZipNested } from "./zipNestedExporter"
import { parseXMindFile } from "./xmindParser"
import { parseZMXmindFile } from "./ZMXMindImporter"

export type XMindImportFormat = "standard" | "zm"

export async function parseMindMapImport(
  file: File,
  xmindFormat: XMindImportFormat = "standard"
): Promise<MindMapNodeTree> {
  const lower = file.name.toLowerCase()
  let parsed: MindMapNodeTree | null
  if (lower.endsWith(".md")) parsed = await parseMarkdownFile(file)
  else if (lower.endsWith(".zip")) parsed = await importFromZipNested(file)
  else if (lower.endsWith(".xmind")) {
    parsed = xmindFormat === "zm" ? await parseZMXmindFile(file) : await parseXMindFile(file)
  } else {
    throw new Error(`Unsupported import file: ${file.name}`)
  }
  if (!parsed) throw new Error(`Import file contains no mind map: ${file.name}`)
  return parsed
}
