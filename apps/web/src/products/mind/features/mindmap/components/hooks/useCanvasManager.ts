// @ts-nocheck — cloud/collab type debt; runtime gated by no-op shims
import { logger } from '@zoeymind/logger'
import { useEffect, useRef } from 'react'
import MindMap from 'simple-mind-map'
import { customCheckIsTouchPad } from '@/products/mind/lib/isTouchPad'
import { defaultMindmapData, MAX_NODE_COUNT } from '@zoeymind/shared'
import { usePermissionStore } from '@/products/mind/features/mindmap/stores/permission-store'
import { useProjectContext } from '@/products/mind/features/mindmap/contexts/ProjectContext'
import { useThemePreset } from '@/shared/app-shared'
import { useTheme } from '@zoeymind/ui'

const PERFORMANCE_MODE_KEY = 'mind-map-performance-mode'
const PERFORMANCE_CONFIG_KEY = 'mind-map-performance-config'
const ALIGN_SAME_LEVEL_WIDTH_KEY = 'mind-map-align-same-level-width'

// 使用共享包中的默认数据
export const defaultData = defaultMindmapData

function readThemeToken(styles: CSSStyleDeclaration, name: string, fallback: string): string {
  const value = styles.getPropertyValue(name).trim()
  if (!value) return fallback
  return value.startsWith('hsl(') || value.startsWith('#') || value.startsWith('rgb(')
    ? value
    : `hsl(${value})`
}

interface AppPresetMindmapStyles {
  themeConfig: Record<string, unknown>
  hoverRectColor: string
  hoverRectBackdropColor: string
  expandBtnStyle: {
    color: string
    fill: string
    fontSize: number
    strokeColor: string
    strokeWidth: number
  }
  dragPlaceholderLineConfig: {
    color: string
    width: number
  }
  quickCreateChildBtnIcon: {
    icon: string
    style: {
      color: string
    }
  }
}

function createAppPresetMindmapStyles(): AppPresetMindmapStyles {
  const styles = getComputedStyle(document.documentElement)
  const background = readThemeToken(styles, '--background', '#ffffff')
  const foreground = readThemeToken(styles, '--foreground', '#111111')
  const card = readThemeToken(styles, '--card', '#ffffff')
  const cardForeground = readThemeToken(styles, '--card-foreground', '#111111')
  const primary = readThemeToken(styles, '--primary', '#111111')
  const primaryForeground = readThemeToken(styles, '--primary-foreground', '#ffffff')
  const secondary = readThemeToken(styles, '--secondary', card)
  const secondaryForeground = readThemeToken(styles, '--secondary-foreground', cardForeground)
  const accent = readThemeToken(styles, '--accent', secondary)
  const accentForeground = readThemeToken(styles, '--accent-foreground', secondaryForeground)
  const border = readThemeToken(styles, '--border', '#e5e5e5')
  const mutedForeground = readThemeToken(styles, '--muted-foreground', '#666666')
  const ring = readThemeToken(styles, '--ring', primary)

  return {
    hoverRectColor: ring,
    hoverRectBackdropColor: accent,
    expandBtnStyle: {
      color: primary,
      fill: card,
      fontSize: 13,
      strokeColor: ring,
      strokeWidth: 1
    },
    dragPlaceholderLineConfig: {
      color: ring,
      width: 2
    },
    quickCreateChildBtnIcon: {
      icon: '',
      style: {
        color: primary
      }
    },
    themeConfig: {
      backgroundColor: background,
      lineColor: border,
      generalizationLineColor: ring,
      associativeLineColor: mutedForeground,
      associativeLineActiveWidth: 3,
      associativeLineActiveColor: primary,
      associativeLineTextColor: foreground,
      hoverRectColor: ring,
      root: {
        fillColor: primary,
        color: primaryForeground,
        borderColor: primary,
        borderWidth: 1,
        borderRadius: 8,
        startColor: primary,
        endColor: primary,
        hoverRectColor: ring
      },
      second: {
        fillColor: secondary,
        color: secondaryForeground,
        borderColor: border,
        borderWidth: 1,
        borderRadius: 8,
        startColor: secondary,
        endColor: secondary,
        hoverRectColor: ring
      },
      node: {
        fillColor: card,
        color: cardForeground,
        borderColor: border,
        borderWidth: 1,
        borderRadius: 8,
        startColor: card,
        endColor: card,
        hoverRectColor: ring
      },
      generalization: {
        fillColor: accent,
        color: accentForeground,
        borderColor: ring,
        borderWidth: 1,
        borderRadius: 8,
        startColor: accent,
        endColor: accent,
        hoverRectColor: ring
      }
    }
  }
}

function createAppPresetMindmapThemeConfig(): Record<string, unknown> {
  return createAppPresetMindmapStyles().themeConfig
}

function applyAppPresetMindmapStyles(instance: MindMap): void {
  const appStyles = createAppPresetMindmapStyles()
  instance.opt.hoverRectColor = appStyles.hoverRectColor
  ;(instance.opt as Record<string, unknown>).hoverRectBackdropColor =
    appStyles.hoverRectBackdropColor
  instance.opt.expandBtnStyle = appStyles.expandBtnStyle
  instance.opt.dragPlaceholderLineConfig = appStyles.dragPlaceholderLineConfig
  instance.opt.quickCreateChildBtnIcon = appStyles.quickCreateChildBtnIcon
  instance.setThemeConfig(appStyles.themeConfig)
}

export interface MindMapSavedData {
  data?: unknown
  [key: string]: unknown
}

interface SavedData {
  savedData: MindMapSavedData | null
  savedViewData: { scale: number; translateX: number; translateY: number } | null
}

/**
 * 自定义Hook，用于管理画布的初始化和销毁
 * @param containerRef 容器引用
 * @param setMindMap 设置思维导图实例的函数
 * @param workspaceId 项目ID
 * @param loadSavedData 加载保存数据的函数
 * @param saveData 保存数据的函数
 * @param hideLoading 隐藏加载动画的函数
 * @param canEdit 是否可以编辑（用于协同权限控制）
 */
export function useCanvasManager(
  containerRef: React.RefObject<HTMLDivElement | null>,
  setMindMap: React.Dispatch<React.SetStateAction<MindMap | null>>,
  loadSavedData?: () => Promise<SavedData>,
  saveData?: () => Promise<void>,
  reloadToken: number = 0,
  onLoadError?: (error: unknown) => void,
  updateProgress?: (progress: number) => void
) {
  // ✅ 从 store 获取权限状态和检查完成状态
  const { canEdit, checkCompleted, hasPermission } = usePermissionStore()
  // 🎯 从 Context 获取 workspaceId 和 cloudMode (页面级作用域)
  const { workspaceId, cloudMode } = useProjectContext()
  // 保存实例的引用以便在清理时使用
  const instanceRef = useRef<MindMap | null>(null)
  // 添加初始化锁，防止重复初始化
  const initializingRef = useRef(false)
  // 添加项目ID引用，用于检测变化
  const currentProjectIdRef = useRef<string | undefined>(undefined)
  const currentReloadTokenRef = useRef<number>(0)
  const { resolvedTheme } = useTheme()
  const { presetId } = useThemePreset()

  // 独立的resize监听器useEffect，不受projectId变化影响
  useEffect(() => {
    // 添加窗口大小变化监听
    const handleResize = () => {
      if (instanceRef.current) {
        // MindMap的resize方法会自动重新获取容器尺寸并更新SVG
        instanceRef.current.resize()
      }
    }

    // 添加resize监听器
    window.addEventListener('resize', handleResize, { passive: true })

    return () => {
      // 移除窗口大小变化监听
      window.removeEventListener('resize', handleResize)
    }
  }, []) // 空依赖数组，只在组件挂载/卸载时执行

  useEffect(() => {
    if (!containerRef.current) {
      // logger.debug('useCanvasManager: 容器未准备好，跳过初始化')
      return
    }
    if (!workspaceId) {
      // logger.debug('useCanvasManager: 没有projectId，跳过初始化')
      return
    }

    // ✅ 等待权限检查完成后再初始化（修复权限时序问题）
    if (!checkCompleted) {
      // logger.debug('useCanvasManager: 权限检查未完成，等待中...', { workspaceId, checkCompleted })
      return
    }

    // 如果项目ID没有变化且已有实例，则不重新初始化
    if (
      currentProjectIdRef.current === workspaceId &&
      currentReloadTokenRef.current === reloadToken &&
      instanceRef.current
    ) {
      // logger.debug('useCanvasManager: projectId和reloadToken未变化，跳过初始化', { workspaceId, reloadToken })
      return
    }

    // 如果正在初始化，则跳过
    if (initializingRef.current) {
      logger.warn('useCanvasManager: 正在初始化中，跳过新的初始化请求', {
        workspaceId,
        currentProjectId: currentProjectIdRef.current
      })
      return
    }

    const initializeMindMap = async () => {
      initializingRef.current = true

      // 移除独立的loading逻辑，统一由MindMapCanvas管理

      try {
        // 清理容器
        if (containerRef.current && containerRef.current.children.length > 0) {
          containerRef.current.innerHTML = ''
        }

        // 创建新实例前保存当前数据
        if (instanceRef.current) {
          try {
            if (saveData) await saveData()
            instanceRef.current.destroy()
            instanceRef.current = null
            // ✅ 清空 store 中的实例，避免其他组件引用已销毁的实例
            setMindMap(null)
          } catch (error) {
            logger.warn('清理旧实例失败:', error)
          }
        }

        // 从 IndexedDB 加载数据，如果指定了projectId，则从对应项目加载
        let savedData = null
        let savedViewData = null

        if (loadSavedData) {
          try {
            updateProgress?.(55)
            const loadedData = await loadSavedData()
            savedData = loadedData.savedData
            savedViewData = loadedData.savedViewData
            updateProgress?.(60)
          } catch (error) {
            logger.error('加载数据失败:', error)
            if (cloudMode) {
              throw error
            }
          }
        }

        const appStyles = createAppPresetMindmapStyles()
        updateProgress?.(65)

        // 使用savedData或默认数据
        const dataToUse = savedData?.data ? savedData : defaultData
        const initialDocState = savedData?.__initialYDocState

        // 读取性能模式设置
        const isPerformanceMode = localStorage.getItem(PERFORMANCE_MODE_KEY) === 'true'

        // 读取同层级节点等宽设置
        const isAlignSameLevelWidth = localStorage.getItem(ALIGN_SAME_LEVEL_WIDTH_KEY) === 'true'

        // 读取性能配置
        let performanceConfig = {}
        if (isPerformanceMode) {
          const savedConfig = localStorage.getItem(PERFORMANCE_CONFIG_KEY)
          try {
            performanceConfig = savedConfig ? JSON.parse(savedConfig) : {}
          } catch {
            performanceConfig = {}
          }
        }

        // 确保容器仍然存在
        if (cloudMode && !checkCompleted) {
          return
        }

        if (cloudMode && checkCompleted && !hasPermission) {
          return
        }

        if (!containerRef.current) {
          return
        }

        // 创建 MindMap 实例，使用类型安全的配置
        const mindMapOptions = {
          el: containerRef.current,
          data: dataToUse,
          width: window.innerWidth,
          height: window.innerHeight,
          layout: 'logicalStructure',
          theme: 'default',
          themeConfig: appStyles.themeConfig,
          openPerformance: isPerformanceMode,
          performanceConfig,
          alignSameLevelNodeWidth: isAlignSameLevelWidth,
          // 扩展选项（这些不在标准接口中，但 simple-mind-map 支持）
          layoutDirection: 2,
          useLeftKeySelectionRightKeyDrag: true,
          dragTargetType: 'canvas',
          openRealtimeRenderOnNodeTextEdit: true,
          alwaysShowExpandBtn: false,
          hoverRectColor: appStyles.hoverRectColor,
          hoverRectBackdropColor: appStyles.hoverRectBackdropColor,
          expandBtnStyle: appStyles.expandBtnStyle,
          dragPlaceholderLineConfig: appStyles.dragPlaceholderLineConfig,
          quickCreateChildBtnIcon: appStyles.quickCreateChildBtnIcon,
          // 自由视窗模式：不再把思维导图限制在画布内，可自由平移到空白区域（滚动条反映视窗距离）
          isLimitMindMapInCanvasWhenHasScrollbar: false,
          // 键盘导航时不移动画布到中心，保持画布位置不变
          keyboardNavigationMoveToCenter: false,
          // 添加自定义触控板检测函数
          customCheckIsTouchPad,
          maxNodeCount: MAX_NODE_COUNT,
          cooperateDisableInitialSync: false, // 正常模式下不禁用初始同步
          cooperateInitialDocState: initialDocState,
          allowReadonlyContextMenu: canEdit === false,
          readonly: canEdit === false,
          // 协同更新前的钩子函数，用于权限控制
          beforeCooperateUpdate:
            canEdit === false
              ? (updateInfo: { list?: unknown[]; type?: string }) => {
                  // 如果用户没有编辑权限，阻止所有协同更新
                  logger.warn('只读用户尝试进行协同更新，已阻止:', updateInfo)
                  // 清空更新列表来阻止协同更新
                  if (updateInfo.list) {
                    updateInfo.list.length = 0
                  }
                }
              : null
        }

        const instance = new MindMap(mindMapOptions)

        // 设置当前项目ID（通过扩展属性）
        if (workspaceId) {
          ;(instance as MindMap & { workspaceId?: string }).workspaceId = workspaceId
        } else {
          logger.warn('MindMapCanvas: 项目ID未提供，这可能导致AI聊天消息无法正确关联到项目')
          // 设置一个默认项目ID，以确保AI聊天功能能够正常工作
          const defaultId = `mindmap-default-${Date.now()}`
          ;(instance as MindMap & { workspaceId?: string }).workspaceId = defaultId
        }

        // 🚀 修复：设置等待协作同步标记
        if (savedData?.__waitForCollaboration) {
          ;(
            instance as MindMap & { __waitingForCollaboration?: boolean }
          ).__waitingForCollaboration = true
        }

        // 恢复视图数据
        if (savedViewData) {
          try {
            const viewData =
              typeof savedViewData === 'string' ? JSON.parse(savedViewData) : savedViewData
            instance.view.setTransformData(viewData)
          } catch (error) {
            logger.error('恢复视图数据失败:', error)
          }
        }

        // ✅ 不在初始化时设置只读模式，由下面的 useEffect 响应式处理权限变化

        instanceRef.current = instance
        currentProjectIdRef.current = workspaceId
        currentReloadTokenRef.current = reloadToken

        // 在 setMindMap 之前先监听渲染完成事件
        const handleFirstRender = () => {
          updateProgress?.(70)
          // 触发 setMindMap,标记画布已渲染
          setMindMap(instance)
          // 移除监听器,只需要首次渲染
          instance.off('node_tree_render_end', handleFirstRender)
        }

        instance.on('node_tree_render_end', handleFirstRender)

        // 开始渲染
        instance.render()
      } catch (error) {
        logger.error('初始化思维导图失败:', error)
        // 错误处理，loading由MindMapCanvas统一管理
        onLoadError?.(error)
      } finally {
        initializingRef.current = false
      }
    }

    // 添加窗口大小变化监听
    const handleResize = () => {
      if (instanceRef.current) {
        instanceRef.current.resize()
      }
    }

    // 启动异步初始化
    initializeMindMap()

    window.addEventListener('resize', handleResize)

    return () => {
      // 移除窗口大小变化监听
      window.removeEventListener('resize', handleResize)

      // ✅ 主useEffect的清理函数不负责销毁实例
      // 实例的销毁在以下两个地方处理:
      // 1. initializeMindMap 开始时清理旧实例 (项目切换/reload)
      // 2. 组件卸载清理 useEffect (组件真正卸载)
    }
  }, [workspaceId, reloadToken, checkCompleted, cloudMode, canEdit, hasPermission]) // ✅ 只有在权限确认后才初始化

  // 单独的useEffect来处理权限变化时的模式设置
  useEffect(() => {
    if (instanceRef.current && canEdit !== undefined) {
      const shouldBeReadonly = canEdit === false
      const currentMode = instanceRef.current.opt.readonly
      instanceRef.current.opt.allowReadonlyContextMenu = shouldBeReadonly

      if (currentMode !== shouldBeReadonly) {
        instanceRef.current.setMode(shouldBeReadonly ? 'readonly' : 'edit')
      }
    }
  }, [canEdit])

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const instance = instanceRef.current
      if (!instance) return
      applyAppPresetMindmapStyles(instance)
    })

    return () => cancelAnimationFrame(frame)
  }, [presetId, resolvedTheme])

  // 组件卸载时的清理函数
  useEffect(() => {
    return () => {
      if (instanceRef.current) {
        try {
          instanceRef.current.destroy()
          instanceRef.current = null
          currentProjectIdRef.current = undefined
          // ✅ 清空 store 中的实例，避免下次打开时误判
          setMindMap(null)
        } catch (error) {
          logger.warn('组件卸载时销毁 MindMap 实例失败:', error)
        }
      }
    }
  }, []) // ✅ 空依赖数组，只在组件真正卸载时执行
}