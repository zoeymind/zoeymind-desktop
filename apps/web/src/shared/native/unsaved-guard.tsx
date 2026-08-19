/**
 * 未保存离开守卫 —— tabbed workflow 下只做 Tauri 关窗 + beforeunload 拦截.
 *
 * 路由拦截 (useBlocker) 在 tabs 时代不再适用: 切 tab 不改路由的 back/forward
 * 语义, 关 tab 走 TabBar 里独立的 CloseConfirmDialog. 这里只保留窗口级别的:
 *   - tauri onCloseRequested (Cmd+Q / 红灯 / 更新触发的关窗)
 *   - browser beforeunload (Ctrl+R / 关标签)
 */
import { useEffect, useState } from "react"
import { getCurrentWindow } from "@tauri-apps/api/window"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
} from "@zoeymind/ui"
import {
  useProjectMindMapStore as useMindMapStore,
  useProjectSessionStore,
} from "@/products/mind/editor-session"
import { pendingProjects } from "@/shared/native"
import type { useSaveFlow } from "./save-flow"

type SaveFlow = ReturnType<typeof useSaveFlow>

interface Props {
  projectId: string | null
  saveFlow: SaveFlow
}

export function UnsavedGuard({ projectId, saveFlow }: Props): React.JSX.Element | null {
  const isDirty = useMindMapStore(s => s.isDirty)
  const sessionStore = useProjectSessionStore()
  const isPending = !!projectId && pendingProjects.isPending(projectId)
  const shouldGuard = isDirty || isPending
  const [promptOpen, setPromptOpen] = useState(false)

  // Tauri 关窗
  useEffect(() => {
    if (!shouldGuard) return
    const win = getCurrentWindow()
    let unlisten: (() => void) | undefined
    void win
      .onCloseRequested(async event => {
        if (
          !sessionStore.getState().dirty &&
          !(projectId && pendingProjects.isPending(projectId))
        ) {
          return
        }
        event.preventDefault()
        setPromptOpen(true)
      })
      .then(fn => {
        unlisten = fn
      })
    return () => {
      unlisten?.()
    }
  }, [shouldGuard, projectId, sessionStore])

  // beforeunload
  useEffect(() => {
    if (!shouldGuard) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ""
    }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [shouldGuard])

  const proceedClose = () => {
    setPromptOpen(false)
    void getCurrentWindow().close()
  }

  const handleSave = async () => {
    try {
      await saveFlow.save()
      proceedClose()
    } catch {
      /* 保留窗口 */
    }
  }

  const handleDiscard = () => {
    if (projectId && pendingProjects.isPending(projectId)) {
      pendingProjects.clear(projectId)
    }
    sessionStore.getState().setDirty(false)
    proceedClose()
  }

  if (!promptOpen) return null

  return (
    <Dialog open onOpenChange={next => (!next ? setPromptOpen(false) : undefined)}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>还有未保存的改动</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">关闭窗口会丢掉未保存的改动. 需要先保存吗?</p>
        <DialogFooter className="flex flex-row justify-end gap-2">
          <Button variant="ghost" onClick={() => setPromptOpen(false)}>
            取消
          </Button>
          <Button variant="outline" onClick={handleDiscard}>
            不保存
          </Button>
          <Button onClick={() => void handleSave()}>保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
