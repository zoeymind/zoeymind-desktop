import { useEffect } from 'react'
import type { default as MindMap, MindMapNode } from 'simple-mind-map'
import { useUIStore } from '@/products/mind/stores'

/**
 * 自定义Hook，用于管理图标工具栏的事件和状态
 * @param mindMap 思维导图实例
 */
export function useIconToolbarManager(mindMap: MindMap | null) {
  useEffect(() => {
    if (!mindMap) return

    const handleNodeIconClick = (node: MindMapNode, icon: string) => {
      // 解析图标类型和名称
      const [type, name] = icon.split('_')

      // 获取节点的位置和尺寸
      const rect = node.getRect()

      // 计算工具栏位置，放在节点下方
      const { setIconToolbarState } = useUIStore.getState()
      setIconToolbarState({
        show: true,
        position: { x: rect.x, y: rect.y + rect.height },
        node,
        iconType: type,
        iconName: name,
        nodeIconList: node.getData('icon') || []
      })
    }

    // 处理画布点击事件，关闭图标工具栏
    const handleDrawClick = () => {
      const { setIconToolbarState } = useUIStore.getState()
      setIconToolbarState({
        show: false,
        position: { x: 0, y: 0 },
        node: null,
        iconType: '',
        iconName: '',
        nodeIconList: []
      })
    }

    // 处理节点双击事件，关闭图标工具栏
    const handleNodeDblclick = () => {
      const { setIconToolbarState } = useUIStore.getState()
      setIconToolbarState({
        show: false,
        position: { x: 0, y: 0 },
        node: null,
        iconType: '',
        iconName: '',
        nodeIconList: []
      })
    }

    // 处理节点激活事件，关闭图标工具栏
    const handleNodeActive = (node?: MindMapNode) => {
      const { iconToolbarState, setIconToolbarState } = useUIStore.getState()
      if (!node || node === iconToolbarState.node) return
      setIconToolbarState({
        show: false,
        position: { x: 0, y: 0 },
        node: null,
        iconType: '',
        iconName: '',
        nodeIconList: []
      })
    }

    // 处理SVG鼠标按下事件，关闭图标工具栏
    const handleSvgMousedown = () => {
      const { setIconToolbarState } = useUIStore.getState()
      setIconToolbarState({
        show: false,
        position: { x: 0, y: 0 },
        node: null,
        iconType: '',
        iconName: '',
        nodeIconList: []
      })
    }

    // 注册事件监听
    mindMap.on('node_icon_click', handleNodeIconClick)
    mindMap.on('draw_click', handleDrawClick)
    mindMap.on('node_dblclick', handleNodeDblclick)
    mindMap.on('node_active', handleNodeActive)
    mindMap.on('svg_mousedown', handleSvgMousedown)

    return () => {
      // 移除事件监听
      mindMap.off('node_icon_click', handleNodeIconClick)
      mindMap.off('draw_click', handleDrawClick)
      mindMap.off('node_dblclick', handleNodeDblclick)
      mindMap.off('node_active', handleNodeActive)
      mindMap.off('svg_mousedown', handleSvgMousedown)
    }
  }, [mindMap])
}
