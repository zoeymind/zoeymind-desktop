export interface DragVelocitySample {
  x: number
  y: number
  time: number
  velocityX: number
  velocityY: number
}

const MIN_SAMPLE_MS = 8
const VELOCITY_SMOOTHING = 0.35
export const MIN_RELEASE_SPEED = 12
export const RELEASE_TIME_CONSTANT_MS = 420

export function updateDragVelocity(
  sample: DragVelocitySample,
  x: number,
  y: number,
  time: number
): DragVelocitySample {
  const elapsed = Math.max(MIN_SAMPLE_MS, time - sample.time)
  const instantX = ((x - sample.x) / elapsed) * 1000
  const instantY = ((y - sample.y) / elapsed) * 1000

  return {
    x,
    y,
    time,
    velocityX: sample.velocityX * (1 - VELOCITY_SMOOTHING) + instantX * VELOCITY_SMOOTHING,
    velocityY: sample.velocityY * (1 - VELOCITY_SMOOTHING) + instantY * VELOCITY_SMOOTHING,
  }
}

export function decayVelocity(velocity: number, elapsedMs: number): number {
  return velocity * Math.exp(-elapsedMs / RELEASE_TIME_CONSTANT_MS)
}

export function getDecayDisplacement(velocity: number, elapsedMs: number): number {
  if (Math.abs(velocity) < MIN_RELEASE_SPEED) return 0
  const nextVelocity = decayVelocity(velocity, elapsedMs)
  return ((velocity + nextVelocity) / 2) * (elapsedMs / 1000)
}

export function isTrackpadWheelStream(delta: number, elapsedMs: number): boolean {
  return elapsedMs < 30 && Math.abs(delta) < 24
}

const WHEEL_VELOCITY_FACTOR = 5.5

export function getWheelVelocityImpulse(delta: number): number {
  if (delta === 0) return 0
  const normalizedDelta = Math.abs(delta) < 40 ? Math.sign(delta) * 40 : delta
  return -normalizedDelta * WHEEL_VELOCITY_FACTOR
}

const ZOOM_VELOCITY_FACTOR = 0.0048

export function getZoomVelocityImpulse(delta: number): number {
  if (delta === 0) return 0
  const normalizedDelta = Math.abs(delta) < 40 ? Math.sign(delta) * 40 : delta
  return -normalizedDelta * ZOOM_VELOCITY_FACTOR
}

export function getAnchoredViewTransform(
  x: number,
  y: number,
  currentScale: number,
  nextScale: number,
  anchorX: number,
  anchorY: number
): { x: number; y: number } {
  const ratio = 1 - nextScale / currentScale
  return {
    x: x + (anchorX - x) * ratio,
    y: y + (anchorY - y) * ratio,
  }
}

export function getCanvasWheelDelta(
  deltaX: number,
  deltaY: number,
  shiftKey: boolean
): { x: number; y: number } {
  if (shiftKey) return { x: deltaX || deltaY, y: 0 }
  return { x: deltaX, y: deltaY }
}

export function getScrollbarPageTarget(
  trackLength: number,
  thumbStartPercent: number,
  thumbSizePercent: number,
  clickOffset: number
): number {
  const thumbStart = (thumbStartPercent / 100) * trackLength
  const thumbSize = (thumbSizePercent / 100) * trackLength
  if (clickOffset >= thumbStart && clickOffset <= thumbStart + thumbSize) return thumbStart

  const direction = clickOffset < thumbStart ? -1 : 1
  const maxStart = Math.max(0, trackLength - thumbSize)
  return Math.max(0, Math.min(maxStart, thumbStart + direction * thumbSize))
}

export function getScrollbarWheelDelta(
  wheelDelta: number,
  trackLength: number,
  thumbSizePercent: number,
  viewportLength: number
): number {
  if (viewportLength <= 0 || trackLength <= 0) return 0
  const thumbLength = (thumbSizePercent / 100) * trackLength
  return wheelDelta * (thumbLength / viewportLength)
}
