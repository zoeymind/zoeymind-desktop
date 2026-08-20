// @ts-nocheck — cloud/collab-heavy legacy; runtime behavior gated by no-op shims
import { logger } from "@zoeymind/logger"
import { useState, useRef, useEffect } from "react"
import { PENDING_IMPORT_STORAGE_PREFIX } from "@/products/mind/features/mindmap/components/projects/hooks/useCreateProject"
import { toast } from "@/shared/app-shared"
import { mindmapDB } from "@/products/mind/features/mindmap/utils/storage/mindmapDB"
import { parseXMindFile } from "@/products/mind/features/mindmap/utils/xmindParser"
import { parseZMXmindFile } from "@/products/mind/features/mindmap/utils/ZMXMindImporter"
import { parseMarkdownFile } from "@/products/mind/features/mindmap/utils/markdownParser"
import type { MindMapNodeTree } from "simple-mind-map"
import { importFromZipNested } from "@/products/mind/features/mindmap/utils/zipNestedExporter"
import { defaultData } from "@/products/mind/features/mindmap/components/hooks/useCanvasManager"
import { MAX_NODE_COUNT } from "@zoeymind/shared"
import type { default as MindMap } from "simple-mind-map"
import { i18next } from "@zoeymind/i18n"
import {
  exportMindMapToFile,
  isExportFormat,
} from "@/products/mind/features/mindmap/utils/fileFormats"

// 类型转换函数：将xmindParser的MindMapNodeTree转换为mindmapDB的MindMapNodeTree
const convertMindMapNodeTreeForDB = (data: MindMapNodeTree): MindMapNodeTree => {
  if (!data || !data.data) return data

  const convertNode = (node: MindMapNodeTree): MindMapNodeTree => {
    const converted: MindMapNodeTree = {
      data: {
        ...node.data,
        // 将boolean类型的richText转换为string类型
        richText:
          typeof node.data.richText === "boolean"
            ? node.data.richText
              ? "true"
              : undefined
            : node.data.richText,
      },
      children: [],
    }

    if (node.children && Array.isArray(node.children)) {
      converted.children = node.children.map((child: MindMapNodeTree) => convertNode(child))
    }

    return converted
  }

  return convertNode(data)
}

interface UseCanvasDataProps {
  mindMap: MindMap | null
  workspaceId?: string
  onImportComplete?: () => void
  onSave?: () => Promise<void>
}

interface ImportDialogState {
  open: boolean
  selectedFile: File | null
  error: string | null
  xmindFormat?: "standard" | "zm" // XMind 格式选择
}

interface ClearDialogState {
  open: boolean
}

// 辅助函数，递归统计节点树的节点总数
const countNodeTree = (node: MindMapNodeTree | null): number => {
  if (!node) return 0
  let count = 1
  if (node.children && node.children.length > 0) {
    node.children.forEach((child: MindMapNodeTree) => {
      count += countNodeTree(child)
    })
  }
  return count
}

// 辅助函数，递归设置节点及其子节点的 expand 属性为 false
const recursivelySetExpandFalse = (nodeData: MindMapNodeTree): MindMapNodeTree => {
  const newNode = { ...nodeData } // 浅拷贝节点数据
  if (newNode.data) {
    newNode.data = { ...newNode.data, expand: false } // 设置当前节点的 data.expand
  }

  if (newNode.children && newNode.children.length > 0) {
    newNode.children = newNode.children.map((child: MindMapNodeTree) =>
      recursivelySetExpandFalse(child)
    ) // 递归处理子节点
  }
  return newNode
}

/**
 * 画布数据管理Hook，处理导入、导出和清除数据等操作
 */
export function useCanvasData({
  mindMap,
  workspaceId = "default-project",
  onImportComplete,
  onSave,
}: UseCanvasDataProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importDialog, setImportDialog] = useState<ImportDialogState>({
    open: false,
    selectedFile: null,
    error: null,
  })
  const [clearDialog, setClearDialog] = useState<ClearDialogState>({
    open: false,
  })

  /**
   * 待导入数据注入。
   *
   * 列表层「导入文件」会把解析结果存到 sessionStorage（key 前缀见
   * `PENDING_IMPORT_STORAGE_PREFIX`），等编辑器路由跳过来 mindMap 实例就绪后，
   * 这里读取并 `mindMap.updateData(data)` 注入到画布；注入完立刻清掉 key，
   * 避免下次刷新/重新进入时重复导入。
   *
   * 只在 mindMap + workspaceId 都 ready 时跑；只跑一次（useRef 锁）。
   */
  const pendingImportInjectedRef = useRef(false)
  useEffect(() => {
    if (!mindMap || !workspaceId || pendingImportInjectedRef.current) return
    const key = `${PENDING_IMPORT_STORAGE_PREFIX}${workspaceId}`
    const raw = sessionStorage.getItem(key)
    if (!raw) return
    pendingImportInjectedRef.current = true
    try {
      const parsed = JSON.parse(raw) as MindMapNodeTree
      const dataToSet = recursivelySetExpandFalse(parsed)
      mindMap.updateData(dataToSet)
      if (dataToSet.data && dataToSet.data.uid) {
        // 跟手动导入路径一致：收起所有节点，避免初次渲染过度展开。
        setTimeout(() => {
          mindMap.execCommand("UNEXPAND_ALL", false, dataToSet.data.uid)
        }, 0)
      }
      logger.info("[useCanvasData] 已注入列表层导入的初始数据", { workspaceId })
    } catch (error) {
      logger.error("[useCanvasData] 注入待导入数据失败", error)
    } finally {
      sessionStorage.removeItem(key)
    }
  }, [mindMap, workspaceId])

  /**
   * 打开文件选择器
   */
  const handleOpenFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  /**
   * 处理文件选择后的操作
   */
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      const file = files[0]
      setImportDialog({
        open: true,
        selectedFile: file,
        error: null,
      })
      // 重置input值，这样相同文件可以重复选择
      e.target.value = ""
    }
  }

  /**
   * 关闭导入对话框
   */
  const closeImportDialog = () => {
    setImportDialog(prev => ({
      ...prev,
      open: false,
    }))
  }

  /**
   * 处理导入文件
   * @param file 要导入的文件
   * @param parentNodeId 可选的父节点ID，如果提供，则将文件内容作为子节点导入到该父节点下
   * @param xmindFormat XMind 格式选择（'standard' | 'zm'）
   */
  const handleImportFile = async (
    file: File,
    parentNodeId?: string,
    xmindFormat?: "standard" | "zm"
  ) => {
    try {
      setImportDialog(prev => ({ ...prev, error: null }))

      // 根据文件类型选择相应的解析器
      let sheetData: MindMapNodeTree | null = null
      const fileName = file.name.toLowerCase()

      if (fileName.endsWith(".xmind")) {
        // 根据用户选择的格式使用相应的解析器
        if (xmindFormat === "zm") {
          try {
            sheetData = await parseZMXmindFile(file)
            logger.info("[useCanvasData] 使用 MeterSphere XMind 解析器解析文件")
          } catch (zmError) {
            logger.error("[useCanvasData] MeterSphere XMind 解析失败:", zmError)
            setImportDialog(prev => ({
              ...prev,
              error: i18next.t("mindmap.canvas.parseZmFailed", {
                error:
                  zmError instanceof Error
                    ? zmError.message
                    : i18next.t("mindmap.canvas.unknownError"),
              }),
            }))
            return false
          }
        } else {
          // 标准格式
          sheetData = (await parseXMindFile(file)) as MindMapNodeTree | null
          logger.info("[useCanvasData] 使用标准 XMind 解析器解析文件")
        }
      } else if (fileName.endsWith(".md")) {
        sheetData = await parseMarkdownFile(file)
      } else if (fileName.endsWith(".zip")) {
        sheetData = await importFromZipNested(file)
      } else {
        setImportDialog(prev => ({
          ...prev,
          error: i18next.t("mindmap.canvas.unsupportedFileType"),
        }))
        return false
      }

      if (!sheetData) {
        setImportDialog(prev => ({
          ...prev,
          error: i18next.t("mindmap.canvas.parseFileFailed"),
        }))
        return false
      }

      // 节点数量限制校验
      const importNodeCount = countNodeTree(sheetData)
      if (mindMap) {
        const currentData = mindMap.getData()
        const currentNodeCount = parentNodeId ? countNodeTree(currentData) : 0
        const totalAfterImport = parentNodeId ? currentNodeCount + importNodeCount : importNodeCount // 覆盖导入只看导入数据本身

        if (totalAfterImport > MAX_NODE_COUNT) {
          const msg = parentNodeId
            ? i18next.t("mindmap.canvas.importExceedsLimitToNode", {
                total: totalAfterImport,
                max: MAX_NODE_COUNT,
                current: currentNodeCount,
                count: importNodeCount,
              })
            : i18next.t("mindmap.canvas.importExceedsLimit", {
                count: importNodeCount,
                max: MAX_NODE_COUNT,
              })

          setImportDialog(prev => ({ ...prev, error: msg }))
          toast({
            title: i18next.t("mindmap.canvas.nodeLimitExceededTitle"),
            description: msg,
            variant: "destructive",
          })
          return false
        }
      }

      if (mindMap) {
        if (parentNodeId) {
          const parentNode = mindMap.renderer.findNodeByUid(parentNodeId)
          if (parentNode) {
            if (sheetData && sheetData.data) {
              const collapsedSheetData = recursivelySetExpandFalse(sheetData)

              const newDirectChildUid = collapsedSheetData.data.uid

              if (!newDirectChildUid) {
                logger.error(
                  "[useCanvasData] 导入错误: 解析后的文件根节点数据缺少UID，无法定位以折叠。"
                )
                setImportDialog(prev => ({
                  ...prev,
                  error: i18next.t("mindmap.canvas.missingRootUidError"),
                }))
                return false
              }

              mindMap.execCommand(
                "INSERT_CHILD_NODE",
                false, // openEdit
                [parentNode], // targetNodes
                collapsedSheetData.data, // appointData
                collapsedSheetData.children || [] // appointChildren
              )

              mindMap.execCommand("UNEXPAND_ALL", false, newDirectChildUid)

              // 重要：导入到节点后，也需要保存整个思维导图数据
              try {
                const currentMapData = mindMap.getData()
                if (onSave) {
                  await onSave()
                } else {
                  const convertedData = convertMindMapNodeTreeForDB(currentMapData)
                  await mindmapDB.save(convertedData, workspaceId)
                }
                logger.info("[useCanvasData] 导入到节点后的数据已保存")

                toast({
                  title: i18next.t("mindmap.canvas.importSuccessTitle"),
                  description: i18next.t("mindmap.canvas.importSuccessToNode", {
                    name: parentNode.nodeData.data.text || parentNode.uid,
                  }),
                })

                setImportDialog({ open: false, selectedFile: null, error: null })
                onImportComplete?.()
                return true
              } catch (error) {
                logger.error("[useCanvasData] 保存导入数据到数据库失败:", error)
                setImportDialog(prev => ({
                  ...prev,
                  error: i18next.t("mindmap.canvas.importSavedButFailed", {
                    error:
                      error instanceof Error
                        ? error.message
                        : i18next.t("mindmap.canvas.unknownError"),
                  }),
                }))
                return false
              }
            } else {
              logger.error(
                "[useCanvasData] 解析后的文件数据格式不正确，缺少 .data 属性或 sheetData 为空。"
              )
              setImportDialog(prev => ({
                ...prev,
                error: i18next.t("mindmap.canvas.importFormatError"),
              }))
              return false
            }
          } else {
            setImportDialog(prev => ({
              ...prev,
              error: i18next.t("mindmap.canvas.parentNotFoundError", { id: parentNodeId }),
            }))
            return false
          }
        } else {
          // 🚀 覆盖导入逻辑 - 参考协同更新方式，使用 updateData 实现无感刷新
          const dataToSet = recursivelySetExpandFalse(sheetData)

          // 使用 updateData 而不是 setData，实现无感更新
          mindMap.updateData(dataToSet)

          if (dataToSet.data && dataToSet.data.uid) {
            setTimeout(() => {
              mindMap.execCommand("UNEXPAND_ALL", false, dataToSet.data.uid)
            }, 0)
          }

          // 重要：保存导入的数据
          try {
            if (onSave) {
              await onSave()
            } else {
              const convertedData = convertMindMapNodeTreeForDB(dataToSet)
              await mindmapDB.save(convertedData, workspaceId)
            }
            logger.info("[useCanvasData] 覆盖导入的数据已保存")
          } catch (error) {
            logger.error("[useCanvasData] 保存导入数据到数据库失败:", error)
          }

          toast({
            title: i18next.t("mindmap.canvas.importSuccessTitle"),
            description: i18next.t("mindmap.canvas.importSuccessReplace"),
          })

          setImportDialog({ open: false, selectedFile: null, error: null })
          onImportComplete?.()
          return true
        }
      } else {
        logger.error("mindMap 为空")
        setImportDialog(prev => ({
          ...prev,
          error: i18next.t("mindmap.canvas.mindmapNotInitializedImportError"),
        }))
        return false
      }
    } catch (error) {
      logger.error("导入文件失败:", error)
      setImportDialog(prev => ({
        ...prev,
        error: i18next.t("mindmap.canvas.importFailedError", {
          error: error instanceof Error ? error.message : i18next.t("mindmap.canvas.unknownError"),
        }),
      }))
      return false
    }
  }

  /**
   * 直接导入文件
   * @param parentNodeId 可选的父节点ID
   * @param xmindFormat XMind 格式选择
   */
  const handleDirectImport = async (parentNodeId?: string, xmindFormat?: "standard" | "zm") => {
    if (!importDialog.selectedFile) return false
    return await handleImportFile(importDialog.selectedFile, parentNodeId, xmindFormat)
  }

  /**
   * 打开清除数据对话框
   */
  const openClearDialog = () => {
    setClearDialog({ open: true })
  }

  /**
   * 关闭清除数据对话框
   */
  const closeClearDialog = () => {
    setClearDialog({ open: false })
  }

  /**
   * 清除画布数据
   */
  const handleClearData = async () => {
    try {
      if (!mindMap) {
        toast({
          title: i18next.t("common.error"),
          description: i18next.t("mindmap.canvas.mindmapNotInitialized"),
          variant: "destructive",
        })
        return false
      }

      await mindmapDB.clear(workspaceId)
      logger.info("思维导图数据已清除")

      mindMap.setData(defaultData)
      mindMap.render()
      closeClearDialog()
      toast({
        title: i18next.t("mindmap.canvas.clearSuccessTitle"),
        description: i18next.t("mindmap.canvas.clearSuccessDescription"),
      })
      return true
    } catch (error) {
      logger.error("清除数据失败:", error)
      toast({
        title: i18next.t("mindmap.canvas.clearFailedTitle"),
        description: i18next.t("mindmap.canvas.clearFailedDescription"),
        variant: "destructive",
      })
      return false
    }
  }

  /**
   * 导出画布数据
   * @param type 导出类型
   */
  const handleExportData = async (type: string) => {
    if (!mindMap || !isExportFormat(type)) return false
    try {
      return await exportMindMapToFile(mindMap, type)
    } catch (error) {
      logger.error("导出失败:", error)
      toast({
        title: i18next.t("mindmap.canvas.exportFailedTitle"),
        description: i18next.t("mindmap.canvas.exportFailedDescription"),
        variant: "destructive",
      })
      return false
    }
  }

  return {
    // 引用
    fileInputRef,

    // 状态
    importDialog,
    clearDialog,

    // 导入相关方法
    handleOpenFileInput,
    handleFileChange,
    closeImportDialog,
    handleDirectImport,
    setImportDialog, // 导出 setImportDialog 以便在 UI 中使用

    // 清除相关方法
    openClearDialog,
    closeClearDialog,
    handleClearData,

    // 导出相关方法
    handleExportData,
  }
}
