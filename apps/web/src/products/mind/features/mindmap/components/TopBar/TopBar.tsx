// @ts-nocheck — cloud/collab-heavy legacy; runtime behavior gated by no-op shims
import { logger } from "@zoeymind/logger"
import { useTranslation } from "@zoeymind/i18n"
import React, { FC, useState, useRef, useEffect } from "react"
import { AlertTriangle, Flag } from "lucide-react"
import { HeaderSaveButton } from "../HeaderSaveButton"
import { TopMoreDropDown } from "./TopMoreDropDown"
import { TopSearch } from "./TopSearch"
import { ShortcutModal } from "./ShortcutModal"
import { projectDB } from "@/shared/mindmap-bridge"
import { trpcClient } from "@/shared/app-shared"
import { useProjectTitle } from "@/products/mind/features/mindmap/hooks/useProjectInfo"
import { generateAndSavePreview } from "@/products/mind/features/mindmap/utils/mindMapExporter"
import { useUIStore } from "@/products/mind/stores"
import { useProjectMindMapStore as useMindMapStore } from "@/products/mind/editor-session"
import { useProjectContext } from "@/products/mind/features/mindmap/contexts/ProjectContext"
import type { default as MindMap } from "simple-mind-map"
import { FloatingToolbar, FloatingToolbarGroup, FloatingToolbarButton } from "@zoeymind/ui"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent } from "@zoeymind/ui"
import { Popover, PopoverContent, PopoverTrigger } from "@zoeymind/ui"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@zoeymind/ui"
import { Button, cn, Tooltip, TooltipProvider, TooltipTrigger } from "@zoeymind/ui"
import { EditorSidebarTooltipContent } from "../EditorSidebarTooltipContent"
import { useCanvasData } from "@/products/mind/features/mindmap/hooks/useCanvasData"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@zoeymind/ui"
import { useMindMapModules } from "@/products/mind/features/mindmap/hooks/useMindMapModules"
import { SettingsModal } from "./SettingsModal"
import { CollaborationCluster } from "./CollaborationCluster"
import { ShareButton } from "@/products/mind/features/mindmap/components/ShareDialog"
import { RequestEditButton } from "./RequestEditButton"
import { usePermissionStore } from "@/products/mind/features/mindmap/stores/permission-store"
import type { CollaborationState } from "@/products/mind/features/mindmap/components/hooks/useCollaborationManager"
import { IMPORT_ACCEPT } from "@/products/mind/features/mindmap/utils/fileFormats"

// 存储 key
const TITLE_STORAGE_KEY = "mindmap_title"

interface TopBarProps {
  collaboration?: CollaborationState | null
}

// ImportTargetNode 接口可以简化或调整，因为 moduleList 的结构可能不同
interface ImportTargetNode {
  id: string
  text: string
  isFlagged: boolean
}

export const TopBar: FC<TopBarProps> = ({ collaboration }) => {
  const { t } = useTranslation()
  const { workspaceId, cloudMode } = useProjectContext()
  // 从 store 获取 mindMap 实例
  const { mindMap, setTitle: setStoreTitle } = useMindMapStore()
  const { isSearchActive, searchInitialText, endSearch } = useUIStore()
  const { canEdit, hasPermission } = usePermissionStore()

  // 使用传递的协同状态
  const collaborationState = collaboration
  const [activeTab, setActiveTab] = useState<"menu" | "search" | null>(null)
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false)
  const [isShortcutModalOpen, setIsShortcutModalOpen] = useState(false)
  const [title, setTitle] = useState(() => {
    // 云模式下不使用本地存储的标题
    const fallback = t("mindmap.topbar.title.untitled")
    if (cloudMode) {
      return fallback
    }
    return localStorage.getItem(TITLE_STORAGE_KEY) || fallback
  })
  const [isEditing, setIsEditing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const [projectTitle, setProjectTitle] = useState<string>("")

  // 使用 useMindMapModules 获取模块列表
  const { moduleList, refreshModules } = useMindMapModules(mindMap)
  const [selectedImportTargetNodeId, setSelectedImportTargetNodeId] = useState<string | undefined>(
    undefined
  )

  const {
    fileInputRef,
    importDialog,
    clearDialog,
    handleOpenFileInput,
    handleFileChange,
    closeImportDialog,
    handleDirectImport,
    setImportDialog,
    openClearDialog,
    closeClearDialog,
    handleClearData,
    handleExportData,
  } = useCanvasData({
    mindMap,
    workspaceId,
    onImportComplete: () => {
      // 导入完成后生成预览，不再强制刷新页面
      logger.success("导入完成")
      if (mindMap && workspaceId) {
        generateAndSavePreview(mindMap as MindMap, workspaceId as string)
      }
      // 🚀 移除页面刷新，让思维导图自然更新
      // window.location.reload()
    },
  })

  // 🚀 使用缓存的项目标题信息，避免重复API调用
  const { title: cloudTitle, isLoading: titleLoading } = useProjectTitle(
    cloudMode ? workspaceId : undefined
  )

  // 加载云项目名称
  useEffect(() => {
    if (cloudMode && workspaceId && !titleLoading && cloudTitle) {
      setTitle(cloudTitle)
    }
  }, [cloudMode, workspaceId, cloudTitle, titleLoading])

  // 监听外部搜索状态变化
  useEffect(() => {
    if (isSearchActive) {
      setActiveTab("search")
    }
  }, [isSearchActive])

  // 在导入对话框打开时刷新模块列表
  useEffect(() => {
    if (importDialog.open) {
      logger.info("导入对话框已打开，刷新模块...")
      refreshModules()
      setSelectedImportTargetNodeId(undefined) // 重置选择
    }
  }, [importDialog.open, refreshModules]) // refreshModules 作为依赖

  // 将 moduleList 转换为 ImportTargetNode[]
  // 注意: moduleList 的项是 { id: string | number, display: string }
  // 我们需要确保 id 始终是字符串类型给 ImportTargetNode
  const allNodesForImport: ImportTargetNode[] = moduleList.map(module => ({
    id: String(module.id), //确保 id是字符串
    text: module.display || t("mindmap.topbar.title.unnamedModule"),
    isFlagged: true,
  }))

  // 获取本地项目标题 (仅限本地模式)
  useEffect(() => {
    const loadProjectTitle = async () => {
      if (workspaceId && !cloudMode) {
        try {
          const project = await projectDB.getProject(workspaceId)
          if (project) {
            setProjectTitle(project.name)
            setTitle(project.name)
          }
        } catch (error) {
          logger.error("获取本地项目标题失败:", error)
        }
      }
    }

    loadProjectTitle()
  }, [workspaceId, cloudMode])

  // 切换面板
  const togglePanel = (panel: "menu" | "search" | null) => {
    setActiveTab(prev => (prev === panel ? null : panel))
  }

  // 处理快捷键模态框
  const handleShowShortcuts = () => {
    setIsShortcutModalOpen(true)
  }

  const handleCloseShortcutModal = () => {
    setIsShortcutModalOpen(false)
  }

  // 处理标题编辑
  const handleTitleEdit = () => {
    setIsEditing(true)
    // 等待 DOM 更新后聚焦
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus()
        inputRef.current.select()
      }
    }, 0)
  }

  // 处理标题保存
  const handleTitleSave = async () => {
    setIsEditing(false)
    if (inputRef.current) {
      const newTitle = inputRef.current.value.trim() || t("mindmap.topbar.title.untitled")
      setTitle(newTitle)

      if (cloudMode && workspaceId) {
        // 云项目重命名
        try {
          const response = await trpcClient.mindmap.update.mutate({
            mindmapId: workspaceId,
            title: newTitle,
          })

          if (response.success) {
            logger.success("云项目标题已更新为:", newTitle)

            // 🚀 协同更新：将标题变更同步给其他用户
            if (collaborationState?.cooperate?.awarenessSync?.setProjectTitle) {
              collaborationState.cooperate.awarenessSync.setProjectTitle(newTitle)
              logger.debug("项目标题已同步给协同用户")
            }
          } else {
            logger.error("更新云项目标题失败")
          }
        } catch (error) {
          logger.error("更新云项目标题失败:", error)
        }
      } else if (workspaceId) {
        // 本地项目重命名
        try {
          const updateSuccess = await projectDB.updateProject(workspaceId, {
            name: newTitle,
          })

          if (updateSuccess) {
            setProjectTitle(newTitle)
            logger.success("项目标题已更新为:", newTitle)
          } else {
            logger.error("更新项目标题失败: API返回失败")
          }
        } catch (error) {
          logger.error("更新项目标题失败:", error)
        }
      } else {
        // 否则使用本地存储
        localStorage.setItem(TITLE_STORAGE_KEY, newTitle)
      }
    }
  }

  // 处理按键事件
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleTitleSave()
    } else if (e.key === "Escape") {
      setIsEditing(false)
    }
  }

  // 监听协同项目标题变更
  useEffect(() => {
    if (
      cloudMode &&
      collaborationState?.projectTitle &&
      collaborationState.projectTitle !== title
    ) {
      logger.debug("接收到协同用户的标题更新:", collaborationState.projectTitle)
      setTitle(collaborationState.projectTitle)
    }
  }, [collaborationState?.projectTitle, cloudMode, title])

  // 计算显示标题
  const displayTitle = cloudMode ? title : workspaceId ? projectTitle : title

  // 🎯 同步标题到全局 Store
  useEffect(() => {
    if (displayTitle) {
      setStoreTitle(displayTitle)
    }
  }, [displayTitle, setStoreTitle])

  // 处理搜索关闭
  const handleCloseSearch = () => {
    setActiveTab(null)
    endSearch() // 通过store关闭搜索
  }

  const collaborationCluster = cloudMode ? (
    <CollaborationCluster collaborationState={collaborationState} />
  ) : null

  return (
    <>
      <TooltipProvider>
        <FloatingToolbar position="custom">
          {/* 编辑器 Header 主工具栏 */}
          <FloatingToolbarGroup orientation="horizontal" className="flex-nowrap gap-1">
            {/* 使用shadcn DropdownMenu替换按钮 */}
            <Popover
              open={activeTab === "search"}
              onOpenChange={open => {
                if (!open) handleCloseSearch()
              }}
            >
              <DropdownMenu
                open={activeTab === "menu"}
                onOpenChange={open =>
                  setActiveTab(current => (open ? "menu" : current === "menu" ? null : current))
                }
              >
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <DropdownMenuTrigger
                        nativeButton
                        render={
                          <PopoverTrigger
                            render={
                              <FloatingToolbarButton
                                active={activeTab === "menu"}
                                className="rounded-full"
                                aria-label={t("mindmap.topbar.title.moreOptions")}
                              >
                                <svg
                                  className="size-5"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                    d="M4 6h16M4 12h16M4 18h16"
                                  />
                                </svg>
                              </FloatingToolbarButton>
                            }
                          />
                        }
                      />
                    }
                  />
                  <EditorSidebarTooltipContent>
                    {t("mindmap.topbar.title.moreOptions")}
                  </EditorSidebarTooltipContent>
                </Tooltip>
                <DropdownMenuContent side="bottom" align="start" sideOffset={8} className="w-56">
                  <TopMoreDropDown
                    isActive={activeTab === "menu"}
                    cloudMode={cloudMode}
                    onShowSearch={() => setActiveTab("search")}
                    onShowSettings={() => setIsSettingsModalOpen(true)}
                    onShowShortcuts={handleShowShortcuts}
                    onClose={() => setActiveTab(null)}
                    onImport={handleOpenFileInput}
                    onClear={openClearDialog}
                    onExport={handleExportData}
                  />
                </DropdownMenuContent>
              </DropdownMenu>
              <PopoverContent side="bottom" align="start" sideOffset={8} className="w-[320px] p-0">
                <TopSearch
                  isActive={activeTab === "search"}
                  onClose={handleCloseSearch}
                  initialText={searchInitialText}
                />
              </PopoverContent>
            </Popover>

            {/* 保存快捷入口 — 紧贴菜单右侧, File 菜单式布局 */}
            <HeaderSaveButton />
          </FloatingToolbarGroup>
        </FloatingToolbar>
      </TooltipProvider>

      {/* 设置模态框 */}
      <SettingsModal open={isSettingsModalOpen} onOpenChange={setIsSettingsModalOpen} />

      {/* 快捷键模态框 */}
      <ShortcutModal isOpen={isShortcutModalOpen} onClose={handleCloseShortcutModal} />

      {/* 文件输入（隐藏） */}
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: "none" }}
        accept={IMPORT_ACCEPT}
        onChange={handleFileChange}
        title={t("mindmap.topbar.import.fileInputLabel")}
        aria-label={t("mindmap.topbar.import.fileInputLabel")}
      />

      {/* 导入文件对话框 */}
      <Dialog open={importDialog.open} onOpenChange={closeImportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("mindmap.topbar.import.dialogTitle")}</DialogTitle>
            <DialogDescription>{t("mindmap.topbar.import.description")}</DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div>
              <p className="text-sm font-medium mb-1">{t("mindmap.topbar.import.selectedFile")}</p>
              <p className="text-sm bg-muted p-2 rounded">{importDialog.selectedFile?.name}</p>
            </div>

            {/* XMind 格式选择 */}
            {importDialog.selectedFile?.name.toLowerCase().endsWith(".xmind") && (
              <div>
                <label htmlFor="xmind-format-select" className="text-sm font-medium block mb-1">
                  {t("mindmap.topbar.import.xmindFormat")}
                </label>
                <Select
                  value={importDialog.xmindFormat || "standard"}
                  onValueChange={value => {
                    setImportDialog(prev => ({
                      ...prev,
                      xmindFormat: value as "standard" | "zm",
                    }))
                  }}
                >
                  <SelectTrigger id="xmind-format-select">
                    <SelectValue>
                      {value =>
                        value ? String(value) : t("mindmap.topbar.import.selectFormatPlaceholder")
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">
                      {t("mindmap.topbar.import.formatStandard")}
                    </SelectItem>
                    <SelectItem value="zm">{t("mindmap.topbar.import.formatZm")}</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  {importDialog.xmindFormat === "zm"
                    ? t("mindmap.topbar.import.formatZmDesc")
                    : t("mindmap.topbar.import.formatStandardDesc")}
                </p>
              </div>
            )}

            <div>
              <label htmlFor="import-target-select" className="text-sm font-medium block mb-1">
                {t("mindmap.topbar.import.target")}
              </label>
              <Select
                value={
                  selectedImportTargetNodeId === undefined
                    ? "overwrite_canvas"
                    : selectedImportTargetNodeId
                }
                onValueChange={value => {
                  if (value == null) return
                  setSelectedImportTargetNodeId(
                    value === "overwrite_canvas" ? undefined : (value as string)
                  )
                }}
              >
                <SelectTrigger id="import-target-select">
                  <SelectValue>
                    {value =>
                      value ? String(value) : t("mindmap.topbar.import.targetPlaceholder")
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="overwrite_canvas">
                    {t("mindmap.topbar.import.overwriteCanvas")}
                  </SelectItem>
                  {allNodesForImport.map(node => (
                    <SelectItem key={node.id} value={node.id}>
                      <div className="flex items-center">
                        {node.isFlagged && <Flag className="size-4 mr-2 text-primary" />}
                        {node.text}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {importDialog.error && (
              <div className="mt-3 flex items-center gap-2 text-destructive bg-destructive/10 p-3 rounded-md">
                <AlertTriangle className="size-4" />
                <p className="text-sm">{importDialog.error}</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeImportDialog}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={async () => {
                if (importDialog.selectedFile) {
                  // 如果用户希望保存后导入，应调用 handleSaveAndImport
                  // 根据当前对话框简化，直接使用 handleDirectImport
                  await handleDirectImport(selectedImportTargetNodeId, importDialog.xmindFormat)
                }
              }}
              disabled={!importDialog.selectedFile}
            >
              {t("mindmap.topbar.import.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 清除数据确认对话框 */}
      <Dialog open={clearDialog.open} onOpenChange={closeClearDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("mindmap.topbar.clear.title")}</DialogTitle>
            <DialogDescription>{t("mindmap.topbar.clear.description")}</DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="flex items-center gap-2 text-warning bg-warning/10 p-3 rounded-md">
              <AlertTriangle className="size-5" />
              <p>{t("mindmap.topbar.clear.warning")}</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeClearDialog}>
              {t("common.cancel")}
            </Button>
            <Button variant="destructive" onClick={handleClearData}>
              {t("mindmap.topbar.clear.confirmAction")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
