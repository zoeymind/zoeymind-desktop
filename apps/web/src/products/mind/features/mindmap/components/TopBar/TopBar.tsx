import { logger } from "@zoeymind/logger"
import { useTranslation } from "@zoeymind/i18n"
import { useState, useEffect } from "react"
import type { FC } from "react"
import { AlertTriangle, Flag } from "lucide-react"
import { HeaderSaveButton } from "../HeaderSaveButton"
import { TopMoreDropDown } from "./TopMoreDropDown"
import { TopSearch } from "./TopSearch"
import { projectDB } from "@/shared/mindmap-bridge"
import { useUIStore } from "@/products/mind/stores"
import { useProjectMindMapStore as useMindMapStore } from "@/products/mind/editor-session"
import { useProjectContext } from "@/products/mind/features/mindmap/contexts/project-context"
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
import { Button, Tooltip, TooltipProvider, TooltipTrigger } from "@zoeymind/ui"
import { EditorSidebarTooltipContent } from "../EditorSidebarTooltipContent"
import { useCanvasData } from "@/products/mind/features/mindmap/hooks/useCanvasData"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@zoeymind/ui"
import { useMindMapModules } from "@/products/mind/features/mindmap/hooks/useMindMapModules"
import { IMPORT_ACCEPT } from "@/products/mind/features/mindmap/utils/fileFormats"

// 存储 key

type TopBarProps = { collaboration?: unknown }

// ImportTargetNode 接口可以简化或调整，因为 moduleList 的结构可能不同
interface ImportTargetNode {
  id: string
  text: string
  isFlagged: boolean
}

export const TopBar: FC<TopBarProps> = () => {
  const { t } = useTranslation()
  const { workspaceId } = useProjectContext()
  // 从 store 获取 mindMap 实例
  const { mindMap, setTitle: setStoreTitle } = useMindMapStore()
  const { isSearchActive, searchInitialText, endSearch } = useUIStore()
  const [activeTab, setActiveTab] = useState<"menu" | "search" | null>(null)
  const effectiveActiveTab = isSearchActive ? "search" : activeTab

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
      logger.success("导入完成")
    },
  })

  // 在导入对话框打开时刷新模块列表
  useEffect(() => {
    if (!importDialog.open) return
    logger.info("导入对话框已打开，刷新模块...")
    refreshModules()
  }, [importDialog.open, refreshModules])

  // 将 moduleList 转换为 ImportTargetNode[]
  // 注意: moduleList 的项是 { id: string | number, display: string }
  // 我们需要确保 id 始终是字符串类型给 ImportTargetNode
  const allNodesForImport: ImportTargetNode[] = moduleList.map(module => ({
    id: String(module.id), //确保 id是字符串
    text: module.display || t("mindmap.topbar.title.unnamedModule"),
    isFlagged: true,
  }))

  useEffect(() => {
    if (!workspaceId) return
    void projectDB
      .getProject(workspaceId)
      .then(project => {
        if (project) setStoreTitle(project.name)
      })
      .catch(error => logger.error("获取本地项目标题失败:", error))
  }, [workspaceId, setStoreTitle])

  // 处理搜索关闭
  const handleCloseSearch = () => {
    setActiveTab(null)
    endSearch() // 通过store关闭搜索
  }

  return (
    <>
      <TooltipProvider>
        <FloatingToolbar position="custom">
          {/* 编辑器 Header 主工具栏 */}
          <FloatingToolbarGroup orientation="horizontal" className="flex-nowrap gap-1">
            {/* 使用shadcn DropdownMenu替换按钮 */}
            <Popover
              open={effectiveActiveTab === "search"}
              onOpenChange={open => {
                if (!open) handleCloseSearch()
              }}
            >
              <DropdownMenu
                open={effectiveActiveTab === "menu"}
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
                                active={effectiveActiveTab === "menu"}
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
                    isActive={effectiveActiveTab === "menu"}
                    cloudMode={false}
                    onShowSearch={() => setActiveTab("search")}
                    onClose={() => setActiveTab(null)}
                    onImport={() => {
                      setSelectedImportTargetNodeId(undefined)
                      handleOpenFileInput()
                    }}
                    onClear={openClearDialog}
                    onExport={handleExportData}
                  />
                </DropdownMenuContent>
              </DropdownMenu>
              <PopoverContent side="bottom" align="start" sideOffset={8} className="w-[320px] p-0">
                <TopSearch
                  isActive={effectiveActiveTab === "search"}
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
