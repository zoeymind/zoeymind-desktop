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
export declare function getMetaMap(doc: any): any
export declare function getNodesMap(doc: any): any
export declare function getChildrenMap(doc: any): any
export declare function getRootId(doc: any): string
export declare function isDocInitialized(doc: any): boolean
export declare function writeTreeToDoc(doc: any, tree: any, origin: any): string
export declare function readTreeFromDoc(doc: Y.Doc): MindMapNodeTree | null
export declare function countNodes(doc: any): any
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
export declare function applyTreePatch(doc: any, newTree: any, prevTree: any, origin: any): string
