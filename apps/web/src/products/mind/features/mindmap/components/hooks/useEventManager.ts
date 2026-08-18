// @ts-nocheck — cloud/collab type debt; runtime gated by no-op shims
import { useEffect } from 'react'
import type { default as MindMap, MindMapNode } from 'simple-mind-map'
import { useUIStore } from '@/products/mind/stores'

export function useEventManager(mindMap: MindMap | null) {
  useEffect(() => {
    if (!mindMap) return

    // 保存多选状态的变量
    let preservedActiveNodes: MindMapNode[] = []
    let shouldPreserveSelection = false

    // DOM 级别的右键事件拦截，在 simple-mind-map 的事件处理器之前执行
    const handleDOMContextMenu = (e: MouseEvent) => {
      const target = e.target as Element
      // 检查是否点击在节点上
      const nodeElement = target.closest('.smm-node')
      if (!nodeElement) return

      // 获取当前激活的节点列表
      const activeNodes = mindMap.renderer.activeNodeList || []
      if (activeNodes.length > 1) {
        // 多选状态，保存当前选择
        preservedActiveNodes = activeNodes as unknown as MindMapNode[]
        shouldPreserveSelection = true
      }
    }

    // 处理右键菜单
    const handleNodeContextMenu = (e: MouseEvent, node: MindMapNode) => {
      e.preventDefault()

      // 如果需要保持选择状态，恢复之前的选择
      if (shouldPreserveSelection && preservedActiveNodes.length > 1) {
        // 检查右键的节点是否在之前的选择中
        const isNodeInSelection = preservedActiveNodes.some(
          activeNode => activeNode.getData('uid') === node.getData('uid')
        )

        if (isNodeInSelection) {
          // 恢复多选状态
          mindMap.renderer.clearActiveNodeList()
          preservedActiveNodes.forEach(activeNode => {
            mindMap.renderer.addNodeToActiveList(activeNode, true)
          })
          mindMap.renderer.emitNodeActiveEvent()
        }
      }

      // 获取当前状态
      const activeNodes = mindMap.renderer.activeNodeList || []
      // 检查是否为多选状态（保留逻辑但不使用变量）
      const isMultiSelect = activeNodes.length > 1
      // 这里可以根据需要使用 isMultiSelect 进行后续处理
      if (isMultiSelect) {
        // 多选状态的处理逻辑（如果需要的话）
      }

      // 重置状态
      shouldPreserveSelection = false
      preservedActiveNodes = []

      // 打开右键菜单
      const { setDropdownState } = useUIStore.getState()
      setDropdownState({
        show: true,
        position: { x: e.clientX, y: e.clientY },
        isRoot:
          node.getData('uid') === (mindMap.renderer?.root as MindMapNode | null)?.getData('uid'),
        currentNode: node
      })
    }

    // 处理画布点击关闭菜单
    const handleDrawClick = () => {
      // 仅当点击非菜单区域时关闭
      const menuElement = document.querySelector('.mindmap-context-menu')
      if (!menuElement) {
        const { setDropdownState } = useUIStore.getState()
        setDropdownState({
          show: false,
          position: { x: 0, y: 0 },
          isRoot: false,
          currentNode: null
        })
      }
    }

    // 全局点击事件，用于在点击画布外部时关闭菜单
    const handleGlobalClick = (e: MouseEvent) => {
      const menuElement = document.querySelector('.mindmap-context-menu')
      // 如果菜单存在，且点击的不是菜单内部元素
      if (menuElement && !menuElement.contains(e.target as Node)) {
        const { setDropdownState } = useUIStore.getState()
        setDropdownState({
          show: false,
          position: { x: 0, y: 0 },
          isRoot: false,
          currentNode: null
        })
      }
    }

    // 监听事件
    mindMap.on('node_contextmenu', handleNodeContextMenu)
    mindMap.on('draw_click', handleDrawClick)
    document.addEventListener('click', handleGlobalClick)
    // 添加 DOM 级别的右键事件监听，捕获阶段执行
    if (mindMap.el) {
      mindMap.el.addEventListener('contextmenu', handleDOMContextMenu, true)
    }

    return () => {
      mindMap.off('node_contextmenu', handleNodeContextMenu)
      mindMap.off('draw_click', handleDrawClick)
      document.removeEventListener('click', handleGlobalClick)
      if (mindMap.el) {
        mindMap.el.removeEventListener('contextmenu', handleDOMContextMenu, true)
      }
    }
  }, [mindMap])
}