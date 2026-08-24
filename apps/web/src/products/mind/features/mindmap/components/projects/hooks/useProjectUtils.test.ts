// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest"
import { renderHook } from "@testing-library/react"
import { useProjectUtils } from "./useProjectUtils"
import { initI18n } from "@zoeymind/i18n"
import { appLocales } from "@/locales"
import type { LocalProject } from "../project-model"

function project(overrides: Partial<LocalProject> = {}): LocalProject {
  return {
    id: "test-project",
    name: "Test Project",
    path: "/tmp/test-project.zmind",
    folderId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    exists: true,
    isArchived: false,
    isStarred: false,
    tags: [],
    nodeCount: 0,
    size: 0,
    ...overrides,
  }
}

await initI18n(appLocales).changeLanguage("zh-CN")

describe("useProjectUtils", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("getRelativeTime", () => {
    it('should return "刚刚" for very recent dates', () => {
      const { result } = renderHook(() => useProjectUtils())
      const now = new Date()
      const date = new Date(now.getTime() - 30 * 1000) // 30秒前

      expect(result.current.getRelativeTime(date)).toBe("刚刚")
    })

    it("should return minutes for dates within an hour", () => {
      const { result } = renderHook(() => useProjectUtils())
      const now = new Date()
      const date = new Date(now.getTime() - 15 * 60 * 1000) // 15分钟前

      expect(result.current.getRelativeTime(date)).toBe("15分钟前")
    })

    it("should return hours for dates within a day", () => {
      const { result } = renderHook(() => useProjectUtils())
      const now = new Date()
      const date = new Date(now.getTime() - 3 * 60 * 60 * 1000) // 3小时前

      expect(result.current.getRelativeTime(date)).toBe("3小时前")
    })

    it("should return days for dates older than a day", () => {
      const { result } = renderHook(() => useProjectUtils())
      const now = new Date()
      const date = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000) // 5天前

      expect(result.current.getRelativeTime(date)).toBe("5天前")
    })
  })

  describe("getPreviewImageSize", () => {
    it("should return 0 for empty preview", () => {
      const { result } = renderHook(() => useProjectUtils())

      expect(result.current.getPreviewImageSize(undefined)).toBe(0)
    })

    it("should estimate size from base64 string", () => {
      const { result } = renderHook(() => useProjectUtils())
      const base64Preview = `data:image/png;base64,${"A".repeat(1000)}`

      const size = result.current.getPreviewImageSize(base64Preview)
      expect(size).toBeGreaterThan(0)
    })
  })

  describe("getProjectSize", () => {
    it("should return size from metadata if available", () => {
      const { result } = renderHook(() => useProjectUtils())
      const item = project({ id: "test-1", size: 102400 })

      const size = result.current.getProjectSize(item)
      expect(size).toBe("100.0KB")
    })

    it("should estimate size when metadata not available", () => {
      const { result } = renderHook(() => useProjectUtils())
      const item = project({ id: "test-2", nodeCount: 10 })

      const size = result.current.getProjectSize(item)
      expect(size).toBeTruthy()
      expect(typeof size).toBe("string")
    })

    it("should format bytes correctly", () => {
      const { result } = renderHook(() => useProjectUtils())

      // Bytes
      const projectB = project({ id: "test-3", size: 500 })
      expect(result.current.getProjectSize(projectB)).toBe("500B")

      // KB
      const projectKB = project({ id: "test-4", size: 1024 * 50 })
      expect(result.current.getProjectSize(projectKB)).toBe("50.0KB")

      // MB
      const projectMB = project({ id: "test-5", size: 1024 * 1024 * 2 })
      expect(result.current.getProjectSize(projectMB)).toBe("2.0MB")
    })
  })

  describe("getProjectColor", () => {
    it("should return consistent color for same project ID", () => {
      const { result } = renderHook(() => useProjectUtils())
      const workspaceId = "test-project-123"

      const color1 = result.current.getProjectColor(workspaceId)
      const color2 = result.current.getProjectColor(workspaceId)

      expect(color1).toBe(color2)
    })

    it("should return different colors for different project IDs", () => {
      const { result } = renderHook(() => useProjectUtils())

      const color1 = result.current.getProjectColor("project-1")
      const color2 = result.current.getProjectColor("project-2")

      expect(color1).not.toBe(color2)
    })

    it("should return color from predefined list", () => {
      const { result } = renderHook(() => useProjectUtils())
      const workspaceId = "test-project"

      const color = result.current.getProjectColor(workspaceId)
      expect(color).toMatch(/^hsl\(/)
    })
  })
})
