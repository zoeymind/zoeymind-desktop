import { save as saveDialog } from "@tauri-apps/plugin-dialog"
import type MindMap from "simple-mind-map"

import { writeBytesAtomically } from "@/shared/native/atomic-file"
import { XMindExporter } from "./XMindExporter"
import { ZMXMindExporter } from "./ZMXMindExporter"
import { convertMindMapNodeTreeToMarkdownWithIcons } from "./markdownParser"
import { exportToZipNested } from "./zipNestedExporter"

export const IMPORT_EXTENSIONS = ["xmind", "md", "zip"] as const
export const IMPORT_ACCEPT = IMPORT_EXTENSIONS.map(extension => `.${extension}`).join(",")

export const EXPORT_FORMATS = [
  "png",
  "svg",
  "pdf",
  "md",
  "json",
  "txt",
  "xmind",
  "zmxmind",
  "zip",
] as const

export type ExportFormat = (typeof EXPORT_FORMATS)[number]

export const EXPORT_FORMAT_I18N_KEYS: Record<ExportFormat, string> = {
  png: "mindmap.topbar.more.exportPng",
  svg: "mindmap.topbar.more.exportSvg",
  pdf: "mindmap.topbar.more.exportPdf",
  md: "mindmap.topbar.more.exportMd",
  json: "mindmap.topbar.more.exportJson",
  txt: "mindmap.topbar.more.exportTxt",
  xmind: "mindmap.topbar.more.exportXmind",
  zmxmind: "mindmap.topbar.more.exportZmxmind",
  zip: "mindmap.topbar.more.exportZip",
}

const EXPORT_FILE_TYPES: Record<ExportFormat, { extension: string; filterName: string }> = {
  png: { extension: "png", filterName: "PNG Image" },
  svg: { extension: "svg", filterName: "SVG Image" },
  pdf: { extension: "pdf", filterName: "PDF Document" },
  md: { extension: "md", filterName: "Markdown" },
  json: { extension: "json", filterName: "JSON" },
  txt: { extension: "txt", filterName: "Text" },
  xmind: { extension: "xmind", filterName: "XMind" },
  zmxmind: { extension: "xmind", filterName: "MeterSphere XMind" },
  zip: { extension: "zip", filterName: "ZIP Archive" },
}

export function sanitizeExportFilename(value: unknown): string {
  const text = typeof value === "string" ? value : ""
  const withoutControlCharacters = Array.from(text, character =>
    character.charCodeAt(0) < 32 ? "_" : character
  ).join("")
  const sanitized = withoutControlCharacters
    .replace(/[<>:"/\\|?*]/g, "_")
    .replace(/[. ]+$/g, "")
    .trim()
  return sanitized || "Untitled"
}

async function dataUrlOrTextToBytes(value: string): Promise<Uint8Array> {
  if (!value.startsWith("data:")) return new TextEncoder().encode(value)
  const response = await fetch(value)
  if (!response.ok) throw new Error(`Could not decode exported data (${response.status})`)
  return new Uint8Array(await response.arrayBuffer())
}

export async function createMindMapExport(
  mindMap: MindMap,
  format: ExportFormat
): Promise<Uint8Array> {
  const data = mindMap.getData()
  const title = sanitizeExportFilename(data.data?.text)
  let payload: Blob | string | undefined

  switch (format) {
    case "png":
      payload = await mindMap.doExport?.png(title, false)
      break
    case "svg":
      payload = await mindMap.doExport?.svg(title)
      break
    case "pdf":
      payload = await mindMap.doExport?.pdf(title, false)
      break
    case "md":
      payload = await convertMindMapNodeTreeToMarkdownWithIcons(data)
      break
    case "json":
      payload = await mindMap.doExport?.json("", true)
      break
    case "txt":
      payload = await mindMap.doExport?.txt()
      break
    case "xmind":
      payload = await new XMindExporter(mindMap).export()
      break
    case "zmxmind":
      payload = await new ZMXMindExporter(mindMap).export()
      break
    case "zip":
      payload = await exportToZipNested(mindMap)
      break
  }

  if (payload instanceof Blob) return new Uint8Array(await payload.arrayBuffer())
  if (typeof payload === "string" && payload.length > 0) return dataUrlOrTextToBytes(payload)
  throw new Error(`Exporter returned no data for ${format}`)
}

export async function exportMindMapToFile(
  mindMap: MindMap,
  format: ExportFormat
): Promise<boolean> {
  const fileType = EXPORT_FILE_TYPES[format]
  const title = sanitizeExportFilename(mindMap.getData().data?.text)
  const path = await saveDialog({
    defaultPath: `${title}.${fileType.extension}`,
    filters: [{ name: fileType.filterName, extensions: [fileType.extension] }],
  })
  if (!path) return false

  await writeBytesAtomically(path, await createMindMapExport(mindMap, format))
  return true
}

export function isExportFormat(value: string): value is ExportFormat {
  return EXPORT_FORMATS.includes(value as ExportFormat)
}
