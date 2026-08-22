/**
 * diff-engine — 计算当前 mindmap tree 相对 baseline 的节点级 diff.
 *
 * baseline: 上次 save 或首次 open 时的 tree, 以 uid → NodeSnapshot map 存储.
 * current: mindmap.getData() 拿到的当前 tree.
 *
 * 输出四类变更, 全部按稳定的 uid 关联:
 *   - add:    uid 在 current 里, baseline 里没有
 *   - remove: uid 在 baseline 里, current 里没有
 *   - modify: uid 在两者里, 但 text / icon / priority / hyperlink / note 有一项不同
 *   - move:   uid 在两者里, parent uid 不同 (index 变化不算, 太吵)
 *
 * modify + move 可以同时命中 (改文案又改位置), 各自计入.
 *
 * 引擎不做 word-level 文本 diff. text diff 显示放 popover, 由消费方按需调用 jsdiff.
 */
import type { MindMapNodeTree, MindMapNodeData } from "simple-mind-map"

export interface NodeSnapshot {
  uid: string
  parentUid: string | null
  text: string
  icon: string[]
  hyperlink: string
  note: string
  richText: boolean
  /** true = 已被标记为软删除, 保存时真删. baseline 里永远为 false. */
  pendingDelete: boolean
}

export interface DiffState {
  addedUids: Set<string>
  removedUids: Set<string>
  modifiedUids: Set<string>
  movedUids: Set<string>
  /** 每个 uid 的 baseline 快照, 供 tooltip / summary 面板显示 before */
  baselineByUid: Map<string, NodeSnapshot>
  /** 每个 uid 的当前快照, 供 summary 面板显示 after / 定位 */
  currentByUid: Map<string, NodeSnapshot>
}

/** 空 diff, 用于 baseline 首次装载完成前的 UI 占位. */
export function emptyDiffState(): DiffState {
  return {
    addedUids: new Set(),
    removedUids: new Set(),
    modifiedUids: new Set(),
    movedUids: new Set(),
    baselineByUid: new Map(),
    currentByUid: new Map(),
  }
}

/** 把一棵 tree 摊平成 uid → snapshot map. 没有 uid 的节点跳过 (理论上不该出现). */
export function snapshotTree(tree: MindMapNodeTree): Map<string, NodeSnapshot> {
  const map = new Map<string, NodeSnapshot>()
  walkTree(tree, null, (node, parentUid) => {
    const uid = node.data.uid
    if (typeof uid !== "string" || uid.length === 0) return
    map.set(uid, toSnapshot(uid, parentUid, node.data))
  })
  return map
}

/** 主入口: 计算 current vs baseline 的 diff. */
export function computeDiff(
  current: MindMapNodeTree,
  baseline: Map<string, NodeSnapshot>
): DiffState {
  const currentByUid = snapshotTree(current)
  const addedUids = new Set<string>()
  const removedUids = new Set<string>()
  const modifiedUids = new Set<string>()
  const movedUids = new Set<string>()

  for (const [uid, cur] of currentByUid) {
    // 软删标记视为逻辑删除, 无需再看 modify/move
    if (cur.pendingDelete) {
      removedUids.add(uid)
      continue
    }
    const base = baseline.get(uid)
    if (!base) {
      addedUids.add(uid)
      continue
    }
    if (base.parentUid !== cur.parentUid) movedUids.add(uid)
    if (isContentDifferent(base, cur)) modifiedUids.add(uid)
  }
  for (const uid of baseline.keys()) {
    if (!currentByUid.has(uid)) removedUids.add(uid)
  }
  return {
    addedUids,
    removedUids,
    modifiedUids,
    movedUids,
    baselineByUid: baseline,
    currentByUid,
  }
}

function isContentDifferent(a: NodeSnapshot, b: NodeSnapshot): boolean {
  if (a.text !== b.text) return true
  if (a.hyperlink !== b.hyperlink) return true
  if (a.note !== b.note) return true
  if (a.richText !== b.richText) return true
  if (a.icon.length !== b.icon.length) return true
  for (let i = 0; i < a.icon.length; i += 1) if (a.icon[i] !== b.icon[i]) return true
  return false
}

function toSnapshot(uid: string, parentUid: string | null, data: MindMapNodeData): NodeSnapshot {
  return {
    uid,
    parentUid,
    text: typeof data.text === "string" ? data.text : "",
    icon: Array.isArray(data.icon) ? [...data.icon] : [],
    hyperlink: typeof data.hyperlink === "string" ? data.hyperlink : "",
    note: typeof data.note === "string" ? data.note : "",
    richText: data.richText === true,
    pendingDelete: data.pendingDelete === true,
  }
}

function walkTree(
  node: MindMapNodeTree,
  parentUid: string | null,
  visit: (node: MindMapNodeTree, parentUid: string | null) => void
): void {
  visit(node, parentUid)
  const uid = typeof node.data.uid === "string" ? node.data.uid : null
  const children = Array.isArray(node.children) ? node.children : []
  for (const child of children) walkTree(child, uid, visit)
}

/** 总 diff 数. summary badge 用. */
export function diffCount(state: DiffState): number {
  return (
    state.addedUids.size + state.removedUids.size + state.modifiedUids.size + state.movedUids.size
  )
}

/** 是否所有集合都为空. */
export function isDiffEmpty(state: DiffState): boolean {
  return diffCount(state) === 0
}
