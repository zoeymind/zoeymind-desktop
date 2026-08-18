/**
 * 未保存离开守卫 —— 拦下所有边界事件, 弹一个"保存 / 丢弃 / 取消"对话框.
 *
 * 拦截来源:
 *   - react-router 路由跳转 (useBlocker)      — 返回列表 / 打开另一项
 *   - window beforeunload                     — 浏览器刷新 / 关标签
 *   - tauri onCloseRequested                  — Cmd+W / 红灯关闭
 *
 * 触发条件: useMindMapStore.isDirty === true 或者当前 id 是 pending 未保存.
 */
import { useEffect, useState } from 'react'
import { useBlocker } from 'react-router-dom'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Button } from '@zoeymind/ui'
import { useMindMapStore } from '@/products/mind/features/mindmap/stores/mindmap-store'
import { pendingProjects } from '@/shared/native'
import type { useSaveFlow } from './save-flow'

type SaveFlow = ReturnType<typeof useSaveFlow>

interface Props {
  projectId: string | null
  saveFlow: SaveFlow
}

export function UnsavedGuard({ projectId, saveFlow }: Props): React.JSX.Element {
  const isDirty = useMindMapStore(s => s.isDirty)
  const isPending = !!projectId && pendingProjects.isPending(projectId)
  const shouldGuard = isDirty || isPending
  const [tauriPromptOpen, setTauriPromptOpen] = useState(false)

  // 路由拦截
  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    if (!shouldGuard) return false
    return currentLocation.pathname !== nextLocation.pathname
  })

  // Tauri 关窗拦截
  useEffect(() => {
    if (!shouldGuard) return
    const win = getCurrentWindow()
    let unlisten: (() => void) | undefined
    void win
      .onCloseRequested(async event => {
        if (
          !useMindMapStore.getState().isDirty &&
          !(projectId && pendingProjects.isPending(projectId))
        ) {
          return
        }
        event.preventDefault()
        setTauriPromptOpen(true)
      })
      .then(fn => {
        unlisten = fn
      })
    return () => {
      unlisten?.()
    }
  }, [shouldGuard, projectId])

  // beforeunload (Ctrl+R / 关标签)
  useEffect(() => {
    if (!shouldGuard) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [shouldGuard])

  const open = blocker.state === 'blocked' || tauriPromptOpen

  const closeAll = () => {
    if (blocker.state === 'blocked') blocker.reset?.()
    setTauriPromptOpen(false)
  }

  const proceed = () => {
    if (tauriPromptOpen) {
      setTauriPromptOpen(false)
      void getCurrentWindow().close()
      return
    }
    if (blocker.state === 'blocked') blocker.proceed?.()
  }

  const handleSave = async () => {
    try {
      await saveFlow.save()
      proceed()
    } catch {
      /* 让用户重试 */
    }
  }

  const handleDiscard = async () => {
    if (projectId && pendingProjects.isPending(projectId)) {
      pendingProjects.clear(projectId)
    } else if (projectId) {
      await saveFlow.discardAndClose()
    }
    useMindMapStore.getState().setDirty(false)
    proceed()
  }

  return (
    <Dialog open={open} onOpenChange={next => (!next ? closeAll() : undefined)}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>还有未保存的改动</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          离开会丢掉未保存的改动. 需要先保存吗?
        </p>
        <DialogFooter className="flex flex-row justify-end gap-2">
          <Button variant="ghost" onClick={closeAll}>
            取消
          </Button>
          <Button variant="outline" onClick={() => void handleDiscard()}>
            不保存
          </Button>
          <Button onClick={() => void handleSave()}>保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
