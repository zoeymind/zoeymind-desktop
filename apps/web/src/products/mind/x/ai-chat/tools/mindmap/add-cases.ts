// @ts-nocheck — desktop mirror of cloud AI chat; runtime bridged via bridge.tsx
import type { Tool } from '../../../ai-chat/tools/types'
import { AddCasesSchema } from '@zoeymind/shared'
import { parsePriorityFromText, createPriorityIcons } from './priority-label'
import { findNodeByUid } from './mindmap-node-tree'
import { createUUID } from '@/shared/app-shared'

/**
 * 批量添加用例工具
 *
 * 向指定模块批量添加测试用例
 */
export const addCasesTool: Tool = {
  name: 'add_cases',
  label: '添加用例',
  description: '批量添加测试用例到指定模块。',
  parameters: {
    moduleId: {
      type: 'string',
      description: '目标模块ID',
      required: true
    },
    cases: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          case: {
            type: 'string',
            required: true,
            description:
              '必填项，格式：[P1/P2/P3]用例名称 & 前置条件。优先级和用例名称都是必填，前置条件可选。例如："[P1]登陆-手机号验证 & 未登录"'
          },
          steps: {
            type: 'array',
            items: { type: 'string' },
            required: true,
            description:
              '测试步骤和预期结果为非空数组，每个步骤必须包含 "&" 符号来分隔操作和预期结果，例如："点击按钮 & 这个操作成功"'
          }
        }
      },
      description:
        '测试用例数组，每个用例包含 case 和 steps 字段。用例遵循"模块->用例->步骤&预期"层次结构',
      required: true
    }
  },
  handler: async (args, context) => {
    const { mindMap } = context

    // 使用 Zod 校验参数（共享 schema）
    const parseResult = AddCasesSchema.safeParse(args)
    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0]
      return {
        success: false,
        error:
          firstError.message +
          (firstError.path.length > 0 ? ` (路径: ${firstError.path.join('.')})` : '')
      }
    }

    const { moduleId, cases } = parseResult.data

    for (let caseIndex = 0; caseIndex < cases.length; caseIndex += 1) {
      const steps = cases[caseIndex].steps || []
      for (let stepIndex = 0; stepIndex < steps.length; stepIndex += 1) {
        const step = steps[stepIndex]
        if (!step.includes(' & ')) {
          return {
            success: false,
            error: `用例 ${caseIndex + 1}「${cases[caseIndex].case || ''}」的第 ${stepIndex + 1} 步缺少 " & " 分隔符。格式：操作 & 预期结果，例如 "点击登录 & 跳转首页"`
          }
        }
        const parts = step.split(' & ')
        if (parts.length > 2) {
          return {
            success: false,
            error: `用例 ${caseIndex + 1}「${cases[caseIndex].case || ''}」的第 ${stepIndex + 1} 步包含多个 " & "，请拆分为多条步骤`
          }
        }
      }
    }

    if (!mindMap) {
      return {
        success: false,
        error: '思维导图实例不存在'
      }
    }

    try {
      // 先在数据层校验模块是否存在及其子节点结构
      const targetNodeData = findNodeByUid(mindMap, moduleId)
      if (!targetNodeData) {
        return {
          success: false,
          error: `未找到ID为 "${moduleId}" 的模块`
        }
      }

      // 校验：有子模块的模块不能直接挂用例
      if (targetNodeData.children && targetNodeData.children.length > 0) {
        const childModules = targetNodeData.children.filter(
          (child: { data?: { icon?: string[]; text?: string; uid?: string } }) =>
            child.data?.icon?.includes('sign_2')
        )
        if (childModules.length > 0) {
          const { idMapper } = context
          const subList = childModules
            .map(
              (m: { data?: { uid?: string; text?: string } }) =>
                `M:${m.data?.uid ? idMapper.shorten(m.data.uid) : '?'} ${m.data?.text || ''}`
            )
            .join('\n')
          return {
            success: false,
            error: `该模块下已有${childModules.length}个子模块，不能直接添加用例。请选择一个子模块添加：\n${subList}`
          }
        }
      }

      // GO_TARGET_NODE 内部已处理：展开折叠路径 → 渲染 → 定位 → 激活 → 回调
      // 回调参数即为渲染层节点实例，无需再次 findNodeByUid
      const targetNode = await new Promise<unknown>((resolve, reject) => {
        mindMap.execCommand('GO_TARGET_NODE', moduleId, (node: unknown) => {
          if (node) {
            resolve(node)
          } else {
            reject(new Error(`无法定位到模块 "${moduleId}"`))
          }
        })
      })

      if (!targetNode) {
        return {
          success: false,
          error: `未找到ID为 "${moduleId}" 的模块`
        }
      }

      // 转换用例格式为思维导图节点格式（预生成 UUID，确保降级路径也能返回）
      const newCaseUids: string[] = []
      const childrenData = cases.map((testCase: { case?: string; steps?: string[] }) => {
        const caseText = testCase.case || ''

        // 从文本中解析优先级前缀 [P1]，并移除前缀
        const { priority, cleanText } = parsePriorityFromText(caseText)

        // 使用解析的优先级，默认为2
        const finalPriority = priority || 2

        // 处理文本中的换行符：支持 \\n 和 \n 两种格式
        const processText = (text: string) => {
          if (!text) return text
          // 先处理 \\n（转义的换行符），再处理已经是换行符的情况
          return text.replace(/\\n/g, '\n')
        }

        // 预生成 UUID（确保降级路径也能返回）
        const caseUid = createUUID()
        newCaseUids.push(caseUid)

        const node = {
          data: {
            text: processText(cleanText),
            icon: createPriorityIcons(finalPriority),
            uid: caseUid
          },
          children: (testCase.steps || []).map((step: string) => ({
            data: { text: processText(step), uid: createUUID() },
            children: []
          }))
        }
        return node
      })

      // 插入节点到思维导图
      mindMap.execCommand('INSERT_MULTI_CHILD_NODE', [targetNode], childrenData)

      // 轮询获取新用例 UID（复用 add_module 的模式，INSERT_MULTI_CHILD_NODE 后新节点自动激活）
      const pollStart = Date.now()
      while (Date.now() - pollStart < 3000) {
        const activeNodes = mindMap.renderer.activeNodeList ?? []
        if (activeNodes.length === cases.length) {
          const { idMapper } = context
          const moduleShort = idMapper.shorten(moduleId)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const lines = activeNodes.map((n: any) => {
            const uid = n?.getData?.()?.uid || n?.nodeData?.data?.uid || ''
            if (uid) newCaseUids.push(uid)
            const text = n?.getData?.()?.text || n?.nodeData?.data?.text || ''
            const icons = n?.getData?.()?.icon || n?.nodeData?.data?.icon || []
            const p = icons.find((i: string) => i.startsWith('priority_'))
            const pl = p ? p.replace('priority_', '') : '2'
            return `+C:${idMapper.shorten(uid)} [P${pl}]${text} > M:${moduleShort}`
          })
          if (lines.every((l: string) => !l.includes('+C: '))) {
            return {
              success: true,
              data: {
                message: `成功添加 ${cases.length} 个测试用例`,
                moduleId,
                caseCount: cases.length,
                caseIds: newCaseUids
              },
              ztdl: lines.join('\n')
            }
          }
        }
        await new Promise(r => setTimeout(r, 50))
      }

      // 超时降级（返回预生成的 caseIds，确保预分配 ID 能正确绑定）
      const { idMapper } = context
      const moduleShort = idMapper.shorten(moduleId)
      const ztdlLines = newCaseUids.map((uid, idx) => {
        const testCase = cases[idx]
        const caseText = (testCase?.case || '').replace(/^\[P[1-3]\]\s*/, '')
        const priorityMatch = testCase?.case?.match(/\[P([1-3])\]/)
        const pl = priorityMatch ? priorityMatch[1] : '2'
        return `+C:${idMapper.shorten(uid)} [P${pl}]${caseText} > M:${moduleShort}`
      })
      return {
        success: true,
        data: {
          message: `成功添加 ${cases.length} 个测试用例`,
          moduleId,
          caseCount: cases.length,
          caseIds: newCaseUids
        },
        ztdl: ztdlLines.join('\n')
      }
    } catch (error) {
      return {
        success: false,
        error: `添加用例失败: ${error instanceof Error ? error.message : String(error)}`
      }
    }
  }
}
