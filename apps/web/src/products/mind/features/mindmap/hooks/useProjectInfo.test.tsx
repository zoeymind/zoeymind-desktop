// @ts-nocheck — test files not part of runtime build
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useProjectInfo, useProjectTheme, useProjectTitle } from './useProjectInfo'

// 创建测试用的 QueryClient
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0
      }
    }
  })
}

// 测试用的 QueryClient Provider
function createWrapper() {
  const testClient = createTestQueryClient()
  return function TestWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={testClient}>{children}</QueryClientProvider>
  }
}

vi.mock('@/shared/app-shared', () => ({
  trpcClient: {
    mindmap: {
      getById: {
        query: vi.fn()
      }
    }
  }
}))

describe('useProjectInfo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('useProjectInfo', () => {
    it('should return null when workspaceId is not provided', async () => {
      const wrapper = createWrapper()
      const { result } = renderHook(() => useProjectInfo(undefined), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.data).toBeUndefined()
    })

    it('should fetch project info when workspaceId is provided', async () => {
      const { trpcClient } = await import('@/shared/app-shared')
      vi.mocked(trpcClient.mindmap.getById.query).mockResolvedValue({
        success: true,
        mindmap: {
          id: 'project-123',
          title: 'Test Project',
          theme: 'dark',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          description: null,
          tags: [],
          nodeCount: 0,
          createdBy: 'user-123',
          visibility: 'PRIVATE',
          workspaceId: null,
          creator: { id: 'user-123', name: 'Test User', email: null, avatar: null }
        }
      })

      const wrapper = createWrapper()
      const { result } = renderHook(() => useProjectInfo('project-123'), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(trpcClient.mindmap.getById.query).toHaveBeenCalledWith({
        mindmapId: 'project-123'
      })
      expect(result.current.data?.title).toBe('Test Project')
      expect(result.current.data?.theme).toBe('dark')
    })

    it('should return null when query fails', async () => {
      const { trpcClient } = await import('@/shared/app-shared')
      vi.mocked(trpcClient.mindmap.getById.query).mockRejectedValue(
        new Error('Failed to fetch project')
      )

      const wrapper = createWrapper()
      const { result } = renderHook(() => useProjectInfo('project-123'), { wrapper })

      await waitFor(
        () => {
          expect(result.current.isError).toBe(true)
        },
        { timeout: 4000 }
      )

      expect(result.current.data).toBeUndefined()
      expect(result.current.error).toBeDefined()
    })

    it('should return null when success is false', async () => {
      const { trpcClient } = await import('@/shared/app-shared')
      vi.mocked(trpcClient.mindmap.getById.query).mockResolvedValue({
        success: true,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 测试边缘情况：success 为 true 但数据为 null
        mindmap: null as any
      })

      const wrapper = createWrapper()
      const { result } = renderHook(() => useProjectInfo('project-123'), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.data).toBeNull()
    })
  })

  describe('useProjectTheme', () => {
    it('should return null when no project info', () => {
      const wrapper = createWrapper()
      const { result } = renderHook(() => useProjectTheme(undefined), { wrapper })

      expect(result.current.theme).toBeNull()
    })

    it('should return theme from project info', async () => {
      const { trpcClient } = await import('@/shared/app-shared')
      vi.mocked(trpcClient.mindmap.getById.query).mockResolvedValue({
        success: true,
        mindmap: {
          id: 'project-123',
          theme: 'light',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          title: 'Test',
          description: null,
          tags: [],
          nodeCount: 0,
          createdBy: 'user-123',
          visibility: 'PRIVATE',
          workspaceId: null,
          creator: { id: 'user-123', name: 'Test User', email: null, avatar: null }
        }
      })

      const wrapper = createWrapper()
      const { result } = renderHook(() => useProjectTheme('project-123'), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.theme).toBe('light')
    })

    it('should return null when theme is undefined in project info', async () => {
      const { trpcClient } = await import('@/shared/app-shared')
      vi.mocked(trpcClient.mindmap.getById.query).mockResolvedValue({
        success: true,
        mindmap: {
          id: 'project-123',
          theme: null,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          title: 'Test',
          description: null,
          tags: [],
          nodeCount: 0,
          createdBy: 'user-123',
          visibility: 'PRIVATE',
          workspaceId: null,
          creator: { id: 'user-123', name: 'Test User', email: null, avatar: null }
        }
      })

      const wrapper = createWrapper()
      const { result } = renderHook(() => useProjectTheme('project-123'), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.theme).toBeNull()
    })
  })

  describe('useProjectTitle', () => {
    it('should return empty string when no project info', () => {
      const wrapper = createWrapper()
      const { result } = renderHook(() => useProjectTitle(undefined), { wrapper })

      expect(result.current.title).toBe('')
    })

    it('should return title from project info', async () => {
      const { trpcClient } = await import('@/shared/app-shared')
      vi.mocked(trpcClient.mindmap.getById.query).mockResolvedValue({
        success: true,
        mindmap: {
          id: 'project-123',
          title: 'My Awesome Project',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          theme: 'dark',
          description: null,
          tags: [],
          nodeCount: 0,
          createdBy: 'user-123',
          visibility: 'PRIVATE',
          workspaceId: null,
          creator: { id: 'user-123', name: 'Test User', email: null, avatar: null }
        }
      })

      const wrapper = createWrapper()
      const { result } = renderHook(() => useProjectTitle('project-123'), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.title).toBe('My Awesome Project')
    })

    it('should return empty string when title is empty in project info', async () => {
      const { trpcClient } = await import('@/shared/app-shared')
      vi.mocked(trpcClient.mindmap.getById.query).mockResolvedValue({
        success: true,
        mindmap: {
          id: 'project-123',
          title: '',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          theme: 'dark',
          description: null,
          tags: [],
          nodeCount: 0,
          createdBy: 'user-123',
          visibility: 'PRIVATE',
          workspaceId: null,
          creator: { id: 'user-123', name: 'Test User', email: null, avatar: null }
        }
      })

      const wrapper = createWrapper()
      const { result } = renderHook(() => useProjectTitle('project-123'), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.title).toBe('')
    })
  })
})