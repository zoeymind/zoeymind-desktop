// @ts-nocheck — cloud/collab type debt; runtime gated by no-op shims
import React, { FC, useEffect, useMemo } from 'react'
import { MoreHorizontal } from 'lucide-react'
import type { FormatPanelRef } from './FormatPanel/FormatPanel'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuPortal
} from '@zoeymind/ui'
import { cn } from '@/shared/app-shared'
import { useContextMenu } from './hooks/useContextMenu'
import { useIconManager } from './hooks/useIconManager'
import { useUIStore } from '@/products/mind/stores'
import { useMindMapStore } from '@/products/mind/features/mindmap/stores/mindmap-store'
import { useTranslation } from '@zoeymind/i18n'

interface MindMapDropdownProps {
  formatPanelRef: React.RefObject<FormatPanelRef | null>
  copyXMindDataToClipboard?: (data: unknown) => Promise<void>
}

export const MindMapDropdown: FC<MindMapDropdownProps> = ({
  formatPanelRef,
  copyXMindDataToClipboard
}) => {
  const { t } = useTranslation()
  // 从store获取mindMap实例和UI状态
  const { mindMap } = useMindMapStore()
  const { dropdownState, setDropdownState } = useUIStore()

  const { show, position, isRoot, currentNode } = dropdownState

  // 虚拟锚点 — 把右键坐标交给 Base UI 的定位系统, 而不是手写 position:fixed。
  // Positioner 自带 transform 会为子元素的 fixed 重建包含块, 手写 left/top 失效;
  // anchor 走官方通路, 还顺带获得碰撞避让(靠近视口边缘时自动翻转)。
  const pointerAnchor = useMemo(
    () => ({
      getBoundingClientRect: () =>
        DOMRect.fromRect({ x: position.x, y: position.y, width: 0, height: 0 })
    }),
    [position.x, position.y]
  )

  // 关闭菜单
  const onClose = () => {
    setDropdownState({ show: false, position: { x: 0, y: 0 }, isRoot: false, currentNode: null })
  }

  // 打开标签面板的回调
  const handleOpenTagsPanel = () => {
    formatPanelRef.current?.openTagsPanel()
    onClose() // 关闭右键菜单
  }

  // 使用自定义 Hook 管理右键菜单逻辑
  const { menuItems, handleMenuAction, setMenuVisible } = useContextMenu(
    mindMap,
    handleOpenTagsPanel,
    copyXMindDataToClipboard
  )

  // 使用统一的图标管理器
  const { handleIconOperation } = useIconManager(mindMap)

  // 同步外部状态到 Hook - 确保立即生效
  useEffect(() => {
    setMenuVisible({
      show,
      position,
      isRoot,
      currentNode
    })
  }, [show, position, isRoot, currentNode, setMenuVisible])

  // 防止事件冒泡，避免菜单意外关闭
  const stopPropagation = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
  }

  // 应用图标到节点
  const applyIconToNode = (type: string, name: string, icon: string) => {
    if (!mindMap) return

    // 获取目标节点
    const activeNodes = mindMap.renderer.activeNodeList || []
    const targetNodes = activeNodes.length > 0 ? activeNodes : currentNode ? [currentNode] : []

    // 使用统一的图标操作处理，支持切换逻辑（重复点击可取消）
    const result = handleIconOperation(type, name, icon, targetNodes, false)

    if (result.success) {
      // 关闭菜单
      onClose()
    }
  }

  // 如果没有显示则不渲染
  if (!show) return null

  return (
    <div className="mindmap-context-menu">
      <DropdownMenu open={show} onOpenChange={open => !open && onClose()}>
        <DropdownMenuPortal>
          <DropdownMenuContent className="w-64" side="bottom" align="start" anchor={pointerAnchor}>
            {menuItems.map((item, index) =>
              item.divider ? (
                <DropdownMenuSeparator key={index} />
              ) : item.isRecentIconList ? (
                <div key={index} className="px-2 py-1.5">
                  <div className="grid grid-cols-8 gap-1.5">
                    {item.recentIcons?.slice(0, 7).map((recentIcon, iconIndex) => (
                      <button
                        type="button"
                        key={iconIndex}
                        className="flex size-7 items-center justify-center rounded-md bg-muted text-foreground ring-1 ring-border transition-colors hover:bg-accent hover:text-accent-foreground"
                        onClick={e => {
                          stopPropagation(e)
                          applyIconToNode(recentIcon.type, recentIcon.name, recentIcon.icon)
                        }}
                        dangerouslySetInnerHTML={{ __html: recentIcon.icon }}
                        title={`${
                          recentIcon.type === 'priority'
                            ? t('mindmap.canvas.iconTypePriority')
                            : recentIcon.type === 'progress'
                              ? t('mindmap.canvas.iconTypeProgress')
                              : recentIcon.type === 'expression'
                                ? t('mindmap.canvas.iconTypeExpression')
                                : t('mindmap.canvas.iconTypeSign')
                        } ${recentIcon.name}`}
                      />
                    ))}
                    {Array.from({
                      length: Math.max(0, 7 - (item.recentIcons?.length || 0))
                    }).map((_, emptyIndex) => (
                      <div key={`empty-${emptyIndex}`} className="size-7" />
                    ))}
                    {item.onOpenTagsPanel && (
                      <button
                        type="button"
                        className="flex size-7 items-center justify-center rounded-md bg-muted text-primary ring-1 ring-border transition-colors hover:bg-accent hover:text-accent-foreground"
                        onClick={e => {
                          stopPropagation(e)
                          item.onOpenTagsPanel?.()
                        }}
                        title={t('mindmap.canvas.moreIcons')}
                      >
                        <MoreHorizontal className="size-4" />
                      </button>
                    )}
                  </div>
                </div>
              ) : item.isTestCaseInfo ? (
                <div key={index} className="px-2 pb-1.5 text-xs text-muted-foreground">
                  <div className="flex items-center justify-center gap-2 rounded-md bg-muted px-2 py-1">
                    <span>SUM {item.testCaseCount?.total || 0}</span>
                    <div className="h-3 w-px bg-border" />
                    <span>P1 {item.testCaseCount?.p1 || 0}</span>
                    <div className="h-3 w-px bg-border" />
                    <span>P2 {item.testCaseCount?.p2 || 0}</span>
                    <div className="h-3 w-px bg-border" />
                    <span>P3 {item.testCaseCount?.p3 || 0}</span>
                  </div>
                </div>
              ) : (
                <DropdownMenuItem
                  key={index}
                  onClick={e => {
                    stopPropagation(e)
                    handleMenuAction(item.action)
                    onClose()
                  }}
                  className={cn('cursor-pointer', item.className)}
                >
                  {item.icon && (
                    <span
                      className="flex size-4 items-center justify-center"
                      dangerouslySetInnerHTML={{ __html: item.icon }}
                    />
                  )}
                  {item.lucideIcon &&
                    React.createElement(item.lucideIcon as React.ComponentType<{ size?: number }>, {
                      size: 16
                    })}
                  <span>{item.label}</span>
                  {item.shortcut && <DropdownMenuShortcut>{item.shortcut}</DropdownMenuShortcut>}
                </DropdownMenuItem>
              )
            )}
          </DropdownMenuContent>
        </DropdownMenuPortal>
      </DropdownMenu>
    </div>
  )
}