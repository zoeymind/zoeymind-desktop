// @ts-nocheck — dormant AI chat / MCP module (bridge.tsx flattens to no-op)
import type { Tool } from '../../../ai-chat/tools/types'
import { UpdateCasesSchema } from '@zoeymind/shared'
import {
  parsePriorityFromText,
  createPriorityIcons,
  extractPriorityFromIcons
} from './priority-label'
import { buildMindMapUidIndex, type MindMapNodeTree } from './mindmap-node-tree'

/**
 * 批量修改测试用例工具（基于用例ID）
 */
export const updateCasesTool: Tool = {
  name: 'update_cases',
  label: '更新用例',
  description:
    '批量更新测试用例信息（名称、步骤等）。**建议一次性更新所有需要修改的用例**，而不是逐个更新，可以提高效率。',
  parameters: {
    updates: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          caseId: {
            type: 'string',
            description: '要修改的用例ID',
            required: true
          },
          case: {
            type: 'string',
            description: '新的用例文本（可选，可以包含优先级前缀如 [P1]）',
            required: false
          },
          steps: {
            type: 'array',
            items: { type: 'string' },
            description: '新的步骤数组（可选）',
            required: false
          }
        }
      },
      description: '用例更新数组，每项包含 caseId、case 和 steps 字段',
      required: true
    }
  },
  handler: async (args, context) => {
    const { mindMap } = context

    // 使用 Zod 校验参数（共享 schema）
    const parseResult = UpdateCasesSchema.safeParse(args)
    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0]
      return {
        success: false,
        error:
          firstError.message +
          (firstError.path.length > 0 ? ` (路径: ${firstError.path.join('.')})` : '')
      }
    }

    const { updates } = parseResult.data

    if (!mindMap) {
      return {
        success: false,
        error: '思维导图实例不存在'
      }
    }

    const snapshot = mindMap.getData()

    if (!snapshot) {
      return {
        success: false,
        error: '无法获取思维导图数据'
      }
    }

    const uidIndex = buildMindMapUidIndex(snapshot)
    const { idMapper } = context
    const results: Array<{
      caseId: string
      success: boolean
      error?: string
    }> = []
    const ztdlOk: string[] = []
    const ztdlFail: string[] = []

    let hasMutation = false

    for (const update of updates) {
      try {
        const { caseId, case: newCase, steps: newSteps } = update

        if (!caseId) {
          results.push({ caseId: '', success: false, error: 'caseId 不能为空' })
          ztdlFail.push('!C:(empty) caseId为空')
          continue
        }

        const resolvedCaseId = context.idMapper.tryResolve(caseId)
        const entry = uidIndex.get(resolvedCaseId)
        if (!entry) {
          const shortId = idMapper.shorten(caseId)
          results.push({ caseId, success: false, error: `未找到ID为 "${shortId}" 的用例` })
          ztdlFail.push(`!C:${shortId} 用例不存在`)
          continue
        }

        // 步骤格式校验：每步必须含 " & " 分隔操作和预期
        if (newSteps !== undefined && Array.isArray(newSteps)) {
          const shortId = idMapper.shorten(caseId)
          const badStep = newSteps.findIndex(s => !s.includes(' & '))
          if (badStep !== -1) {
            const reason = `第${badStep + 1}步缺少 " & " 分隔符`
            results.push({ caseId, success: false, error: reason })
            ztdlFail.push(`!C:${shortId} ${reason}`)
            continue
          }
          const multiAmp = newSteps.findIndex(s => s.split(' & ').length > 2)
          if (multiAmp !== -1) {
            const reason = `第${multiAmp + 1}步包含多个 " & "，请拆分`
            results.push({ caseId, success: false, error: reason })
            ztdlFail.push(`!C:${shortId} ${reason}`)
            continue
          }
        }

        const targetNode = entry.node
        const nodeData = targetNode.data

        const processText = (text: string) => {
          if (!text) return text
          return text.replace(/\\n/g, '\n')
        }

        if (newCase !== undefined) {
          const { priority, cleanText } = parsePriorityFromText(newCase)
          const currentIcons = Array.isArray(nodeData.icon) ? nodeData.icon : []
          const finalPriority = priority ?? extractPriorityFromIcons(currentIcons) ?? 2
          nodeData.text = processText(cleanText)
          nodeData.icon = createPriorityIcons(finalPriority)
          hasMutation = true
        }

        if (newSteps !== undefined && Array.isArray(newSteps)) {
          targetNode.children = newSteps.map((step: string) => ({
            data: { text: processText(step) },
            children: []
          }))
          hasMutation = true
        }

        results.push({ caseId, success: true })

        const caseShort = idMapper.shorten(caseId)
        const icons: string[] = Array.isArray(nodeData.icon) ? nodeData.icon : []
        const pIcon = icons.find((i: string) => i.startsWith('priority_'))
        const pl = pIcon ? pIcon.replace('priority_', '') : '2'
        const parentUid = entry.parent?.data?.uid || ''
        const parentShort = parentUid ? idMapper.shorten(parentUid) : ''
        ztdlOk.push(
          `~C:${caseShort} [P${pl}]${nodeData.text}${parentShort ? ` > M:${parentShort}` : ''}`
        )
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error)
        const failId = update.caseId ? idMapper.shorten(update.caseId) : '?'
        results.push({ caseId: update.caseId || '', success: false, error: reason })
        ztdlFail.push(`!C:${failId} ${reason}`)
      }
    }

    const successCount = results.filter(r => r.success).length
    const failedCount = updates.length - successCount

    if (hasMutation && successCount > 0) {
      try {
        mindMap.updateData(snapshot)
      } catch (error) {
        return {
          success: false,
          error: `批量更新用例失败: ${error instanceof Error ? error.message : String(error)}`
        }
      }
    }

    const ztdlParts: string[] = []
    if (ztdlOk.length > 0) ztdlParts.push(...ztdlOk)
    if (ztdlFail.length > 0) ztdlParts.push(...ztdlFail)
    const header = `~${successCount}ok/${failedCount}fail`

    return {
      success: successCount > 0,
      data: {
        total: updates.length,
        successCount,
        failedCount,
        results
      },
      ztdl: ztdlParts.length > 0 ? `${header}\n${ztdlParts.join('\n')}` : header
    }
  }
}