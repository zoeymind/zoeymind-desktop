import { useSyncExternalStore } from 'react'
import {
  AnimatedToastStack,
  type AnimatedToast,
  type ToastInput,
  type ToastPosition,
  type ToastStatus
} from './motion/animated-toast-stack'

export type ToastVariant = 'default' | 'destructive' | 'warning' | 'success' | 'info'

export interface ToastAction {
  label: string
  onClick: () => void
}

export interface ToastOptions {
  id?: string
  variant?: ToastVariant
  description?: string
  title?: string
  duration?: number
  action?: ToastAction
}

const DEFAULT_TOAST_DURATION_MS = 4200
const LOADING_TOAST_DURATION_MS = 0
const MAX_STORED_TOASTS = 8
const emptyToastSnapshot: AnimatedToast[] = []

let toastIdSeed = 0
let toastSnapshot: AnimatedToast[] = emptyToastSnapshot

const toastSubscribers = new Set<() => void>()
const toastTimers = new Map<string, ReturnType<typeof setTimeout>>()

function createToastId() {
  toastIdSeed += 1
  return `toast-${Date.now()}-${toastIdSeed}`
}

function notifyToastSubscribers() {
  toastSubscribers.forEach(subscriber => subscriber())
}

function subscribeToToastStore(subscriber: () => void) {
  toastSubscribers.add(subscriber)

  return () => {
    toastSubscribers.delete(subscriber)
  }
}

function getToastSnapshot() {
  return toastSnapshot
}

function getServerToastSnapshot() {
  return emptyToastSnapshot
}

function convertVariantToStatus(variant: ToastVariant): ToastStatus {
  switch (variant) {
    case 'destructive':
      return 'error'
    case 'success':
      return 'success'
    case 'warning':
      return 'warning'
    case 'info':
      return 'info'
    default:
      return 'neutral'
  }
}

function scheduleToastDismiss(toastToSchedule: AnimatedToast) {
  const existingTimer = toastTimers.get(toastToSchedule.id)

  if (existingTimer) {
    clearTimeout(existingTimer)
    toastTimers.delete(toastToSchedule.id)
  }

  const duration = toastToSchedule.duration ?? DEFAULT_TOAST_DURATION_MS

  if (duration <= 0) {
    return
  }

  const createdAt = toastToSchedule.createdAt ?? Date.now()
  const elapsedMs = Date.now() - createdAt
  const remainingMs = Math.max(duration - elapsedMs, 0)

  const timer = setTimeout(() => {
    dismissToast(toastToSchedule.id)
  }, remainingMs)

  toastTimers.set(toastToSchedule.id, timer)
}

function createToastInput(options: ToastOptions | string): ToastInput {
  if (typeof options === 'string') {
    return {
      description: options,
      status: 'neutral'
    }
  }

  const { id, variant = 'default', description, title, duration, action } = options

  return {
    id,
    title,
    description,
    status: convertVariantToStatus(variant),
    duration,
    action: action
      ? {
          label: action.label,
          onClick: () => action.onClick()
        }
      : undefined
  }
}

function upsertToast(input: ToastInput) {
  const id = input.id ?? createToastId()
  const createdAt = Date.now()
  const existingToast = toastSnapshot.find(toastItem => toastItem.id === id)
  const nextToast: AnimatedToast = {
    duration: DEFAULT_TOAST_DURATION_MS,
    dismissible: true,
    ...existingToast,
    ...input,
    id,
    createdAt
  }

  const nextSnapshot = existingToast
    ? toastSnapshot.map(toastItem => (toastItem.id === id ? nextToast : toastItem))
    : [...toastSnapshot, nextToast]

  toastSnapshot = nextSnapshot.slice(-MAX_STORED_TOASTS)
  scheduleToastDismiss(nextToast)
  notifyToastSubscribers()

  return id
}

export function toast(options: ToastOptions | string) {
  return upsertToast(createToastInput(options))
}

export function toastLoading(message: string, id: string) {
  return upsertToast({
    id,
    description: message,
    status: 'loading',
    duration: LOADING_TOAST_DURATION_MS,
    dismissible: true
  })
}

export function dismissToast(id?: string | number) {
  if (id === undefined) {
    toastTimers.forEach(timer => clearTimeout(timer))
    toastTimers.clear()
    toastSnapshot = emptyToastSnapshot
    notifyToastSubscribers()
    return
  }

  const toastId = String(id)
  const existingTimer = toastTimers.get(toastId)

  if (existingTimer) {
    clearTimeout(existingTimer)
    toastTimers.delete(toastId)
  }

  toastSnapshot = toastSnapshot.filter(toastItem => toastItem.id !== toastId)
  notifyToastSubscribers()
}

export interface ToasterProps {
  position?: ToastPosition
}

export function Toaster({ position = 'bottom-right' }: ToasterProps) {
  const toasts = useSyncExternalStore(
    subscribeToToastStore,
    getToastSnapshot,
    getServerToastSnapshot
  )

  return (
    <AnimatedToastStack
      fixed
      toasts={toasts}
      position={position}
      onDismiss={dismissToast}
      maxVisible={4}
      classNames={{
        root: 'z-[100] sm:max-w-md',
        surface:
          'border-border/70 bg-card/95 text-card-foreground shadow-2xl shadow-foreground/10 ring-1 ring-border/40',
        iconWrap: 'shadow-sm',
        content: 'min-w-0',
        title: 'text-card-foreground',
        description: 'text-muted-foreground',
        action: 'bg-primary text-primary-foreground hover:bg-primary/90',
        close: 'hover:bg-muted hover:text-foreground',
        progress: 'bg-primary/40'
      }}
    />
  )
}
