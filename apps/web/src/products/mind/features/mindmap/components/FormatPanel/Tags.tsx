import { useEffect } from "react"
import type { FC } from "react"
import { useTranslation } from "@zoeymind/i18n"
import { nodeIconList } from "simple-mind-map/src/svg/icons"
import { useIconManager } from "@/products/mind/features/mindmap/components/hooks/useIconManager"
import { useProjectMindMapStore as useMindMapStore } from "@/products/mind/editor-session"
import { PanelLayout } from "./PanelLayout"

interface TagsProps {
  isActive: boolean
}

interface IconListItem {
  type: string
  list: {
    name: string
    icon: string
  }[]
}

interface IconGroup {
  type: string
  label: string
}

export const Tags: FC<TagsProps> = ({ isActive }) => {
  const { t } = useTranslation()
  // 从store获取mindMap实例
  const { mindMap } = useMindMapStore()

  // 使用统一的图标管理器
  const { handleIconOperation, isIconActive } = useIconManager(mindMap)

  // 监听节点选择变化以触发重新渲染
  useEffect(() => {
    if (!mindMap) return

    const handleNodeChange = () => {
      // 触发组件重新渲染，getActiveIcons 会获取最新状态
    }

    // 监听节点选择变化
    mindMap.on("node_active", handleNodeChange)
    mindMap.on("node_click", handleNodeChange)

    return () => {
      mindMap.off("node_active", handleNodeChange)
      mindMap.off("node_click", handleNodeChange)
    }
  }, [mindMap])

  // 获取所有图标类型
  const iconGroups: IconGroup[] = [
    { type: "priority", label: t("mindmap.formatPanel.tags.groupPriority") },
    { type: "sign", label: t("mindmap.formatPanel.tags.groupSign") },
    { type: "progress", label: t("mindmap.formatPanel.tags.groupProgress") },
    { type: "expression", label: t("mindmap.formatPanel.tags.groupExpression") },
  ]

  // 处理图标点击
  const handleIconClick = (type: string, name: string) => {
    const activeNodes = mindMap?.renderer?.activeNodeList || []
    // 如果没有选择节点，直接返回，不执行任何操作
    if (activeNodes.length === 0) {
      return
    }

    // 获取图标的SVG内容用于历史记录
    const iconList = nodeIconList.find(
      (item: { type: string }) => item.type === type
    ) as IconListItem
    const iconData = iconList?.list.find(icon => icon.name === name)
    const iconSvg = iconData?.icon || ""

    // 使用统一的图标操作处理
    const result = handleIconOperation(type, name, iconSvg)

    if (result.success) {
      // 操作成功，组件会自动重新渲染
    }
  }

  // 检查图标是否被选中 - 使用统一的方法
  const isIconActiveLocal = (type: string, name: string) => {
    return isIconActive(type, name)
  }

  return (
    <PanelLayout
      title={t("mindmap.formatPanel.tags.panelTitle")}
      isActive={isActive}
      className="p-4"
    >
      <div className="space-y-6">
        {iconGroups.map(group => {
          const iconList = nodeIconList.find(
            (item: { type: string }) => item.type === group.type
          ) as IconListItem
          const icons = iconList?.list || []
          if (icons.length === 0) return null

          return (
            <div key={group.type}>
              <div className="text-xs text-muted-foreground mb-2">{group.label}</div>
              <div className="grid grid-cols-8 gap-1">
                {icons.map(icon => {
                  const isActive = isIconActiveLocal(group.type, icon.name)
                  return (
                    <button
                      type="button"
                      key={icon.name}
                      className={`size-6 rounded-full flex items-center justify-center hover:bg-muted hover:scale-110 transition-all duration-200 ease-in-out cursor-pointer ${
                        isActive ? "bg-muted ring-2 ring-primary" : ""
                      }`}
                      onClick={() => handleIconClick(group.type, icon.name)}
                      dangerouslySetInnerHTML={{ __html: icon.icon }}
                      title={t("mindmap.formatPanel.tags.iconTooltip", {
                        group: group.label,
                        name: icon.name,
                      })}
                    />
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </PanelLayout>
  )
}
