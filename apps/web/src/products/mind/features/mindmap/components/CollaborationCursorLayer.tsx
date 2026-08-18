/**
 * CollaborationCursorLayer - 协同光标层
 *
 * 直接订阅 awareness（绕开 useCollaborationManager 的 React setState），
 * 把 cursor 高频变化路由到 MotionValue，零 React 重渲。
 *
 * peer 进 / 出 / userInfo 变 → React state 更新触发 AnimatePresence
 * cursor 移动 → motionX/motionY.set()，由 framer-motion spring 平滑动画驱动
 */
import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { MousePointer2 } from 'lucide-react'
import { motion, motionValue, useSpring, AnimatePresence, type MotionValue } from 'motion/react'
import type { CollaborationState } from './hooks/useCollaborationManager'
import { useMindMapStore } from '@/products/mind/features/mindmap/stores/mindmap-store'
import { useProjectContext } from '@/products/mind/features/mindmap/contexts/ProjectContext'

interface CollaborationCursorLayerProps {
  containerRef: RefObject<HTMLDivElement | null>
  collaboration?: CollaborationState | null
}

interface Matrix {
  a: number
  b: number
  c: number
  d: number
  e: number
  f: number
}

const INITIAL_MATRIX: Matrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }

const CURSOR_VISUAL_OFFSET = { x: -6, y: 2 }
const LOCAL_STATE_KEY = 'user'

interface PeerInfo {
  id: string
  name?: string
  color?: string
}

interface PeerEntry {
  info: PeerInfo
  motionX: MotionValue<number>
  motionY: MotionValue<number>
}

interface PeerCursorState {
  worldX: number
  worldY: number
  info: PeerInfo
}

interface UserAwarenessState {
  userInfo?: { id?: string; name?: string; color?: string }
  cursor?: { x?: unknown; y?: unknown }
}

const projectCursor = (
  worldX: number,
  worldY: number,
  rootOffset: { x: number; y: number },
  matrix: Matrix
): { screenX: number; screenY: number } => {
  const wx = worldX + rootOffset.x
  const wy = worldY + rootOffset.y
  return {
    screenX: wx * matrix.a + wy * matrix.c + matrix.e + CURSOR_VISUAL_OFFSET.x,
    screenY: wx * matrix.b + wy * matrix.d + matrix.f + CURSOR_VISUAL_OFFSET.y
  }
}

export function CollaborationCursorLayer({
  containerRef,
  collaboration
}: CollaborationCursorLayerProps) {
  const { cloudMode } = useProjectContext()
  const { mindMap } = useMindMapStore()

  const provider = collaboration?.provider ?? null
  const awarenessSync = collaboration?.cooperate?.awarenessSync ?? null
  const localUserId = awarenessSync?.userInfo?.id ?? ''

  const matrixRef = useRef<Matrix>(INITIAL_MATRIX)
  const rootOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const peerEntriesRef = useRef<Map<number, PeerEntry>>(new Map())
  const peerCursorsRef = useRef<Map<number, PeerCursorState>>(new Map())

  // 仅 peer 进出 / 名字变 才用 React 触发重建
  const [peerList, setPeerList] = useState<Array<{ clientId: number; entry: PeerEntry }>>([])

  // ── matrix 跟踪：用 ref + 全量 reflow，不触发 React rerender ──
  useEffect(() => {
    if (!mindMap) return

    const reflowAll = () => {
      for (const [cid, cursor] of peerCursorsRef.current) {
        const entry = peerEntriesRef.current.get(cid)
        if (!entry) continue
        const { screenX, screenY } = projectCursor(
          cursor.worldX,
          cursor.worldY,
          rootOffsetRef.current,
          matrixRef.current
        )
        if (Number.isFinite(screenX) && Number.isFinite(screenY)) {
          entry.motionX.set(screenX)
          entry.motionY.set(screenY)
        }
      }
    }

    const updateMatrix = () => {
      const raw = mindMap.draw.matrixify()
      matrixRef.current = {
        a: Number.isFinite(raw.a) ? raw.a : 1,
        b: Number.isFinite(raw.b) ? raw.b : 0,
        c: Number.isFinite(raw.c) ? raw.c : 0,
        d: Number.isFinite(raw.d) ? raw.d : 1,
        e: Number.isFinite(raw.e) ? raw.e : 0,
        f: Number.isFinite(raw.f) ? raw.f : 0
      }
      const root = mindMap.renderer?.root
      if (root) {
        rootOffsetRef.current = {
          x: Number.isFinite(root.left) ? root.left : 0,
          y: Number.isFinite(root.top) ? root.top : 0
        }
      }
      reflowAll()
    }

    updateMatrix()
    mindMap.on('scale', updateMatrix)
    mindMap.on('translate', updateMatrix)
    mindMap.on('view_data_change', updateMatrix)
    mindMap.on('node_tree_render_end', updateMatrix)

    return () => {
      mindMap.off('scale', updateMatrix)
      mindMap.off('translate', updateMatrix)
      mindMap.off('view_data_change', updateMatrix)
      mindMap.off('node_tree_render_end', updateMatrix)
    }
  }, [mindMap])

  // ── 本地鼠标 → awareness setCursor（节流 80ms 而非 33ms） ──
  useEffect(() => {
    if (!cloudMode || !mindMap || !awarenessSync?.setCursor) return
    const container = containerRef.current
    if (!container) return

    const lastSent = { time: 0 }
    const CURSOR_THROTTLE_MS = 80

    const handlePointerMove = (event: PointerEvent) => {
      const now = performance.now()
      if (now - lastSent.time < CURSOR_THROTTLE_MS) return
      lastSent.time = now

      const root = mindMap.renderer?.root
      if (!root || !Number.isFinite(root.left) || !Number.isFinite(root.top)) return

      const point = mindMap.draw.point(event.clientX, event.clientY)
      if (Number.isFinite(point.x) && Number.isFinite(point.y)) {
        awarenessSync.setCursor?.({
          x: point.x - root.left,
          y: point.y - root.top
        })
      }
    }

    const clearCursor = () => awarenessSync.setCursor?.(null)

    container.addEventListener('pointermove', handlePointerMove)
    container.addEventListener('pointerleave', clearCursor)
    container.addEventListener('pointerdown', handlePointerMove)

    return () => {
      container.removeEventListener('pointermove', handlePointerMove)
      container.removeEventListener('pointerleave', clearCursor)
      container.removeEventListener('pointerdown', handlePointerMove)
      awarenessSync.setCursor?.(null)
    }
  }, [cloudMode, mindMap, awarenessSync, containerRef])

  // ── awareness 订阅：cursor 高频走 MotionValue，peer 身份变化才 setState ──
  useEffect(() => {
    if (!provider) return
    const awareness = provider.awareness
    if (!awareness) return

    const localClientId = awareness.clientID

    const ensureEntry = (
      clientId: number,
      info: PeerInfo,
      screenX: number,
      screenY: number
    ): PeerEntry => {
      let entry = peerEntriesRef.current.get(clientId)
      if (!entry) {
        entry = {
          info,
          motionX: motionValue(screenX),
          motionY: motionValue(screenY)
        }
        peerEntriesRef.current.set(clientId, entry)
      } else if (
        entry.info.id !== info.id ||
        entry.info.name !== info.name ||
        entry.info.color !== info.color
      ) {
        entry.info = info
      }
      return entry
    }

    const update = (changed: { added: number[]; updated: number[]; removed: number[] }) => {
      let listDirty = false

      // removed
      for (const cid of changed.removed) {
        if (peerEntriesRef.current.delete(cid)) listDirty = true
        peerCursorsRef.current.delete(cid)
      }

      const states = awareness.getStates()
      const touched = changed.added.concat(changed.updated)

      for (const cid of touched) {
        if (cid === localClientId) continue
        const state = states.get(cid)
        const userState = state
          ? ((state as Record<string, unknown>)[LOCAL_STATE_KEY] as UserAwarenessState | undefined)
          : undefined
        const info = userState?.userInfo
        const peerId = info?.id ?? ''
        if (peerId && peerId === localUserId) {
          // 同账号其他 tab 不显示自己的 cursor
          if (peerEntriesRef.current.delete(cid)) listDirty = true
          peerCursorsRef.current.delete(cid)
          continue
        }

        const rawCursor = userState?.cursor
        const hasCursor =
          rawCursor && typeof rawCursor.x === 'number' && typeof rawCursor.y === 'number' && info
        if (!hasCursor || !info) {
          if (peerEntriesRef.current.delete(cid)) listDirty = true
          peerCursorsRef.current.delete(cid)
          continue
        }

        const worldX = rawCursor.x as number
        const worldY = rawCursor.y as number
        const { screenX, screenY } = projectCursor(
          worldX,
          worldY,
          rootOffsetRef.current,
          matrixRef.current
        )

        const peerInfo: PeerInfo = { id: peerId, name: info.name, color: info.color }
        const existed = peerEntriesRef.current.has(cid)
        const entry = ensureEntry(cid, peerInfo, screenX, screenY)
        if (!existed) listDirty = true

        peerCursorsRef.current.set(cid, { worldX, worldY, info: peerInfo })

        if (Number.isFinite(screenX) && Number.isFinite(screenY)) {
          entry.motionX.set(screenX)
          entry.motionY.set(screenY)
        }
      }

      if (listDirty) {
        const next = Array.from(peerEntriesRef.current.entries()).map(([clientId, entry]) => ({
          clientId,
          entry
        }))
        setPeerList(next)
      }
    }

    // 初始
    update({
      added: Array.from(awareness.getStates().keys()),
      updated: [],
      removed: []
    })

    awareness.on('change', update)
    return () => {
      awareness.off('change', update)
      peerEntriesRef.current.clear()
      peerCursorsRef.current.clear()
      setPeerList([])
    }
  }, [provider, localUserId])

  if (!cloudMode || !mindMap || peerList.length === 0) return null

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <AnimatePresence>
        {peerList.map(({ clientId, entry }) => (
          <PeerCursor key={`${clientId}-${entry.info.id}`} entry={entry} />
        ))}
      </AnimatePresence>
    </div>
  )
}

function PeerCursor({ entry }: { entry: PeerEntry }) {
  const springX = useSpring(entry.motionX, { stiffness: 500, damping: 50, bounce: 0 })
  const springY = useSpring(entry.motionY, { stiffness: 500, damping: 50, bounce: 0 })

  return (
    <motion.div
      className="absolute flex flex-col items-center"
      style={{ x: springX, y: springY }}
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0 }}
    >
      <MousePointer2
        size={16}
        color="hsla(var(--foreground) / 0.35)"
        fill={entry.info.color || 'hsl(var(--cursor-default))'}
        strokeWidth={1.5}
        style={{ transform: 'translate(-7px, -7px)' }}
      />
      <span
        className="mt-0.5 px-1 py-0.5 text-[10px] font-medium leading-none shadow-sm rounded"
        style={{
          backgroundColor: entry.info.color || 'hsl(var(--cursor-bg))',
          color: 'hsl(var(--cursor-text))'
        }}
      >
        {entry.info.name || entry.info.id}
      </span>
    </motion.div>
  )
}
