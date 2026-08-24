// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"
import { useLoadingStore } from "@/shared/app-shared"
import { useInitialWorkspaceLoading } from "./initial-workspace-loading"

beforeEach(() => {
  useLoadingStore.setState({ loading: false, tip: null, progress: 0 })
})

describe("useInitialWorkspaceLoading", () => {
  it("shows loading for a persisted editor on cold start", () => {
    renderHook(() => useInitialWorkspaceLoading("project-a"))
    expect(useLoadingStore.getState().loading).toBe(true)
  })

  it("does not replay global loading when switching keep-alive tabs", () => {
    const { rerender } = renderHook(({ activeId }) => useInitialWorkspaceLoading(activeId), {
      initialProps: { activeId: "home" },
    })

    act(() => useLoadingStore.getState().hideLoading())
    rerender({ activeId: "project-a" })
    rerender({ activeId: "project-b" })

    expect(useLoadingStore.getState().loading).toBe(false)
  })
})
