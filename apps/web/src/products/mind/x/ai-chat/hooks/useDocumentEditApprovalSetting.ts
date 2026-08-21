import { useCallback, useState } from "react"

const STORAGE_KEY = "ai-case-review-enabled"

export function getDocumentEditApprovalEnabled(): boolean {
  if (typeof window === "undefined") return true
  return window.localStorage.getItem(STORAGE_KEY) !== "false"
}

export function setDocumentEditApprovalEnabled(enabled: boolean): void {
  window.localStorage.setItem(STORAGE_KEY, String(enabled))
}

export function useDocumentEditApprovalSetting() {
  const [enabled, setEnabledState] = useState(getDocumentEditApprovalEnabled)
  const setEnabled = useCallback((next: boolean) => {
    setDocumentEditApprovalEnabled(next)
    setEnabledState(next)
  }, [])
  return { enabled, setEnabled }
}
