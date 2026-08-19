// @ts-nocheck — cloud/collab-heavy legacy; runtime behavior gated by no-op shims
import { logger } from '@zoeymind/logger'
import { useState, useEffect, useCallback, useRef } from 'react'

import { NodeManager } from '@/products/mind/features/mindmap/components/managers/NodeManager'
import type { default as MindMap, MindMapNodeTree, MindMapNode } from 'simple-mind-map'
import { trpcClient } from '@/shared/app-shared'
import { useProjectContext } from '@/products/mind/features/mindmap/contexts/ProjectContext'
import { usePermissionStore } from '@/products/mind/features/mindmap/stores/permission-store'

/** 思维导图模块建议项（@mention 列表用）：id 为节点 uid，display 为模块名 */
export interface ModuleSuggestion {
  id: string
  display: string
}

export interface TestCase {
  case: string
  steps: string[]
  priority?: 1 | 2 | 3
}

export interface MessageWithNodeData {
  displayMessage: string
  apiMessage: string
}

interface MindMapNodeDataShape {
  uid?: string
  text?: string
  icon?: string[]
  [key: string]: unknown
}

interface ModuleJson {
  moduleName?: string
  id: string
  testcases: { case: string; steps: string[] }[]
  children: ModuleJson[]
}

type MindMapNodeLike = {
  uid?: string
  data?: MindMapNodeDataShape
  nodeData?: { data?: MindMapNodeDataShape }
  children?: MindMapNodeLike[]
  getData?: () => MindMapNodeDataShape | undefined
}

const resolveNodeData = (
  node: MindMapNodeTree | MindMapNode | MindMapNodeLike | null | undefined
): MindMapNodeDataShape | null => {
  if (!node) return null
  const candidate = node as MindMapNodeLike
  if (candidate.data) {
    return candidate.data
  }
  if (candidate.nodeData?.data) {
    return candidate.nodeData.data
  }
  if (typeof candidate.getData === 'function') {
    const data = candidate.getData()
    if (data) {
      return data
    }
  }
  return null
}

export const useMindMapModules = (
  mindMap: MindMap | null
): {
  moduleList: ModuleSuggestion[]
  refreshModules: () => void
  addTestCases: (
    moduleId: string,
    type: string,
    name: string,
    testCases: TestCase[]
  ) => Promise<boolean>
  getNodeData: (nodeId: string) => MindMapNodeTree | MindMapNode | null
  getMentionedNodesData: (text: string) => MessageWithNodeData
  getTestCasesCount: () => { total: number; p1: number; p2: number; p3: number }
} => {
  const [moduleList, setModuleList] = useState<ModuleSuggestion[]>([])
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [testCaseStats, setTestCaseStats] = useState({ total: 0, p1: 0, p2: 0, p3: 0 })
  const { canEdit } = usePermissionStore()
  const canEditRef = useRef(canEdit)
  const pendingRefreshRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    canEditRef.current = canEdit
  }, [canEdit])

  const requestRefresh = useCallback((delay: number = 200) => {
    if (pendingRefreshRef.current) {
      clearTimeout(pendingRefreshRef.current)
    }
    pendingRefreshRef.current = setTimeout(() => {
      pendingRefreshRef.current = null
      setRefreshTrigger(prev => prev + 1)
    }, delay)
  }, [])

  const refreshModules = useCallback(() => {
    requestRefresh(0)
  }, [requestRefresh])

  useEffect(() => {
    return () => {
      if (pendingRefreshRef.current) {
        clearTimeout(pendingRefreshRef.current)
        pendingRefreshRef.current = null
      }
    }
  }, [])

  const getNodeData = useCallback(
    (nodeId: string): MindMapNodeTree | MindMapNode | null => {
      if (!mindMap || !nodeId) return null

      try {
        const rawData = mindMap.getData()

        if (rawData) {
          let foundNode: MindMapNodeTree | null = null

          const traverseDataTree = (node: MindMapNodeTree): boolean => {
            if (!node) return false

            const nodeData = resolveNodeData(node)
            if (nodeData && nodeData.uid === nodeId) {
              foundNode = node
              return true
            }

            if (node.children && Array.isArray(node.children)) {
              for (const child of node.children) {
                if (traverseDataTree(child)) return true
              }
            }

            return false
          }

          if (traverseDataTree(rawData) && foundNode) {
            return foundNode
          }
        }

        const nodeManager = new NodeManager(mindMap)
        const allNodes = nodeManager.getAllNodes()

        const foundNode = allNodes.find(node => {
          const nodeData = resolveNodeData(node)
          if (nodeData && nodeData.uid === nodeId) {
            return true
          }
          return node.uid === nodeId
        })

        return foundNode ?? null
      } catch (error) {
        logger.error('获取节点数据失败:', error)
        return null
      }
    },
    [mindMap]
  )

  const getMentionedNodesData = useCallback(
    (text: string): MessageWithNodeData => {
      if (!mindMap) {
        return { displayMessage: text, apiMessage: text }
      }

      const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g
      const matches = [...text.matchAll(mentionRegex)]

      if (matches.length === 0) {
        return { displayMessage: text, apiMessage: text }
      }

      let apiMessage = text
      let mentionContent = ''
      const processedNodeIds = new Set<string>()

      const buildModuleJson = (
        mindMapNode: MindMapNodeTree | MindMapNode | MindMapNodeLike
      ): ModuleJson | null => {
        if (!mindMapNode) return null

        const nodeData = resolveNodeData(mindMapNode)
        if (!nodeData) return null

        const testcases: { case: string; steps: string[] }[] = []
        const children: ModuleJson[] = []

        const childNodes = (mindMapNode as MindMapNodeLike).children
        if (childNodes && Array.isArray(childNodes)) {
          for (const child of childNodes) {
            const childData = resolveNodeData(child)

            if (!childData) continue

            if (
              childData.icon &&
              Array.isArray(childData.icon) &&
              childData.icon.some((icon: string) => icon.startsWith('priority_'))
            ) {
              const steps =
                child.children?.map(step => {
                  const stepData = resolveNodeData(step)
                  return stepData?.text ?? ''
                }) || []
              let caseText = childData.text || ''
              const priorityMatch = childData.icon?.find((icon: string) =>
                icon.startsWith('priority_')
              )
              if (priorityMatch) {
                const priority = priorityMatch.replace('priority_', '')
                caseText = `[P${priority}]${caseText}`
              }
              testcases.push({ case: caseText, steps })
            } else if (
              childData.icon &&
              Array.isArray(childData.icon) &&
              childData.icon.includes('sign_2')
            ) {
              const childJson = buildModuleJson(child)
              if (childJson) {
                children.push(childJson)
              }
            }
          }
        }

        return {
          moduleName: nodeData.text,
          id: nodeData.uid || (mindMapNode as MindMapNodeLike).uid || '',
          testcases,
          children
        }
      }

      for (const match of matches) {
        const id = match[2]
        if (processedNodeIds.has(id)) {
          continue
        }
        processedNodeIds.add(id)

        const mindMapNode = getNodeData(id)
        if (!mindMapNode) {
          continue
        }

        const unifiedJson = buildModuleJson(mindMapNode)
        if (unifiedJson) {
          mentionContent += `${JSON.stringify(unifiedJson, null, 2)}\n`
        }
      }

      if (mentionContent) {
        apiMessage += `\n\n<mention content>\n${mentionContent}</mention content>\n`
      }

      return {
        displayMessage: text,
        apiMessage
      }
    },
    [mindMap, getNodeData]
  )

  const addTestCases = useCallback(
    async (
      moduleId: string,
      type: string,
      name: string,
      testCases: TestCase[]
    ): Promise<boolean> => {
      if (!mindMap || !moduleId || !testCases.length) {
        logger.error('添加测试用例失败: 缺少必要参数')
        return false
      }

      try {
        await new Promise<void>((resolve, reject) => {
          mindMap.execCommand('GO_TARGET_NODE', moduleId, () => {
            resolve()
          })
          setTimeout(() => reject(new Error('展开节点超时')), 5000)
        })

        const targetNode = mindMap.renderer.findNodeByUid(moduleId)
        if (!targetNode) {
          throw new Error('未找到目标节点')
        }

        const childrenData = testCases.map(testCase => ({
          data: {
            text: testCase.case,
            icon: [`priority_${testCase.priority || 1}`]
          },
          children: (testCase.steps || []).map(step => ({
            data: { text: step },
            children: []
          }))
        }))

        if (type === 'addModule') {
          const moduleData = {
            text: name,
            icon: ['sign_2']
          }
          mindMap.renderer.insertChildNode(false, [targetNode], moduleData, childrenData)
        } else {
          mindMap.renderer.insertMultiChildNode([targetNode], childrenData)
        }

        refreshModules()
        return true
      } catch (error) {
        logger.error('添加测试用例失败:', error)
        return false
      }
    },
    [mindMap, refreshModules]
  )

  const getTestCasesCount = useCallback(() => testCaseStats, [testCaseStats])

  const reportTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const { workspaceId, cloudMode } = useProjectContext()

  useEffect(() => {
    if (!mindMap) {
      setTestCaseStats({ total: 0, p1: 0, p2: 0, p3: 0 })
      return
    }

    const rawData = mindMap.getData()
    if (!rawData) {
      setTestCaseStats({ total: 0, p1: 0, p2: 0, p3: 0 })
      return
    }

    let total = 0
    let p1 = 0
    let p2 = 0
    let p3 = 0

    const traverseDataTree = (node: MindMapNodeTree) => {
      if (!node) return

      const nodeData = node.data
      if (
        nodeData?.icon &&
        Array.isArray(nodeData.icon) &&
        nodeData.icon.some((icon: string) => icon.startsWith('priority_'))
      ) {
        total++

        const priorityIcon = nodeData.icon.find(icon => icon.startsWith('priority_'))
        if (priorityIcon) {
          const priority = priorityIcon.replace('priority_', '')
          if (priority === '1') p1++
          else if (priority === '2') p2++
          else if (priority === '3') p3++
        }
      }

      node.children?.forEach(child => traverseDataTree(child))
    }

    traverseDataTree(rawData)

    setTestCaseStats({ total, p1, p2, p3 })

    if (cloudMode && workspaceId && canEdit) {
      if (reportTimeoutRef.current) {
        clearTimeout(reportTimeoutRef.current)
      }

      reportTimeoutRef.current = setTimeout(async () => {
        if (!canEditRef.current) {
          return
        }
        try {
          await trpcClient.mindmap.update.mutate({
            mindmapId: workspaceId,
            nodeCount: total
          })
        } catch (error) {
          logger.error('上报测试用例数量失败:', error)
        }
      }, 3000)
    }

    return () => {
      if (reportTimeoutRef.current) {
        clearTimeout(reportTimeoutRef.current)
      }
    }
  }, [mindMap, refreshTrigger, cloudMode, workspaceId, canEdit])

  useEffect(() => {
    if (!mindMap) return

    const extractModules = () => {
      try {
        const rawData = mindMap.getData()

        if (!rawData) {
          logger.warn('无法获取思维导图原始数据')
          setModuleList([])
          return
        }

        const result: ModuleSuggestion[] = []

        // 桌面端 relax 规则: 有 icon=sign_2 的节点算模块 (源版行为), 或者根节点下
        // 前 3 层子节点也当模块 (用户思维导图不一定有 sign_2 图标).
        const traverseDataTree = (
          node: MindMapNodeTree,
          depth: number,
          isRoot: boolean
        ) => {
          if (!node) return

          const nodeData = resolveNodeData(node)
          if (nodeData) {
            const hasSignIcon =
              nodeData.icon &&
              Array.isArray(nodeData.icon) &&
              nodeData.icon.includes('sign_2')
            // 排除根节点自己 (通常是项目标题, 不作为可 @ 的模块).
            const includeByDepth = !isRoot && depth >= 1 && depth <= 3
            if ((hasSignIcon || includeByDepth) && nodeData.uid) {
              result.push({
                id: nodeData.uid,
                display: nodeData.text || '未命名模块'
              })
            }
          }

          if (node.children && Array.isArray(node.children)) {
            node.children.forEach(child =>
              traverseDataTree(child as MindMapNodeTree, depth + 1, false)
            )
          }
        }

        traverseDataTree(rawData, 0, true)

        setModuleList(result)
      } catch (error) {
        logger.error('提取模块列表失败:', error)
        setModuleList([])
      }
    }
    extractModules()
  }, [mindMap, refreshTrigger])

  useEffect(() => {
    if (!mindMap) return

    const handleDataChange = () => {
      requestRefresh()
    }

    mindMap.on('data_change', handleDataChange)
    mindMap.on('set_data', handleDataChange)
    mindMap.on('afterExecCommand', handleDataChange)

    requestRefresh(0)

    return () => {
      mindMap.off('data_change', handleDataChange)
      mindMap.off('set_data', handleDataChange)
      mindMap.off('afterExecCommand', handleDataChange)
    }
  }, [mindMap, requestRefresh])

  return {
    moduleList,
    refreshModules,
    addTestCases,
    getNodeData,
    getMentionedNodesData,
    getTestCasesCount
  }
}