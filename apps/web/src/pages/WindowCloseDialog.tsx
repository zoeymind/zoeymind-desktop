import { useEffect, useState } from "react"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { listen } from "@tauri-apps/api/event"
import { exit as processExit } from "@tauri-apps/plugin-process"
import { useTranslation } from "@zoeymind/i18n"
import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
} from "@zoeymind/ui"
import {
  discardAllSessions,
  getGuardedSessions,
  saveAllSessions,
} from "@/shared/native/window-close-coordinator"
import type { ProjectSessionStore } from "@/products/mind/editor-session"
import {
  CLOSE_BEHAVIOR_KEY,
  getCloseBehavior,
  type CloseBehavior,
} from "@/shared/native/close-behavior"

/**
 * 统一退出/关闭协调器. 所有退出意图汇聚到这里, 保证未保存守卫只写一次.
 *
 * 入口:
 *   1. 主窗口关闭按钮 -> onCloseRequested
 *        - 有脏 session: 守卫对话框, 保存/丢弃后执行 window.close()
 *        - 干净 + behavior=quit: 放行, Tauri 直接 close
 *        - 干净 + behavior=tray: 拦截, window.hide() (托盘图标恢复)
 *        - 干净 + behavior=ask: 拦截, 弹出 "关闭方式" 选择对话框
 *   2. 系统托盘 "退出" 菜单 -> Rust emit "zm:request-exit"
 *        - 有脏 session: 守卫对话框, 保存/丢弃后执行 process.exit(0)
 *        - 干净: 直接 process.exit(0)
 *
 * 提交动作 (proceed) 按调用方决定: close-button 用 window.close(), 托盘/显式退出用 process.exit(0).
 * 守卫对话框始终执行 proceed(); 不再区分 "close vs quit" 分支逻辑.
 */
export function WindowCloseDialog() {
  const { t } = useTranslation()
  const [sessions, setSessions] = useState<ProjectSessionStore[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [askOpen, setAskOpen] = useState(false)
  const [remember, setRemember] = useState(false)
  // proceed 存 state 时序太脆弱 (close event 到 setSessions 到 dialog 到用户点确认经历多次 render),
  // 用 ref-like 闭包变量保住捕获.
  const [pendingProceed, setPendingProceed] = useState<{ run: () => void } | null>(null)

  useEffect(() => {
    const window = getCurrentWindow()
    let allowClose = false
    let disposed = false
    let unlistenCloseReq: (() => void) | undefined
    let unlistenExitReq: (() => void) | undefined

    const runGuard = (proceed: () => void, onCleanFallback?: () => void) => {
      const guarded = getGuardedSessions()
      if (guarded.length > 0) {
        setPendingProceed({ run: proceed })
        setError(null)
        setSessions(guarded)
        return true
      }
      onCleanFallback?.()
      return false
    }

    void window
      .onCloseRequested(event => {
        if (allowClose) return
        const proceed = () => {
          allowClose = true
          void window.close()
        }
        // 脏文件: 守卫先于关闭偏好.
        if (runGuard(proceed)) {
          event.preventDefault()
          return
        }
        const behavior = getCloseBehavior()
        if (behavior === "quit") return // 放行
        if (behavior === "tray") {
          event.preventDefault()
          void window.hide()
          return
        }
        // ask
        event.preventDefault()
        setRemember(false)
        setPendingProceed({ run: proceed })
        setAskOpen(true)
      })
      .then(listener => {
        if (disposed) listener()
        else unlistenCloseReq = listener
      })

    // Rust 托盘 "退出" 菜单转发. 显式退出意图: 跳过关闭偏好, 直接进入守卫.
    void listen("zm:request-exit", () => {
      runGuard(
        () => {
          void processExit(0)
        },
        () => {
          void processExit(0)
        }
      )
    }).then(listener => {
      if (disposed) listener()
      else unlistenExitReq = listener
    })

    return () => {
      disposed = true
      unlistenCloseReq?.()
      unlistenExitReq?.()
    }
  }, [])

  const finishGuard = () => {
    const action = pendingProceed
    setPendingProceed(null)
    setSessions([])
    action?.run()
  }

  const cancelGuard = () => {
    setPendingProceed(null)
    setSessions([])
  }

  const handleSaveAll = async () => {
    setBusy(true)
    setError(null)
    try {
      await saveAllSessions(sessions)
      finishGuard()
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
      finishGuard()
    } finally {
      setBusy(false)
    }
  }

  const applyAskChoice = (choice: Exclude<CloseBehavior, "ask">) => {
    if (remember) window.localStorage.setItem(CLOSE_BEHAVIOR_KEY, choice)
    setAskOpen(false)
    if (choice === "tray") {
      setPendingProceed(null)
      void getCurrentWindow().hide()
    } else {
      // "quit" from ask: 用户明确要退出应用, 不只是关闭窗口. 覆写 pendingProceed 用 process.exit.
      const action = { run: () => void processExit(0) }
      setPendingProceed(null)
      action.run()
    }
  }

  return (
    <>
      {sessions.length > 0 && (
        <Dialog open onOpenChange={open => !open && !busy && cancelGuard()}>
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
              <Button variant="ghost" disabled={busy} onClick={cancelGuard}>
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
      )}
      <Dialog open={askOpen} onOpenChange={setAskOpen}>
        <DialogContent className="sm:max-w-md" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{t("windowClose.askTitle")}</DialogTitle>
            <DialogDescription>{t("windowClose.askDescription")}</DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <Checkbox
              id="window-close-remember"
              checked={remember}
              onCheckedChange={value => setRemember(value === true)}
            />
            <Label htmlFor="window-close-remember" className="text-sm font-normal">
              {t("windowClose.rememberChoice")}
            </Label>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAskOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button variant="outline" onClick={() => applyAskChoice("tray")}>
              {t("windowClose.minimizeToTray")}
            </Button>
            <Button onClick={() => applyAskChoice("quit")}>{t("windowClose.quitApp")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
