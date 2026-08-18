/**
 * 思维导图节点级 CRDT 数据模型 (客户端实现)
 *
 * 与服务端 apps/api/src/services/collaboration/node-tree.ts 保持语义一致。
 *
 * Y.Doc layout:
 *   meta:     Y.Map<string, JSON>
 *   nodes:    Y.Map<uid, Y.Map<string, JSON>>
 *   children: Y.Map<uid, Y.Array<uid>>
 *
 * 设计原则：
 *   - 节点字段写入 nodes.get(uid)，每个字段是 Y.Map 一项，并发改不同字段不冲突
 *   - 子节点顺序写入 children.get(uid)，Y.Array<uid>，move/insert/delete 各自原子
 *   - 不在 node Y.Map 内嵌套 children，避免双重存储
 *   - uid 是节点稳定 ID，存在 children Y.Array 里；node Y.Map 不存 uid 字段（key 即 uid）
 */
import * as Y from 'yjs'
import type { MindMapNodeTree } from '../../index'

// ── 常量 ──────────────────────────────────────────────

const META_MAP = 'meta'
const NODES_MAP = 'nodes'
const CHILDREN_MAP = 'children'
const ROOT_ID_KEY = 'rootId'

// ── 工具 ──────────────────────────────────────────────

function generateUid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  // RFC4122 v4 fallback
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

// ── Doc 访问器 ────────────────────────────────────────

export function getMetaMap(doc) {
  return doc.getMap(META_MAP)
}

export function getNodesMap(doc) {
  return doc.getMap(NODES_MAP)
}

export function getChildrenMap(doc) {
  return doc.getMap(CHILDREN_MAP)
}

export function getRootId(doc) {
  const id = getMetaMap(doc).get(ROOT_ID_KEY)
  return typeof id === 'string' && id.length > 0 ? id : null
}

export function isDocInitialized(doc) {
  return getRootId(doc) !== null
}

// ── tree → Y.Doc (全量写入，仅初始化) ─────────────────

export function writeTreeToDoc(doc, tree, origin) {
  let rootId = ''
  doc.transact(() => {
    const meta = getMetaMap(doc)
    const nodes = getNodesMap(doc)
    const children = getChildrenMap(doc)

    Array.from(nodes.keys()).forEach(k => nodes.delete(k))
    Array.from(children.keys()).forEach(k => children.delete(k))

    function walk(node) {
      const uid = (node && node.data && node.data.uid) || generateUid()
      const nodeMap = new Y.Map()
      if (node && node.data) {
        Object.keys(node.data).forEach(key => {
          if (key === 'uid') return
          nodeMap.set(key, node.data[key])
        })
      }
      nodes.set(uid, nodeMap)

      const childArr = new Y.Array()
      const childUids = (node && Array.isArray(node.children) ? node.children : []).map(walk)
      if (childUids.length > 0) childArr.insert(0, childUids)
      children.set(uid, childArr)

      return uid
    }

    rootId = walk(tree)
    meta.set(ROOT_ID_KEY, rootId)
  }, origin)
  return rootId
}

// ── Y.Doc → tree ──────────────────────────────────────
export function readTreeFromDoc(doc: Y.Doc): MindMapNodeTree | null {
  const rootId = getRootId(doc)
  if (!rootId) return null

  const nodes = getNodesMap(doc)
  const children = getChildrenMap(doc)

  const visited = new Set()
  function build(uid) {
    if (visited.has(uid)) return null
    visited.add(uid)

    const nodeMap = nodes.get(uid)
    if (!nodeMap) return null

    const data = { uid }
    nodeMap.forEach((value, key) => {
      data[key] = value
    })

    const childArr = children.get(uid)
    const childUids = childArr ? childArr.toArray() : []
    const childTrees = []
    for (const childUid of childUids) {
      const child = build(childUid)
      if (child) childTrees.push(child)
    }
    return { data, children: childTrees }
  }
  return build(rootId) as MindMapNodeTree | null
}

// ── 节点统计 ──────────────────────────────────────────

export function countNodes(doc) {
  return getNodesMap(doc).size
}

// ── 增量 patch：tree (local) → Y.Doc ops ─────────────

/**
 * 基于"前后两棵 tree"做最小 patch，仅对实际变动的字段/子节点列表做 CRDT 写入。
 *
 * @param {Y.Doc} doc
 * @param {Object} newTree   - 用户操作后的新树
 * @param {Object|null} prevTree - 上一次同步成功的树（首次同步传 null 走全量）
 * @param {any} origin       - transaction.origin，用于本地 handler 忽略自己的写入
 * @returns {string} rootId
 *
 * 算法：
 *   1) 索引 prev / next 的所有 uid → data (除 children)
 *   2) prev 有 next 无 → 删 node + 删 children
 *   3) next 有 prev 无 → 新 Y.Map(data) + Y.Array<childUid>
 *   4) 两边都有：
 *        - data 字段逐项 diff，仅写入变化的 key
 *        - childUids 数组若不同，用三段法 (公共前缀 / 中段全替 / 公共后缀) 调整 Y.Array
 *   5) 写 meta.rootId（若变更）
 */
export function applyTreePatch(doc, newTree, prevTree, origin) {
  const { index: nextIndex, rootUid: nextRootUid } = indexTree(newTree)
  const { index: prevIndex } = prevTree ? indexTree(prevTree) : { index: new Map() }

  let rootId = ''
  doc.transact(() => {
    const meta = getMetaMap(doc)
    const nodes = getNodesMap(doc)
    const children = getChildrenMap(doc)

    // 1. 删除 prev 独有的节点
    for (const uid of prevIndex.keys()) {
      if (!nextIndex.has(uid)) {
        nodes.delete(uid)
        children.delete(uid)
      }
    }

    // 2. 处理 next 中的每个节点：新增 or 字段 diff
    for (const [uid, info] of nextIndex) {
      if (!prevIndex.has(uid)) {
        // 新节点：构造 Y.Map + Y.Array
        const nodeMap = new Y.Map()
        for (const k of Object.keys(info.data)) {
          if (k === 'uid') continue
          nodeMap.set(k, info.data[k])
        }
        nodes.set(uid, nodeMap)

        const childArr = new Y.Array()
        if (info.childUids.length > 0) childArr.insert(0, info.childUids)
        children.set(uid, childArr)
      } else {
        // 已存在：字段 diff
        const prevInfo = prevIndex.get(uid)
        const nodeMap = nodes.get(uid)
        if (nodeMap) {
          patchNodeFields(nodeMap, info.data, prevInfo.data)
        } else {
          // 异常恢复：旧索引有但 Y.Doc 没（迁移残留），新建
          const newMap = new Y.Map()
          for (const k of Object.keys(info.data)) {
            if (k === 'uid') continue
            newMap.set(k, info.data[k])
          }
          nodes.set(uid, newMap)
        }

        // 子节点顺序 diff
        const childArr = children.get(uid)
        if (!childArr) {
          const fresh = new Y.Array()
          if (info.childUids.length > 0) fresh.insert(0, info.childUids)
          children.set(uid, fresh)
        } else {
          patchChildArray(childArr, info.childUids, prevInfo.childUids)
        }
      }
    }

    // 3. 更新 rootId
    rootId = nextRootUid || ''
    const currentRoot = meta.get(ROOT_ID_KEY)
    if (rootId && rootId !== currentRoot) {
      meta.set(ROOT_ID_KEY, rootId)
    } else if (typeof currentRoot === 'string' && currentRoot) {
      rootId = currentRoot
    }
  }, origin)
  return rootId
}

// ── 内部：tree 索引 ───────────────────────────────────

function indexTree(tree) {
  const index = new Map()
  let rootUid = null

  function walk(node, isRoot) {
    if (!node || typeof node !== 'object') return null
    let uid = node.data && node.data.uid
    if (!uid) uid = generateUid()

    // 同 uid 重复挂载 → 第二个生成新 uid，避免 nodes Map 主键冲突
    // (典型场景：复制粘贴节点时，simple-mind-map 内部对 uid 处理不彻底)
    if (index.has(uid)) uid = generateUid()

    const childUids = []
    if (Array.isArray(node.children)) {
      for (const child of node.children) {
        const cuid = walk(child, false)
        if (cuid) childUids.push(cuid)
      }
    }

    const data = {}
    if (node.data) {
      for (const key of Object.keys(node.data)) {
        if (key === 'uid') continue
        data[key] = node.data[key]
      }
    }

    index.set(uid, { data, childUids })
    if (isRoot) rootUid = uid
    return uid
  }

  walk(tree, true)
  return { index, rootUid }
}

// ── 内部：字段级 patch ────────────────────────────────

function patchNodeFields(nodeMap, nextData, prevData) {
  const nextKeys = Object.keys(nextData)
  const prevKeys = Object.keys(prevData || {})

  // 删除 next 中已没有的字段
  for (const key of prevKeys) {
    if (!(key in nextData)) {
      nodeMap.delete(key)
    }
  }
  // 写入变化的字段
  for (const key of nextKeys) {
    const nextVal = nextData[key]
    const prevVal = prevData ? prevData[key] : undefined
    if (!shallowEqual(nextVal, prevVal)) {
      nodeMap.set(key, nextVal)
    }
  }
}

// ── 内部：子节点数组 patch (三段法) ───────────────────

function patchChildArray(yArr, next, prev) {
  if (arraysEqual(next, prev)) return

  // 计算公共前缀
  let prefix = 0
  const minLen = Math.min(next.length, prev.length)
  while (prefix < minLen && next[prefix] === prev[prefix]) prefix++

  // 计算公共后缀
  let suffix = 0
  while (
    suffix < next.length - prefix &&
    suffix < prev.length - prefix &&
    next[next.length - 1 - suffix] === prev[prev.length - 1 - suffix]
  ) {
    suffix++
  }

  const delStart = prefix
  const delLen = prev.length - prefix - suffix
  const insertSlice = next.slice(prefix, next.length - suffix)

  if (delLen > 0) yArr.delete(delStart, delLen)
  if (insertSlice.length > 0) yArr.insert(delStart, insertSlice)
}

// ── 内部：比较 ────────────────────────────────────────

function arraysEqual(a, b) {
  if (a === b) return true
  if (!Array.isArray(a) || !Array.isArray(b)) return false
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}

function shallowEqual(a, b) {
  if (a === b) return true
  if (typeof a !== typeof b) return false
  if (a === null || b === null) return a === b
  if (typeof a !== 'object') return a === b
  // 对象/数组：JSON 比对（思维导图节点字段是 JSON 安全的）
  try {
    return JSON.stringify(a) === JSON.stringify(b)
  } catch {
    return false
  }
}
