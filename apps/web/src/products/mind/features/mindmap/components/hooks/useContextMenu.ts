// @ts-nocheck — cloud/collab type debt; runtime gated by no-op shims
import { logger } from '@zoeymind/logger'
import { useState, useCallback } from 'react'
import { NodeManager } from '@/products/mind/features/mindmap/components/managers/NodeManager'
import type { default as MindMap, MindMapNode, MindMapNodeTree } from 'simple-mind-map'
import { getRecentIcons } from '@/products/mind/features/mindmap/utils/storage/iconHistory'
import { nodeIconList } from 'simple-mind-map/src/svg/icons'
import { useUIStore } from '@/products/mind/stores'
import { useCommentStore } from '@/products/mind/features/mindmap/stores/comment-store'
import { usePermissionStore } from '@/products/mind/features/mindmap/stores/permission-store'
import { useTranslation } from '@zoeymind/i18n'
import {
  Copy,
  Scissors,
  Clipboard,
  Plus,
  PlusCircle,
  ChevronRight,
  Trash2,
  FileText,
  MessageCircle
} from 'lucide-react'

interface MenuItem {
  label: string
  shortcut: string
  action: () => void
  className?: string
  divider?: boolean
  icon?: string // 添加图标支持
  lucideIcon?: React.ComponentType // Lucide图标组件
  isRecentIcon?: boolean // 标识是否为最近使用的图标
  isRecentIconList?: boolean // 标识是否为最近使用图标列表
  recentIcons?: Array<{
    type: string
    name: string
    icon: string
    lastUsed: number
  }>
  onOpenTagsPanel?: () => void // 打开标签面板的回调
  isTestCaseInfo?: boolean // 标识是否为测试用例信息项
  testCaseCount?: { total: number; p1: number; p2: number; p3: number } // 测试用例统计
}

interface ContextMenuState {
  show: boolean
  position: { x: number; y: number }
  isRoot: boolean
  currentNode: MindMapNode | null
}

/**
 * 自定义 Hook，用于管理思维导图的右键菜单
 * @param mindMap 思维导图实例
 * @param onOpenTagsPanel 打开标签面板的回调
 * @param copyXMindDataToClipboard 复制为XMind格式的函数
 */
export function useContextMenu(
  mindMap: MindMap | null,
  onOpenTagsPanel?: () => void,
  copyXMindDataToClipboard?: (data: unknown) => Promise<void>
) {
  const canEdit = usePermissionStore(state => state.canEdit)
  const { t } = useTranslation()
  const [menuState, setMenuState] = useState<ContextMenuState>({
    show: false,
    position: { x: 0, y: 0 },
    isRoot: false,
    currentNode: null
  })

  // 节点操作处理
  const handleNodeOperation = useCallback(
    (operation: string) => {
      if (!mindMap || !menuState.currentNode) return

      const nodeManager = new NodeManager(mindMap)
      switch (operation) {
        case 'fold':
          nodeManager.toggleFold(menuState.currentNode)
          break
        case 'copy':
          nodeManager.copyNode()
          break
        case 'cut':
          nodeManager.cutNode()
          break
        case 'paste':
          nodeManager.pasteNode()
          break
        case 'delete':
          nodeManager.deleteNode()
          break
        case 'duplicate':
          nodeManager.duplicateNode()
          break
      }
    },
    [mindMap, menuState.currentNode]
  )

  // 复制为XMind格式
  const handleCopyAsXMind = useCallback(() => {
    if (!mindMap || !menuState.currentNode || !copyXMindDataToClipboard) return

    try {
      // 检查是否是多选状态
      const activeNodes = mindMap.renderer.activeNodeList || []
      const isMultiSelect = activeNodes.length > 1

      if (isMultiSelect) {
        // 多选状态：复制所有选中的节点
        const nodeDataArray = activeNodes.map(node => node.nodeData)
        copyXMindDataToClipboard(nodeDataArray)
        logger.info(`已复制 ${nodeDataArray.length} 个节点为XMind格式`)
      } else {
        // 单选状态：只复制当前节点
        const nodeData = menuState.currentNode.nodeData
        copyXMindDataToClipboard(nodeData)
        logger.info('已复制为XMind格式')
      }
    } catch (error) {
      logger.error('复制为XMind格式失败:', error)
    }
  }, [mindMap, menuState.currentNode, copyXMindDataToClipboard])

  // 执行菜单操作
  const handleMenuAction = useCallback((action: () => void) => {
    action()
  }, [])

  // 设置菜单显示 - 同步方式直接设置状态
  const setMenuVisible = useCallback((state: ContextMenuState) => {
    setMenuState(state)
  }, [])

  // 统计模块下的测试用例数量
  const getModuleTestCasesCount = useCallback(
    (node: MindMapNode) => {
      if (!mindMap || !node) {
        return { total: 0, p1: 0, p2: 0, p3: 0 }
      }

      let total = 0
      let p1 = 0
      let p2 = 0
      let p3 = 0

      // 获取当前节点的 uid
      let nodeUid: string | undefined

      if (typeof node.getData === 'function') {
        const uid = node.getData('uid')
        nodeUid = typeof uid === 'string' ? uid : undefined
      } else if (node.nodeData?.data?.uid) {
        const uid = node.nodeData.data.uid
        nodeUid = typeof uid === 'string' ? uid : undefined
      }

      if (!nodeUid) {
        return { total: 0, p1: 0, p2: 0, p3: 0 }
      }

      // 从 mindMap.getData() 获取完整的数据结构（包括折叠的节点）
      const allData = mindMap.getData()

      // 递归查找指定 uid 的节点
      const findNodeByUid = (data: MindMapNodeTree, uid: string): MindMapNodeTree | null => {
        if (!data) return null

        if (data.data?.uid === uid) {
          return data
        }

        if (data.children && Array.isArray(data.children)) {
          for (const child of data.children) {
            const found = findNodeByUid(child, uid)
            if (found) return found
          }
        }

        return null
      }

      // 找到目标节点
      const targetNode = findNodeByUid(allData, nodeUid)

      if (!targetNode) {
        return { total: 0, p1: 0, p2: 0, p3: 0 }
      }

      // 递归遍历节点的子节点，查找测试用例
      const traverseNode = (currentNode: MindMapNodeTree): void => {
        if (!currentNode || !currentNode.data) return

        // 获取节点图标数据
        const nodeIcons = currentNode.data.icon || []

        // 检查当前节点是否是测试用例（包含 priority_* 图标）
        if (
          Array.isArray(nodeIcons) &&
          nodeIcons.some((icon: string) => icon.startsWith('priority_'))
        ) {
          total++

          // 检查优先级图标
          const priorityIcon = nodeIcons.find((icon: string) => icon.startsWith('priority_'))
          if (priorityIcon) {
            const priority = priorityIcon.replace('priority_', '')
            switch (priority) {
              case '1':
                p1++
                break
              case '2':
                p2++
                break
              case '3':
                p3++
                break
            }
          }
        }

        // 递归遍历子节点
        if (currentNode.children && Array.isArray(currentNode.children)) {
          currentNode.children.forEach(traverseNode)
        }
      }

      // 从目标节点开始遍历
      traverseNode(targetNode)

      return { total, p1, p2, p3 }
    },
    [mindMap]
  )

  // 检查节点是否是模块节点（包含 sign_2 图标）
  const isModuleNode = useCallback((node: MindMapNode | null) => {
    if (!node) return false

    // 尝试多种方式获取节点图标数据
    let nodeIcons: string[] = []

    // 方法1: 通过 getData 方法获取
    if (typeof node.getData === 'function') {
      const icons = node.getData('icon')
      nodeIcons = Array.isArray(icons) ? icons : []
    }
    // 方法2: 通过 nodeData 获取
    else if (node.nodeData?.data?.icon) {
      const icons = node.nodeData.data.icon
      nodeIcons = Array.isArray(icons) ? icons : []
    }
    // 方法3: 直接从 data 获取
    else if (node.data?.icon) {
      const icons = node.data.icon
      nodeIcons = Array.isArray(icons) ? icons : []
    }

    // 确保 nodeIcons 是数组
    if (!Array.isArray(nodeIcons)) {
      nodeIcons = []
    }

    return nodeIcons.includes('sign_2')
  }, [])

  // 构建菜单项
  const buildMenuItems = useCallback((): MenuItem[] => {
    const { currentNode, isRoot } = menuState

    const commentMenuItem: MenuItem = {
      label: t('mindmap.contextMenu.comment'),
      shortcut: '',
      action: () => {
        if (currentNode) {
          const nodeUid = currentNode.getData('uid')
          const { openFormatTab } = useUIStore.getState()
          const { openCommentPanel } = useCommentStore.getState()
          openFormatTab('comment', nodeUid!)
          openCommentPanel(nodeUid!)
        }
      },
      lucideIcon: MessageCircle
    }

    if (!canEdit) {
      return [commentMenuItem]
    }

    const nodeManager = mindMap ? new NodeManager(mindMap) : null
    const recentIcons = getRecentIcons()
    const items: MenuItem[] = []

    // 编辑操作组
    items.push(
      {
        label: t('common.copy'),
        shortcut: 'Ctrl+C',
        action: () => handleNodeOperation('copy'),
        lucideIcon: Copy
      },
      {
        label: t('mindmap.contextMenu.cut'),
        shortcut: 'Ctrl+X',
        action: () => handleNodeOperation('cut'),
        lucideIcon: Scissors
      },
      {
        label: t('mindmap.contextMenu.paste'),
        shortcut: 'Ctrl+V',
        action: () => handleNodeOperation('paste'),
        lucideIcon: Clipboard
      },
      {
        label: t('mindmap.contextMenu.copyXmind'),
        shortcut: '',
        action: handleCopyAsXMind,
        lucideIcon: FileText
      }
    )

    // 从nodeIconList获取默认图标
    const getDefaultIcons = () => {
      const defaultIconConfigs = [
        { type: 'priority', name: '1' },
        { type: 'priority', name: '2' },
        { type: 'priority', name: '3' },
        { type: 'sign', name: '1' },
        { type: 'sign', name: '2' }
      ]

      return defaultIconConfigs
        .map(config => {
          const iconGroup = nodeIconList.find(
            (group: { type: string }) => group.type === config.type
          )
          const iconData = iconGroup?.list?.find(
            (icon: { name: string }) => icon.name === config.name
          )

          return {
            type: config.type,
            name: config.name,
            icon: iconData?.icon || '',
            lastUsed: 0
          }
        })
        .filter(icon => icon.icon)
    }

    const defaultIcons = getDefaultIcons()
    const allIcons = [...recentIcons]
    defaultIcons.forEach(defaultIcon => {
      const exists = allIcons.some(
        icon => icon.type === defaultIcon.type && icon.name === defaultIcon.name
      )
      if (!exists) {
        allIcons.push({
          ...defaultIcon,
          lastUsed: 0
        })
      }
    })

    const displayIcons = allIcons.sort((a, b) => b.lastUsed - a.lastUsed).slice(0, 7)

    items.push(
      {
        divider: true,
        label: '',
        shortcut: '',
        action: () => {}
      },
      {
        label: '',
        shortcut: '',
        action: () => {},
        isRecentIconList: true,
        recentIcons: displayIcons,
        onOpenTagsPanel,
        className: 'p-0'
      },
      {
        divider: true,
        label: '',
        shortcut: '',
        action: () => {}
      },
      {
        label: t('mindmap.contextMenu.addNode'),
        shortcut: 'Enter',
        action: () => currentNode && nodeManager?.addNode(t('mindmap.contextMenu.newNode')),
        lucideIcon: Plus
      },
      {
        label: t('mindmap.contextMenu.addChildNode'),
        shortcut: 'Tab',
        action: () =>
          currentNode && nodeManager?.addChildNode(t('mindmap.contextMenu.newChildNode')),
        lucideIcon: PlusCircle
      },
      {
        divider: true,
        label: '',
        shortcut: '',
        action: () => {}
      },
      {
        label: t('mindmap.contextMenu.recursiveFold'),
        shortcut: 'Alt + /',
        action: () => currentNode && nodeManager?.toggleFold(currentNode),
        lucideIcon: ChevronRight
      },
      {
        divider: true,
        label: '',
        shortcut: '',
        action: () => {}
      },
      commentMenuItem
    )

    if (!isRoot) {
      items.push(
        {
          divider: true,
          label: '',
          shortcut: '',
          action: () => {}
        },
        {
          label: t('common.delete'),
          shortcut: 'Delete',
          action: () => handleNodeOperation('delete'),
          className: 'text-destructive',
          lucideIcon: Trash2
        }
      )
    }

    if (currentNode && isModuleNode(currentNode)) {
      const testCaseCount = getModuleTestCasesCount(currentNode)
      items.push(
        {
          divider: true,
          label: '',
          shortcut: '',
          action: () => {}
        },
        {
          label: '',
          shortcut: '',
          action: () => {},
          isTestCaseInfo: true,
          testCaseCount,
          className: 'cursor-default hover:bg-transparent'
        }
      )
    }

    return items
  }, [
    menuState,
    mindMap,
    handleNodeOperation,
    handleCopyAsXMind,
    onOpenTagsPanel,
    isModuleNode,
    getModuleTestCasesCount,
    canEdit,
    t
  ])

  return {
    menuState,
    menuItems: buildMenuItems(),
    handleMenuAction,
    setMenuVisible
  }
}