// @ts-nocheck — test files not part of runtime build
import { describe, it, expect } from 'vitest'
import { resolveMindMapLoading } from './mindmap-loading'

const base = {
  workspaceId: 'p1',
  cloudMode: true,
  hasMindMap: true,
  loadError: null,
  waitingForCollaboration: false
} as const

describe('resolveMindMapLoading', () => {
  it('无 workspaceId → hide', () => {
    expect(
      resolveMindMapLoading({
        ...base,
        workspaceId: undefined,
        collaboration: null
      }).kind
    ).toBe('hide')
  })

  it('loadError → hide', () => {
    expect(
      resolveMindMapLoading({
        ...base,
        loadError: 'x',
        collaboration: null
      }).kind
    ).toBe('hide')
  })

  it('画布未就绪 → 显示初始化 Loading', () => {
    expect(
      resolveMindMapLoading({
        ...base,
        hasMindMap: false,
        collaboration: null
      })
    ).toEqual({
      kind: 'show',
      tipKey: 'mindmap.canvas.initializingCanvas',
      progress: 30
    })
  })

  it('首次加载 connecting → 显示连接 Loading', () => {
    expect(
      resolveMindMapLoading({
        ...base,
        collaboration: { status: 'connecting', synced: false, initialSyncDone: false }
      })
    ).toEqual({
      kind: 'show',
      tipKey: 'mindmap.canvas.connectingCollaboration',
      progress: 80
    })
  })

  it('首次加载已连接未同步 → 显示同步 Loading', () => {
    expect(
      resolveMindMapLoading({
        ...base,
        collaboration: { status: 'connected', synced: false, initialSyncDone: false }
      })
    ).toEqual({
      kind: 'show',
      tipKey: 'mindmap.canvas.syncingData',
      progress: 85
    })
  })

  it('重连：首同步完成后 connecting → 不显示全局 Loading（complete）', () => {
    expect(
      resolveMindMapLoading({
        ...base,
        collaboration: { status: 'connecting', synced: false, initialSyncDone: true }
      })
    ).toEqual({ kind: 'complete' })
  })

  it('重连：首同步完成后 disconnected → 不显示全局 Loading（complete）', () => {
    expect(
      resolveMindMapLoading({
        ...base,
        collaboration: { status: 'disconnected', synced: false, initialSyncDone: true }
      })
    ).toEqual({ kind: 'complete' })
  })

  it('已连接且已同步 → complete', () => {
    expect(
      resolveMindMapLoading({
        ...base,
        collaboration: { status: 'connected', synced: true, initialSyncDone: true }
      })
    ).toEqual({ kind: 'complete' })
  })

  it('非云端等待协作 → 显示同步 Loading', () => {
    expect(
      resolveMindMapLoading({
        ...base,
        cloudMode: false,
        collaboration: null,
        waitingForCollaboration: true
      })
    ).toEqual({
      kind: 'show',
      tipKey: 'mindmap.canvas.syncingData',
      progress: 85
    })
  })
})