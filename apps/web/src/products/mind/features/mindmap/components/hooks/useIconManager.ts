import { useCallback } from "react"
import type { default as MindMap, MindMapNode } from "simple-mind-map"
import { addIconToHistory } from "@/products/mind/features/mindmap/utils/storage/iconHistory"
import { nodeIconList } from "simple-mind-map/src/svg/icons"
import { i18next } from "@zoeymind/i18n"

/**
 * 图标操作的统一管理 Hook
 * 提供一致的图标添加、删除、切换逻辑，支持多选节点
 */
export function useIconManager(mindMap: MindMap | null) {
  /**
   * 统一的图标操作处理
   * @param type 图标类型 (priority, progress, expression, sign)
   * @param name 图标名称 (1, 2, 3 等)
   * @param iconSvg 图标SVG内容，用于历史记录
   * @param targetNodes 目标节点数组，如果为空则使用当前选中节点
   * @param forceAdd 强制添加模式，不进行切换判断
   */
  const handleIconOperation = useCallback(
    (
      type: string,
      name: string,
      iconSvg: string = "",
      targetNodes?: MindMapNode[],
      forceAdd: boolean = false
    ) => {
      if (!mindMap) return { success: false, action: "none" }

      // 获取目标节点
      const activeNodes = targetNodes || mindMap.renderer.activeNodeList || []
      if (activeNodes.length === 0) {
        return {
          success: false,
          action: "none",
          message: i18next.t("mindmap.toast.noNodeSelected"),
        }
      }

      const iconKey = `${type}_${name}`

      // 检查第一个节点是否已有该图标，决定是添加还是删除
      const firstNode = activeNodes[0]
      const firstNodeIcons = (firstNode.getData("icon") || []) as string[]
      const shouldRemove = !forceAdd && firstNodeIcons.includes(iconKey)

      // 统一的图标类型顺序
      const typeOrder = ["priority", "progress", "expression", "sign"] as const

      // 对所有节点执行操作
      activeNodes.forEach(node => {
        const currentIcons = (node.getData("icon") || []) as string[]
        let newIcons = [...currentIcons]

        if (shouldRemove) {
          // 删除图标
          newIcons = newIcons.filter(icon => icon !== iconKey)
        } else {
          // 添加或替换图标
          const sameTypeIndex = newIcons.findIndex(icon => icon.startsWith(`${type}_`))

          if (sameTypeIndex > -1) {
            // 替换同类型图标
            newIcons[sameTypeIndex] = iconKey
          } else {
            // 按类型顺序插入新图标
            const currentTypeIndex = typeOrder.indexOf(type as (typeof typeOrder)[number])

            // 找到应该插入的位置
            let insertIndex = 0
            for (let i = 0; i < currentTypeIndex; i++) {
              const lastIconOfType = newIcons.findIndex(icon => icon.startsWith(`${typeOrder[i]}_`))
              if (lastIconOfType !== -1) {
                insertIndex = lastIconOfType + 1
              }
            }

            // 在正确的位置插入新图标
            newIcons.splice(insertIndex, 0, iconKey)
          }
        }

        // 更新节点图标
        node.setIcon(newIcons)
      })

      // 触发渲染
      mindMap.render()

      // 添加到历史记录（只在添加时记录）
      if (!shouldRemove) {
        // 如果没有提供 iconSvg，尝试从 nodeIconList 获取
        if (!iconSvg) {
          const iconGroup = nodeIconList.find((group: { type: string }) => group.type === type)
          const iconData = iconGroup?.list?.find((icon: { name: string }) => icon.name === name)
          iconSvg = iconData?.icon || ""
        }

        if (iconSvg) {
          addIconToHistory(type, name, iconSvg)
        }
      }

      return {
        success: true,
        action: shouldRemove ? "remove" : "add",
        affectedNodes: activeNodes.length,
      }
    },
    [mindMap]
  )

  /**
   * 检查指定图标是否在选中节点中处于激活状态
   * @param type 图标类型
   * @param name 图标名称
   * @param targetNodes 目标节点数组，如果为空则使用当前选中节点
   */
  const isIconActive = useCallback(
    (type: string, name: string, targetNodes?: MindMapNode[]) => {
      if (!mindMap) return false

      const activeNodes = targetNodes || mindMap.renderer.activeNodeList || []
      if (activeNodes.length === 0) return false

      const iconKey = `${type}_${name}`

      // 只要第一个节点有该图标就认为是激活状态
      const firstNode = activeNodes[0]
      const icons = (firstNode.getData("icon") || []) as string[]
      return icons.includes(iconKey)
    },
    [mindMap]
  )

  /**
   * 获取选中节点的所有图标
   * @param targetNodes 目标节点数组，如果为空则使用当前选中节点
   */
  const getActiveIcons = useCallback(
    (targetNodes?: MindMapNode[]) => {
      if (!mindMap) return []

      const activeNodes = targetNodes || mindMap.renderer.activeNodeList || []
      if (activeNodes.length === 0) return []

      // 返回第一个节点的图标列表
      const firstNode = activeNodes[0]
      const icons = (firstNode.getData("icon") || []) as string[]
      return icons.map((icon: string) => {
        const [type, name] = icon.split("_")
        return { type, name }
      })
    },
    [mindMap]
  )

  return {
    handleIconOperation,
    isIconActive,
    getActiveIcons,
  }
}
