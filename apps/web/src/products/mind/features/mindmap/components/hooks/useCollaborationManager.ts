/**
 * useCollaborationManager - 协作连接管理 Hook
 *
 * 设计：
 *   - 每个项目独立 HocuspocusProvider（workspaceId 变化 → 销毁旧 + 建新）
 *   - peers 只含静态身份（id / name / avatar / color / nodeIds），不含 cursor —
 *     cursor 由 CollaborationCursorLayer 直接订阅 awareness，绕开 React setState，
 *     避免 pointermove 60-90Hz 持续触发整列 peer 重渲
 *   - awareness 本地 state 固定 key='user'，外部稳定 ID 是 awareness.clientID
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Awareness } from 'y-protocols/awareness'
import {
  HocuspocusProvider,
  type onCloseParameters,
  type onDisconnectParameters
} from '@hocuspocus/provider'
import type * as Y from 'yjs'
import { i18next } from '@zoeymind/i18n'
import { getBrowserInstanceId } from '@/products/mind/utils/browser-instance'
import { logger } from '@zoeymind/logger'
import { useToast, buildWsUrl } from '@/shared/app-shared'
import { useMindMapStore } from '@/products/mind/features/mindmap/stores/mindmap-store'
import { useProjectContext } from '@/products/mind/features/mindmap/contexts/ProjectContext'
import { usePermissionStore } from '@/products/mind/features/mindmap/stores/permission-store'
import {
  isWaitingForCollaboration,
  setWaitingForCollaboration
} from '@/products/mind/features/mindmap/types/mindmap-extensions'
import { authClient } from '@/shared/auth'

// 协作插件接口（不依赖 simple-mind-map 内部）
interface CooperatePluginLike {
  getDoc(): Y.Doc
  setUserInfo(info: { id: string; name?: string; avatar?: string; color?: string }): void
  setProvider(provider: HocuspocusProvider, config?: unknown): void
  setSyncReady?(): void
  awarenessSync?: {
    setCursor?: (cursor: { x: number; y: number } | null) => void
    setProjectTitle?: (title: string) => void
    userInfo?: { id?: string }
  }
}

type CollaborationStatus = 'idle' | 'connecting' | 'connected' | 'disconnected'

export interface Collaborator {
  id: string
  name?: string
  avatar?: string
  color?: string
  nodeIds: string[]
  instanceKey: string
}

interface UserAwarenessState {
  userInfo?: {
    id?: string
    name?: string
    avatar?: string
    color?: string
  }
  nodeIdList?: unknown
  cursor?: { x?: unknown; y?: unknown }
  projectTitle?: string
}

export interface CollaborationState {
  cooperate: {
    awarenessSync?: {
      setCursor?: (cursor: { x: number; y: number } | null) => void
      setProjectTitle?: (title: string) => void
      userInfo?: { id?: string }
    }
  } | null
  provider: HocuspocusProvider | null
  status: CollaborationStatus
  synced: boolean
  initialSyncDone: boolean
  peers: Collaborator[]
  projectTitle?: string
}

const LOCAL_STATE_KEY = 'user'

const deriveInstanceColor = (id: string): string => {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i)
    hash |= 0
  }
  const hue = Math.abs(hash) % 360
  return `hsl(${hue}, 70%, 60%)`
}

/**
 * 仅收集身份信息：cursor 字段被刻意忽略，避免高频 awareness 变化触发整列重渲。
 */
const collectPeers = (
  awareness: Awareness | undefined
): { peers: Collaborator[]; projectTitle?: string } => {
  if (!awareness) return { peers: [] }
  const peers: Collaborator[] = []
  let latestProjectTitle: string | undefined

  awareness.getStates().forEach((state, clientId) => {
    if (clientId === awareness.clientID) return
    const userState = (state as Record<string, unknown>)[LOCAL_STATE_KEY] as
      | UserAwarenessState
      | undefined
    const info = userState?.userInfo
    if (!info) return

    if (userState.projectTitle) {
      latestProjectTitle = userState.projectTitle
    }

    peers.push({
      id: info.id ?? String(clientId),
      name: info.name,
      avatar: info.avatar,
      color: info.color,
      nodeIds: Array.isArray(userState.nodeIdList) ? (userState.nodeIdList as string[]) : [],
      instanceKey: `${clientId}-${info.id ?? ''}`
    })
  })
  return { peers, projectTitle: latestProjectTitle }
}

/**
 * 仅 added/removed/userInfo/nodeIdList 变更才返回 true；纯 cursor 变更被忽略。
 */
const hasIdentityChange = (
  awareness: Awareness | undefined,
  changed: { added: number[]; updated: number[]; removed: number[] },
  identityFingerprint: Map<number, string>
): boolean => {
  if (!awareness) return false
  if (changed.added.length > 0 || changed.removed.length > 0) return true

  const states = awareness.getStates()
  for (const clientId of changed.updated) {
    const state = states.get(clientId)
    const userState = state
      ? ((state as Record<string, unknown>)[LOCAL_STATE_KEY] as UserAwarenessState | undefined)
      : undefined
    const info = userState?.userInfo
    const fingerprint = info
      ? `${info.id ?? ''}|${info.name ?? ''}|${info.avatar ?? ''}|${info.color ?? ''}|${
          Array.isArray(userState.nodeIdList) ? userState.nodeIdList.join(',') : ''
        }|${userState.projectTitle ?? ''}`
      : ''
    if (fingerprint !== identityFingerprint.get(clientId)) {
      identityFingerprint.set(clientId, fingerprint)
      return true
    }
  }
  return false
}

export function useCollaborationManager(
  user?: { id?: string; name?: string; avatar?: string; color?: string },
  updateProgress?: (progress: number) => void
) {
  const { workspaceId, cloudMode } = useProjectContext()
  const { mindMap } = useMindMapStore()
  const { canEdit } = usePermissionStore()
  const { data: sessionData } = authClient.useSession()
  const sessionToken = sessionData?.session?.token

  const [state, setState] = useState<CollaborationState | null>(null)
  const providerRef = useRef<HocuspocusProvider | null>(null)
  const awarenessListenerRef = useRef<
    ((payload: { added: number[]; updated: number[]; removed: number[] }) => void) | null
  >(null)
  const identityFingerprintRef = useRef<Map<number, string>>(new Map())
  const { toast } = useToast()
  const toastShownRef = useRef<Set<string>>(new Set())
  const syncedProjectRef = useRef<string | null>(null)

  const localUser = useMemo(() => {
    const browserInstanceId = getBrowserInstanceId()
    const uidBase = user?.id ? `${user.id}-${browserInstanceId}` : browserInstanceId
    return {
      id: uidBase,
      name: user?.name || i18next.t('mindmap.toast.guestName', { id: browserInstanceId.slice(-4) }),
      avatar: user?.avatar,
      color: deriveInstanceColor(uidBase)
    }
  }, [user?.id, user?.name, user?.avatar])

  const localUserKey = useMemo(
    () => `${localUser.id}-${localUser.name}-${localUser.avatar}`,
    [localUser.id, localUser.name, localUser.avatar]
  )

  const showToast = (
    key: string,
    variant: 'default' | 'destructive' | 'warning' | 'success',
    description: string
  ) => {
    if (toastShownRef.current.has(key)) return
    toastShownRef.current.add(key)
    toast({ variant, description })
    setTimeout(() => toastShownRef.current.delete(key), 30000)
  }

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      if (providerRef.current) {
        try {
          providerRef.current.destroy()
        } catch (error) {
          logger.warn('清理协作连接失败', error)
        }
        providerRef.current = null
      }
      toastShownRef.current.clear()
      identityFingerprintRef.current.clear()
    }
  }, [])

  useEffect(() => {
    if (!cloudMode) {
      setState(null)
      return
    }
    if (!mindMap || !workspaceId) {
      setState(null)
      return
    }

    // 项目切换时清理旧连接
    const currentRoomName = providerRef.current?.configuration?.name
    if (providerRef.current && currentRoomName !== workspaceId) {
      logger.info(`项目切换: ${currentRoomName} → ${workspaceId}`)
      try {
        providerRef.current.destroy()
      } catch (error) {
        logger.warn('清理旧连接失败', error)
      }
      providerRef.current = null
      identityFingerprintRef.current.clear()
    }

    if (providerRef.current && currentRoomName === workspaceId) {
      return
    }

    const cooperate = mindMap.cooperate as CooperatePluginLike | undefined
    if (!cooperate) {
      const timeout = setTimeout(() => {
        const c = mindMap.cooperate as CooperatePluginLike | undefined
        if (c) {
          setupCollaboration(c)
        } else {
          logger.warn('协作插件未注册')
          setState(null)
        }
      }, 100)
      return () => clearTimeout(timeout)
    }

    setupCollaboration(cooperate)

    return () => {
      if (mindMap) {
        mindMap.off('collaborationDataReady')
        mindMap.off('collaborationError')
      }
      const awareness = providerRef.current?.awareness
      if (awareness && awarenessListenerRef.current) {
        awareness.off('change', awarenessListenerRef.current)
        awarenessListenerRef.current = null
      }
      if (providerRef.current) {
        try {
          providerRef.current.destroy()
        } catch (error) {
          logger.warn('销毁协作连接失败', error)
        }
        providerRef.current = null
      }
      identityFingerprintRef.current.clear()
    }

    function setupCollaboration(cooperate: CooperatePluginLike) {
      if (providerRef.current) {
        try {
          providerRef.current.destroy()
        } catch (error) {
          logger.warn('清理旧连接失败', error)
        }
        providerRef.current = null
      }

      const doc = cooperate.getDoc()

      // 分享链接的匿名访问：从 /mindmap/shared/<linkId> 路径提取 linkId，
      // 拼成 ws://host/ws?linkId=... 让服务端 onAuthenticate 走 share-link 路径
      const sharedMatch = window.location.pathname.match(/\/mindmap\/shared\/([^/?#]+)/)
      const wsQuery = sharedMatch ? `?linkId=${encodeURIComponent(sharedMatch[1])}` : ''
      // buildWsUrl 自动处理跨域(VITE_API_URL)与同源 fallback
      const wsUrl = buildWsUrl('/ws', wsQuery)

      const handleStatus = (event: { status: CollaborationStatus }) => {
        logger.info(`协作状态: ${event.status}`)
        setState(prev => {
          if (!prev) return prev
          if (prev.status === event.status) return prev
          if (event.status === 'connected') updateProgress?.(82)
          else if (event.status === 'connecting') updateProgress?.(78)
          return { ...prev, status: event.status }
        })
      }

      const handleSynced = (event?: { state?: boolean } | boolean) => {
        const synced = typeof event === 'boolean' ? event : (event?.state ?? true)
        logger.info(`协作同步: ${synced}`)
        if (synced) syncedProjectRef.current = workspaceId ?? null
        setState(prev => {
          if (!prev) return prev
          if (prev.synced === synced) return prev
          return { ...prev, synced, initialSyncDone: prev.initialSyncDone || synced }
        })

        if (synced) {
          cooperate.setSyncReady?.()
          if (mindMap && isWaitingForCollaboration(mindMap)) {
            updateProgress?.(90)
            setTimeout(() => {
              if (mindMap?.render) {
                mindMap.render(() => {
                  updateProgress?.(95)
                  setWaitingForCollaboration(mindMap, false)
                })
              }
            }, 100)
          }
        }
      }

      const handleClose = (data: onCloseParameters) => {
        const { code, reason } = data.event
        logger.info('协作连接关闭', { code, reason })
        setState(prev => (prev ? { ...prev, status: 'disconnected' } : null))
      }
      const handleDisconnect = (data: onDisconnectParameters) => handleClose(data)

      const provider = new HocuspocusProvider({
        url: wsUrl,
        name: workspaceId || 'default',
        document: doc,
        token: sessionToken || undefined,
        onStatus: handleStatus,
        onSynced: handleSynced,
        onClose: handleClose,
        onDisconnect: handleDisconnect,
        onAuthenticationFailed: () => {
          showToast('auth', 'destructive', i18next.t('mindmap.toast.collabAuthFailed'))
        }
      })

      providerRef.current = provider
      cooperate.setUserInfo(localUser)

      const awareness = provider.awareness ?? undefined
      if (awareness) {
        awareness.setLocalStateField(LOCAL_STATE_KEY, {
          userInfo: { ...localUser, canEdit: canEdit ?? true },
          nodeIdList: []
        })
      }

      const updatePeers = (changed: { added: number[]; updated: number[]; removed: number[] }) => {
        if (!hasIdentityChange(awareness, changed, identityFingerprintRef.current)) return
        const { peers, projectTitle } = collectPeers(awareness)
        setState(prev => {
          if (!prev) return prev
          return { ...prev, peers, projectTitle }
        })
      }

      const handleDataReady = () => {
        if (mindMap && isWaitingForCollaboration(mindMap)) {
          setTimeout(() => {
            if (mindMap?.render) {
              mindMap.render(() => setWaitingForCollaboration(mindMap, false))
            }
          }, 50)
        }
      }

      const handleCollaborationError = (...args: unknown[]) => {
        const event = args[0] as { message?: string } | undefined
        logger.error('协作错误:', event)
        showToast(
          'collab-error',
          'destructive',
          event?.message || i18next.t('mindmap.toast.collabSyncError')
        )
      }

      if (awareness) {
        awarenessListenerRef.current = updatePeers
        awareness.on('change', updatePeers)
      }

      if (mindMap) {
        mindMap.on('collaborationDataReady', handleDataReady)
        mindMap.on('collaborationError', handleCollaborationError)
      }

      cooperate.setProvider(provider)

      const { peers: initialPeers, projectTitle } = collectPeers(awareness)
      setState({
        cooperate: {
          awarenessSync: {
            setCursor: cooperate?.awarenessSync?.setCursor?.bind(cooperate.awarenessSync),
            setProjectTitle: cooperate?.awarenessSync?.setProjectTitle?.bind(
              cooperate.awarenessSync
            ),
            userInfo: cooperate?.awarenessSync?.userInfo
          }
        },
        provider,
        status: 'connecting',
        synced: false,
        initialSyncDone: syncedProjectRef.current === workspaceId,
        peers: initialPeers,
        projectTitle
      })
    }
  }, [cloudMode, mindMap, workspaceId, localUserKey, canEdit, sessionToken])

  return state
}
