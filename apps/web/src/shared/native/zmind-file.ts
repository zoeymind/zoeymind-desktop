/**
 * .zmind 文件 = ZIP bundle。
 *
 * 内部结构：
 *   tree.json     完整 MindMapNodeTree（节点树）
 *   view.json     视图变换（缩放/平移），nullable
 *   preview.png   缩略图；由 `composePreviewWithLogo()` 合成 —— 引擎导出的思维导图
 *                 缩略图 + 品牌 logo 水印（右下角/侧栏），列表卡片和 bundle 里共用同一份。
 *   meta.json     { name, tags[], createdAt, updatedAt, nodeCount }
 *   recovery.json 仅容灾快照里存在（recovery/*.zmind），保存 sourcePath / savedAt / projectId。
 *
 * 用 JSZip 序列化，磁盘 IO 走 tauri-plugin-fs 的二进制接口。
 * 用户可在 Finder 里随意移动 .zmind，索引里存的是绝对路径，运行时 exists() 判失效。
 */
import JSZip from 'jszip'
import { readFile, exists } from '@tauri-apps/plugin-fs'
import type { MindMapNodeTree } from 'simple-mind-map'
import { writeBytesAtomically } from './atomic-file'

export interface ZMindMeta {
  name: string
  tags: string[]
  createdAt: number
  updatedAt: number
  nodeCount: number
}

export interface ZMindBundle {
  tree: MindMapNodeTree
  view?: unknown
  previewPng?: Uint8Array | null
  meta: ZMindMeta
}

export async function packBundle(bundle: ZMindBundle): Promise<Uint8Array> {
  const zip = new JSZip()
  zip.file('tree.json', JSON.stringify(bundle.tree))
  if (bundle.view !== undefined) {
    zip.file('view.json', JSON.stringify(bundle.view))
  }
  if (bundle.previewPng) {
    zip.file('preview.png', bundle.previewPng)
  }
  zip.file('meta.json', JSON.stringify(bundle.meta))
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' })
}

export async function unpackBundle(bytes: Uint8Array): Promise<ZMindBundle> {
  const zip = await JSZip.loadAsync(bytes)
  const treeFile = zip.file('tree.json')
  const metaFile = zip.file('meta.json')
  if (!treeFile || !metaFile) {
    throw new Error('invalid .zmind: missing tree.json or meta.json')
  }
  const tree = JSON.parse(await treeFile.async('string')) as MindMapNodeTree
  const meta = JSON.parse(await metaFile.async('string')) as ZMindMeta

  const viewFile = zip.file('view.json')
  const view = viewFile ? JSON.parse(await viewFile.async('string')) : undefined

  const pngFile = zip.file('preview.png')
  const previewPng = pngFile ? await pngFile.async('uint8array') : null

  return { tree, view, meta, previewPng }
}

export async function readBundle(path: string): Promise<ZMindBundle> {
  const bytes = await readFile(path)
  return unpackBundle(bytes)
}

export async function writeBundle(path: string, bundle: ZMindBundle): Promise<void> {
  const bytes = await packBundle(bundle)
  await writeBytesAtomically(path, bytes)
}

export async function bundleExists(path: string): Promise<boolean> {
  return exists(path)
}

/** 只读元数据，跳过 tree/view 解析（列表页刷新用）。 */
export async function readMeta(path: string): Promise<ZMindMeta | null> {
  if (!(await exists(path))) return null
  const bytes = await readFile(path)
  const zip = await JSZip.loadAsync(bytes)
  const metaFile = zip.file('meta.json')
  if (!metaFile) return null
  return JSON.parse(await metaFile.async('string')) as ZMindMeta
}
