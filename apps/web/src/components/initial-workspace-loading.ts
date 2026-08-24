import { useLayoutEffect, useState } from "react"
import { useLoadingStore } from "@/shared/app-shared"

export function useInitialWorkspaceLoading(activeId: string): void {
  const [initialActiveId] = useState(activeId)

  useLayoutEffect(() => {
    if (initialActiveId !== "home" && !useLoadingStore.getState().loading) {
      useLoadingStore.getState().showLoading()
    }
  }, [initialActiveId])
}
