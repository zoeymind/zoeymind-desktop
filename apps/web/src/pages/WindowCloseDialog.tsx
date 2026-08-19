import { useEffect, useState } from "react"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { useTranslation } from "@zoeymind/i18n"
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@zoeymind/ui"
import {
  discardAllSessions,
  getGuardedSessions,
  saveAllSessions,
} from "@/shared/native/window-close-coordinator"
import type { ProjectSessionStore } from "@/products/mind/editor-session"

export function WindowCloseDialog() {
  const { t } = useTranslation()
  const [sessions, setSessions] = useState<ProjectSessionStore[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const window = getCurrentWindow()
    let allowClose = false
    let unlisten: (() => void) | undefined
    void window
      .onCloseRequested(event => {
        if (allowClose) return
        const guarded = getGuardedSessions()
        if (guarded.length === 0) return
        event.preventDefault()
        setSessions(guarded)
        setError(null)
      })
      .then(listener => {
        unlisten = listener
      })
    const proceed = () => {
      allowClose = true
      void window.close()
    }
    closeWindow = proceed
    return () => {
      unlisten?.()
      if (closeWindow === proceed) closeWindow = null
    }
  }, [])

  const handleSaveAll = async () => {
    setBusy(true)
    setError(null)
    try {
      await saveAllSessions(sessions)
      closeWindow?.()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("windowClose.saveFailed"))
    } finally {
      setBusy(false)
    }
  }

  const handleDiscardAll = async () => {
    setBusy(true)
    try {
      await discardAllSessions(sessions)
      closeWindow?.()
    } finally {
      setBusy(false)
    }
  }

  if (sessions.length === 0) return null

  return (
    <Dialog open onOpenChange={open => !open && !busy && setSessions([])}>
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{t("windowClose.title", { count: sessions.length })}</DialogTitle>
          <DialogDescription>{t("windowClose.description")}</DialogDescription>
        </DialogHeader>
        <ul className="max-h-48 overflow-y-auto text-sm text-muted-foreground">
          {sessions.map(session => (
            <li key={session.getState().projectId} className="truncate py-1">
              {session.getState().title ?? session.getState().projectId}
            </li>
          ))}
        </ul>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="ghost" disabled={busy} onClick={() => setSessions([])}>
            {t("common.cancel")}
          </Button>
          <Button variant="outline" disabled={busy} onClick={() => void handleDiscardAll()}>
            {t("windowClose.discardAll")}
          </Button>
          <Button disabled={busy} onClick={() => void handleSaveAll()}>
            {t("windowClose.saveAll")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

let closeWindow: (() => void) | null = null
