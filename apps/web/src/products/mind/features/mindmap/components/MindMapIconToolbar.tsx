// @ts-nocheck — cloud/collab type debt; runtime gated by no-op shims
import { FC, useEffect, useState, useRef } from 'react'
import { nodeIconList as iconGroups } from 'simple-mind-map/src/svg/icons'
import { Trash2 } from 'lucide-react'
import { Button, Separator } from '@zoeymind/ui'
import { addIconToHistory } from '@/products/mind/features/mindmap/utils/storage/iconHistory'
import { useUIStore } from '@/products/mind/stores'
import { useProjectMindMapStore as useMindMapStore } from '@/products/mind/editor-session'
import { useTranslation } from '@zoeymind/i18n'

interface IconItem {
  name: string
  icon: string
}

export const MindMapIconToolbar: FC = () => {
  const { t } = useTranslation()
  // 从 store 获取状态
  const { mindMap } = useMindMapStore()
  const { iconToolbarState, setIconToolbarState } = useUIStore()

  const { show, position, node, iconType, iconName } = iconToolbarState

  // 关闭工具栏
  const onClose = () => {
    setIconToolbarState({
      show: false,
      position: { x: 0, y: 0 },
      node: null,
      iconType: '',
      iconName: '',
      nodeIconList: []
    })
  }

  const [nodeIconList, setNodeIconList] = useState<string[]>([])
  const [iconList, setIconList] = useState<IconItem[]>([])
  const toolbarRef = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)

  // 获取图标类型的中文标签
  const getIconTypeLabel = (type: string): string => {
    switch (type) {
      case 'priority':
        return t('mindmap.canvas.iconTypePriority')
      case 'progress':
        return t('mindmap.canvas.iconTypeProgress')
      case 'expression':
        return t('mindmap.canvas.iconTypeExpression')
      case 'sign':
        return t('mindmap.canvas.iconTypeSign')
      default:
        return type
    }
  }

  // 初始化组件数据
  useEffect(() => {
    if (!node || !show) return

    // 获取节点当前图标
    const icons = node.getData('icon') || []
    setNodeIconList(icons)

    // 获取当前类型的所有图标列表
    const currentTypeIcons = iconGroups.find(
      (item: { type: string; name: string; list: Array<{ name: string; icon: string }> }) =>
        item.type === iconType
    )
    if (currentTypeIcons?.list) {
      setIconList([...currentTypeIcons.list])
    }
  }, [node, show, iconType])

  // 计算和设置位置
  useEffect(() => {
    if (!show || !node) {
      setIsVisible(false)
      return
    }

    // 先隐藏工具栏，等位置设置好后再显示，避免闪烁
    setIsVisible(false)

    // 获取节点位置
    const updatePosition = () => {
      if (!toolbarRef.current) return

      // 根据节点位置设置工具栏位置
      let left = position.x
      let top = position.y + 5 // 增加5px的间距

      // 如果有节点的rect信息，优先使用
      if (node.getRect) {
        const rect = node.getRect()
        left = rect.x
        top = rect.y + rect.height + 5
      }

      // 应用位置
      toolbarRef.current.style.left = `${left}px`
      toolbarRef.current.style.top = `${top}px`

      // 位置设置完成后再显示工具栏，避免闪烁
      setTimeout(() => {
        setIsVisible(true)
      }, 0)
    }

    // 首次更新位置
    updatePosition()

    // 监听缩放事件，更新位置
    if (mindMap) {
      mindMap.on('scale', updatePosition)
      mindMap.on('viewChange', updatePosition)
    }

    return () => {
      if (mindMap) {
        mindMap.off('scale', updatePosition)
        mindMap.off('viewChange', updatePosition)
      }
    }
  }, [mindMap, node, show, position])

  // 设置图标
  const setIcon = (name: string) => {
    if (!node) return

    const key = `${iconType}_${name}`
    const icons = [...nodeIconList]

    // 查找当前同类型图标的位置
    const index = icons.findIndex(item => item === key)

    // 如果已存在该图标，则删除
    if (index !== -1) {
      icons.splice(index, 1)
    } else {
      // 查找同类型图标的位置
      const typeIndex = icons.findIndex(item => item.split('_')[0] === iconType)

      // 如果存在同类型图标，则替换
      if (typeIndex !== -1) {
        icons.splice(typeIndex, 1, key)
      } else {
        // 如果不存在同类型图标，则添加
        icons.push(key)
      }

      // 添加到历史记录（只在添加图标时记录）
      const currentIcon = iconList.find(icon => icon.name === name)
      if (currentIcon) {
        addIconToHistory(iconType, name, currentIcon.icon)
      }
    }

    // 更新节点图标
    node.setIcon(icons)
    setNodeIconList(icons)

    // 触发渲染
    mindMap?.render()
  }

  // 删除图标
  const deleteIcon = () => {
    if (!node) return

    const key = `${iconType}_${iconName}`
    const icons = nodeIconList.filter(item => item !== key)

    node.setIcon(icons)
    setNodeIconList(icons)

    mindMap?.render()
    onClose()
  }

  // 判断图标是否已选中
  const isSelected = (name: string) => {
    const key = `${iconType}_${name}`
    return nodeIconList.includes(key)
  }

  // 处理HTML内容渲染
  const getHtml = (icon: string) => {
    return /^<svg/.test(icon) ? icon : `<img src="${icon}" />`
  }

  if (!show) return null

  return (
    <div
      ref={toolbarRef}
      role="dialog"
      aria-label={getIconTypeLabel(iconType)}
      className={`fixed z-50 w-56 overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-md transition-opacity duration-100 ease-in-out ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
      onClick={e => e.stopPropagation()}
    >
      <div className="px-3 py-2 text-sm font-medium">{getIconTypeLabel(iconType)}</div>
      <Separator />
      <div className="max-h-36 overflow-y-auto p-2">
        <div className="grid grid-cols-6 gap-1">
          {iconList.map(icon => {
            const active = isSelected(icon.name)
            return (
              <button
                key={icon.name}
                type="button"
                onClick={() => setIcon(icon.name)}
                title={`${getIconTypeLabel(iconType)} ${icon.name}`}
                aria-pressed={active}
                className={`flex size-8 items-center justify-center rounded-md text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${
                  active ? 'bg-accent text-accent-foreground ring-1 ring-primary/40' : ''
                }`}
                dangerouslySetInnerHTML={{ __html: getHtml(icon.icon) }}
              />
            )
          })}
        </div>
      </div>
      <Separator />
      <div className="flex justify-center py-1">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={deleteIcon}
          title={t('mindmap.canvas.deleteIcon')}
          aria-label={t('mindmap.canvas.deleteIcon')}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </div>
  )
}