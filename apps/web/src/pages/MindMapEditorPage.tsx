/**
 * 桌面端思维导图编辑器路由 —— 纯本地实现。
 *
 * URL: `/editor/:id` → 从 SqlProjectRepo 取 project.path → readBundle → 挂 simple-mind-map。
 *
 * 存储流程：
 *   - Ctrl/Cmd+S / TopBar "保存" → useSaveFlow.save()
 *   - 编辑器每次 data_change → markDirty + registerBundleSource（脏 5s 后 recovery/*.zmind）
 *   - blur / beforeunload → flush recovery
 *   - 保存成功 → clearRecovery
 *
 * 云功能：全部去掉（不接入 useCloudStorageManager / useCollaborationManager /
 * useCommentYJS / usePermissionStore / trpcClient.mindmap.content.getYDocBinary）。
 *
 * 富 UI（TopBar / FormatPanel / IconToolbar / StatusBar）：后续迭代把老 MindMapCanvas
 * 的组件按需接进来，先跑通"打开-编辑-保存"闭环。
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Loader2, Save, AlertTriangle } from 'lucide-react'
import MindMap from 'simple-mind-map'
import type { MindMapNodeTree } from 'simple-mind-map'
import { useTranslation } from '@zoeymind/i18n'
import { logger } from '@zoeymind/logger'
import { toast } from '@/shared/app-shared'
import {
  getProject,
  readBundle,
  touchLastOpened,
  useSaveFlow
} from '@/shared/native'
import { useMindMapStore } from '@/products/mind/features/mindmap/stores/mindmap-store'

interface LoadState {
  status: 'loading' | 'missing' | 'ready' | 'error'
  path: string | null
  name: string
  tree: MindMapNodeTree | null
  error?: string
}

function countNodes(tree: MindMapNodeTree | null | undefined): number {
  if (!tree) return 0
  const children = Array.isArray(tree.children) ? tree.children : []
  let total = 1
  for (const child of children) total += countNodes(child)
  return total
}

export function MindMapEditorPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const containerRef = useRef<HTMLDivElement>(null)
  const mindMapRef = useRef<MindMap | null>(null)
  const setDirty = useMindMapStore(s => s.setDirty)
  const isDirty = useMindMapStore(s => s.isDirty)
  const [state, setState] = useState<LoadState>({
    status: 'loading',
    path: null,
    name: '',
    tree: null
  })

  const flow = useSaveFlow(id ?? null)

  // 加载 .zmind
  useEffect(() => {
    if (!id) return
    let mounted = true
    void (async () => {
      const row = await getProject(id)
      if (!mounted) return
      if (!row) {
        setState({ status: 'missing', path: null, name: '', tree: null })
        return
      }
      if (!row.exists) {
        setState({ status: 'missing', path: row.path, name: row.name, tree: null })
        return
      }
      try {
        const bundle = await readBundle(row.path)
        if (!mounted) return
        setState({
          status: 'ready',
          path: row.path,
          name: bundle.meta.name || row.name,
          tree: bundle.tree
        })
        await touchLastOpened(id)
      } catch (error) {
        logger.error('读取 .zmind 失败', error)
        setState({
          status: 'error',
          path: row.path,
          name: row.name,
          tree: null,
          error: (error as Error).message
        })
      }
    })()
    return () => {
      mounted = false
      setDirty(false)
    }
  }, [id, setDirty])

  // 挂 MindMap 引擎
  useEffect(() => {
    if (state.status !== 'ready' || !state.tree || !containerRef.current) return
    if (mindMapRef.current) {
      mindMapRef.current.destroy?.()
      mindMapRef.current = null
    }
    const mm = new MindMap({
      el: containerRef.current,
      data: state.tree
    })
    mindMapRef.current = mm

    const sync = () => {
      const currentTree = mm.getData() as MindMapNodeTree
      flow.registerBundleSource({
        tree: currentTree,
        name: state.name,
        nodeCount: countNodes(currentTree)
      })
    }
    // 初始一次
    sync()

    const onChange = () => {
      sync()
      flow.markDirty()
    }
    mm.on?.('data_change', onChange)
    mm.on?.('node_active', sync)

    return () => {
      mm.off?.('data_change', onChange)
      mm.off?.('node_active', sync)
      mm.destroy?.()
      mindMapRef.current = null
    }
  }, [state.status, state.tree, state.name, flow])

  const handleSave = useCallback(async () => {
    try {
      await flow.save()
      toast.success(t('common.saved') ?? '已保存')
    } catch (error) {
      logger.error('保存失败', error)
      toast.error(`${t('common.saveFailed') ?? '保存失败'}: ${(error as Error).message}`)
    }
  }, [flow, t])

  const handleBack = useCallback(async () => {
    if (isDirty) {
      const ok = window.confirm(t('mindmap.editor.unsavedConfirm') ?? '有未保存的改动，确认离开？')
      if (!ok) return
      await flow.discardAndClose()
    }
    navigate('/')
  }, [flow, isDirty, navigate, t])

  if (!id) {
    return <div className="p-8">missing id</div>
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <div className="flex items-center justify-between border-b px-4 py-2">
        <button
          onClick={() => void handleBack()}
          className="inline-flex items-center gap-1 rounded p-1.5 text-sm hover:bg-muted"
        >
          <ArrowLeft className="size-4" />
          {t('common.back') ?? '返回'}
        </button>
        <div className="text-sm font-medium">
          {state.name || (t('mindmap.editor.untitled') ?? '未命名')}
          {isDirty ? <span className="ml-1 text-muted-foreground">•</span> : null}
        </div>
        <button
          onClick={() => void handleSave()}
          disabled={!isDirty || state.status !== 'ready'}
          className="inline-flex items-center gap-1 rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground disabled:opacity-50"
        >
          <Save className="size-3.5" />
          {t('common.save') ?? '保存'}
          <span className="ml-1 opacity-70">⌘S</span>
        </button>
      </div>

      <div className="flex-1 relative">
        {state.status === 'loading' && (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
            <Loader2 className="size-4 animate-spin mr-2" />
            {t('mindmap.editor.loading') ?? '加载中...'}
          </div>
        )}
        {state.status === 'missing' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <AlertTriangle className="size-6 text-destructive" />
            <div className="text-sm">
              {t('mindmap.editor.fileMissing') ?? '找不到源文件'}
            </div>
            {state.path && (
              <div className="text-xs opacity-70 max-w-[540px] truncate">{state.path}</div>
            )}
            <button
              onClick={() => navigate('/')}
              className="mt-3 rounded border px-3 py-1 text-xs"
            >
              {t('common.back') ?? '返回列表'}
            </button>
          </div>
        )}
        {state.status === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-destructive">
            <div>{state.error}</div>
          </div>
        )}
        <div
          ref={containerRef}
          className="h-full w-full"
          style={{ visibility: state.status === 'ready' ? 'visible' : 'hidden' }}
        />
      </div>
    </div>
  )
}

export default MindMapEditorPage
