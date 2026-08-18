/**
 * ZTDL 编译器 (Zoey Test DSL Compiler)
 *
 * 统一的序列化模块，将 MindMapNodeTree 编译为 ZTDL 文本。
 *
 * 职责：
 * - 全量快照：nodeTree → ZTDL 全量文本
 * - 模块列表：nodeTree → ZTDL 模块摘要（带用例计数）
 * - 单模块详情：moduleNode → ZTDL 模块 + 用例 + 步骤
 * - 搜索结果：caseHits → ZTDL 搜索输出
 *
 * 语法规范：
 *   M:<id>「名称」                        -- 模块
 *   C:<id>「[P优先级]名称」{步骤1|步骤2}  -- 用例 + 步骤
 *   缩进（2空格）表示父子关系
 *   名称用「」包裹，便于前端正则精确匹配，避免贪婪吞掉后续文字
 */

import type { MindMapNodeTree } from './mindmap-node-tree'
import { extractPriorityFromIcons } from './priority-label'

// ─── 基础原子函数 ───────────────────────────────────────────

/**
 * 转义文本中的换行符，避免破坏 ZTDL 每行一节点的格式
 * 换行替换为 \\n 字面量，AI 可识别并在写入时还原
 */
function sanitize(text: string): string {
  return text
    .replace(/\r\n/g, '\\n')
    .replace(/[\r\n]/g, '\\n')
    .trim()
}

/**
 * 格式化步骤列表为 ZTDL 步骤串
 * @returns " {步骤1|步骤2}" 或 ""
 */
export function ztdlSteps(steps: string[]): string {
  const filtered = steps.filter(Boolean).map(sanitize)
  if (filtered.length === 0) return ''
  return ` {${filtered.join('|')}}`
}

/**
 * 格式化一行模块
 */
export function ztdlModule(id: string, name: string, indent: string = ''): string {
  return `${indent}M:${id}「${sanitize(name)}」`
}

/**
 * 格式化一行模块（带用例计数，用于 list_modules）
 */
export function ztdlModuleSummary(
  id: string,
  name: string,
  caseCount: number,
  indent: string = ''
): string {
  return `${indent}M:${id}「${sanitize(name)}」(${caseCount})`
}

/**
 * 格式化一行用例
 */
export function ztdlCase(id: string, name: string, steps: string[], indent: string = ''): string {
  return `${indent}C:${id}「${sanitize(name)}」${ztdlSteps(steps)}`
}

/** UUID → 短 ID 转换回调（由调用方传入，编译器内部不依赖 SessionIdMapper） */
export type ShortenIdFn = (uuid: string) => string

// ─── 树级编译函数 ───────────────────────────────────────────

/**
 * 编译整棵模块子树为 ZTDL 文本行（模块 + 用例 + 步骤 + 子模块递归）
 *
 * 用于：get_module_cases 工具、全量快照
 */
export function compileModuleTree(
  node: MindMapNodeTree | null,
  depth: number = 0,
  shortenId?: ShortenIdFn
): string[] {
  if (!node) return []

  const lines: string[] = []
  const indent = '  '.repeat(depth)
  const rawModuleId = node.data?.uid || ''
  const moduleName = node.data?.text || ''
  const moduleId = shortenId && rawModuleId ? shortenId(rawModuleId) : rawModuleId

  lines.push(ztdlModule(moduleId, moduleName, indent))

  if (node.children && Array.isArray(node.children)) {
    for (const child of node.children) {
      const childIcons = child.data?.icon || []
      const isSubModule = childIcons.includes('sign_2')
      const isCase = childIcons.some((icon: string) => icon.startsWith('priority_'))

      if (isSubModule) {
        lines.push(...compileModuleTree(child, depth + 1, shortenId))
      } else if (isCase) {
        // 用例节点
        const priority = extractPriorityFromIcons(childIcons)
        const childText = child.data?.text || ''
        const rawCaseId = child.data?.uid || ''
        const caseId = shortenId && rawCaseId ? shortenId(rawCaseId) : rawCaseId
        const steps =
          child.children?.map((s: MindMapNodeTree) => s.data?.text || '').filter(Boolean) || []
        lines.push(ztdlCase(caseId, `[P${priority}]${childText}`, steps, `${indent}  `))
      }
    }
  }

  return lines
}

/**
 * 编译模块列表摘要（仅模块节点 + 用例计数，不含用例详情）
 *
 * 用于：list_modules 工具
 */
export function compileModuleList(
  root: MindMapNodeTree,
  depth: number = 0,
  shortenId?: ShortenIdFn
): string[] {
  const lines: string[] = []

  if (!root.children || !Array.isArray(root.children)) {
    return lines
  }

  for (const child of root.children) {
    const text = child.data?.text || ''
    const icons = child.data?.icon || []
    const isModule = icons.includes('sign_2')

    if (isModule) {
      const rawUid = child.data?.uid || ''
      const uid = shortenId && rawUid ? shortenId(rawUid) : rawUid
      const indent = '  '.repeat(depth)

      // 计算直接用例数量（有优先级图标的子节点）
      let caseCount = 0
      if (child.children && Array.isArray(child.children)) {
        caseCount = child.children.filter(c => {
          const ci = c.data?.icon || []
          return ci.some((icon: string) => icon.startsWith('priority_'))
        }).length
      }

      lines.push(ztdlModuleSummary(uid, text, caseCount, indent))
      lines.push(...compileModuleList(child, depth + 1, shortenId))
    }
  }

  return lines
}

/**
 * 编译搜索命中的用例为 ZTDL 文本行
 *
 * 用于：search_cases 工具
 */
export function compileSearchHit(
  caseId: string,
  caseName: string,
  priority: number,
  steps: string[],
  moduleId: string,
  moduleName: string
): string[] {
  return [
    ztdlModule(moduleId, moduleName),
    ztdlCase(caseId, `[P${priority}]${caseName}`, steps, '  ')
  ]
}

// ─── ZTDL Diff 操作符 ─────────────────────────────────────

/** 节点类型 → ZTDL 前缀 */
export type ZtdlNodeType = '模块' | '用例'

export function ztdlPrefix(type: string): string {
  if (type === '模块') return 'M'
  if (type === '用例') return 'C'
  return ''
}

/** +C:<id> <name> > M:<parentId> {steps} */
export function ztdlAdd(
  type: string,
  uid: string,
  text: string,
  parentUid: string,
  steps?: string[]
): string {
  const p = ztdlPrefix(type)
  if (p) {
    const stepsStr = type === '用例' && steps ? ztdlSteps(steps) : ''
    return `+${p}:${uid}「${sanitize(text)}」> M:${parentUid}${stepsStr}`
  }
  return `+${sanitize(text)} > ${parentUid}`
}

/** -M:<id> 或 -C:<id> */
export function ztdlRemove(type: string, uid: string, text: string): string {
  const p = ztdlPrefix(type)
  return p ? `-${p}:${uid}` : `-${text}`
}

/** ~C:<id> name=<new> steps={...} */
export function ztdlModify(type: string, uid: string, attrs: string): string {
  const p = ztdlPrefix(type)
  const safeAttrs = sanitize(attrs)
  return p ? `~${p}:${uid} ${safeAttrs}` : `~${uid} ${safeAttrs}`
}

/** >M:<id> <fromParentId> -> <toParentId> */
export function ztdlMove(type: string, uid: string, fromId: string, toId: string): string {
  const p = ztdlPrefix(type)
  return `>${p}:${uid} ${fromId || 'root'} -> ${toId || 'root'}`
}

/** =M:<newId> from:<srcId> > M:<toParentId> cases:<n> */
export function ztdlCopy(
  type: string,
  newUid: string,
  fromRef: string,
  toParentUid: string,
  caseCount?: number
): string {
  const p = ztdlPrefix(type)
  let line = `=${p}:${newUid} from:${fromRef} > M:${toParentUid || 'root'}`
  if (caseCount && caseCount > 0) {
    line += ` cases:${caseCount}`
  }
  return line
}
