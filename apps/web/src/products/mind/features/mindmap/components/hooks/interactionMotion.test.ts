import { describe, expect, it } from "vitest"
import {
  getAnchoredViewTransform,
  decayVelocity,
  getCanvasWheelDelta,
  getDecayDisplacement,
  getWheelVelocityImpulse,
  getZoomVelocityImpulse,
  getScrollbarPageTarget,
  getScrollbarWheelDelta,
  isTrackpadWheelStream,
  updateDragVelocity,
} from "./interactionMotion"

describe("interaction motion", () => {
  it("converts a fast drag into continuous decaying travel", () => {
    const sample = updateDragVelocity(
      { x: 0, y: 0, time: 0, velocityX: 0, velocityY: 0 },
      24,
      -12,
      16
    )

    expect(sample.velocityX).toBeGreaterThan(500)
    const firstFrame = getDecayDisplacement(sample.velocityX, 16)
    const nextVelocity = decayVelocity(sample.velocityX, 16)
    const secondFrame = getDecayDisplacement(nextVelocity, 16)
    expect(firstFrame).toBeGreaterThan(0)
    expect(secondFrame).toBeGreaterThan(0)
    expect(secondFrame).toBeLessThan(firstFrame)
  })

  it("does not drift below the release threshold", () => {
    expect(getDecayDisplacement(11, 16)).toBe(0)
    expect(getDecayDisplacement(-11, 16)).toBe(0)
  })

  it("only classifies high-frequency fine wheel events as a trackpad stream", () => {
    expect(isTrackpadWheelStream(12, 12)).toBe(true)
    expect(isTrackpadWheelStream(48, 12)).toBe(false)
    expect(isTrackpadWheelStream(12, 60)).toBe(false)
  })

  it("moves track clicks by one viewport without jumping to the edge", () => {
    expect(getScrollbarPageTarget(200, 20, 25, 190)).toBe(90)
    expect(getScrollbarPageTarget(200, 60, 25, 0)).toBe(70)
    expect(getScrollbarPageTarget(200, 20, 25, 60)).toBe(40)
  })

  it("maps normal wheel vertically and Shift wheel horizontally", () => {
    expect(getCanvasWheelDelta(0, 100, false)).toEqual({ x: 0, y: 100 })
    expect(getCanvasWheelDelta(0, 100, true)).toEqual({ x: 100, y: 0 })
    expect(getCanvasWheelDelta(12, 30, false)).toEqual({ x: 12, y: 30 })
  })

  it("maps viewport wheel travel into proportional thumb travel", () => {
    expect(getScrollbarWheelDelta(100, 200, 25, 800)).toBe(6.25)
    expect(getScrollbarWheelDelta(-100, 200, 25, 800)).toBe(-6.25)
    expect(getScrollbarWheelDelta(100, 0, 25, 800)).toBe(0)
  })

  it("keeps release displacement in the velocity direction", () => {
    let positiveVelocity = 600
    let positiveOffset = 80
    let previousPositive = positiveOffset
    let negativeVelocity = -600
    let negativeOffset = 80
    let previousNegative = negativeOffset

    for (let frame = 0; frame < 20; frame += 1) {
      positiveOffset += getDecayDisplacement(positiveVelocity, 16)
      positiveVelocity = decayVelocity(positiveVelocity, 16)
      expect(positiveOffset).toBeGreaterThan(previousPositive)
      previousPositive = positiveOffset

      negativeOffset += getDecayDisplacement(negativeVelocity, 16)
      negativeVelocity = decayVelocity(negativeVelocity, 16)
      expect(negativeOffset).toBeLessThan(previousNegative)
      previousNegative = negativeOffset
    }
  })

  it("turns wheel input into same-direction velocity impulses", () => {
    expect(getWheelVelocityImpulse(100)).toBeLessThan(0)
    expect(getWheelVelocityImpulse(-100)).toBeGreaterThan(0)
    expect(Math.abs(getWheelVelocityImpulse(4))).toBe(Math.abs(getWheelVelocityImpulse(40)))

    const first = getWheelVelocityImpulse(100)
    const accumulated = first * 0.45 + getWheelVelocityImpulse(100)
    expect(Math.abs(accumulated)).toBeGreaterThan(Math.abs(first))
  })

  it("keeps the zoom anchor on the same content point", () => {
    const x = 120
    const y = 80
    const scale = 1
    const anchorX = 500
    const anchorY = 300
    const contentX = (anchorX - x) / scale
    const contentY = (anchorY - y) / scale
    const nextScale = 1.5
    const next = getAnchoredViewTransform(x, y, scale, nextScale, anchorX, anchorY)

    expect(next.x + contentX * nextScale).toBeCloseTo(anchorX)
    expect(next.y + contentY * nextScale).toBeCloseTo(anchorY)
  })

  it("turns wheel zoom into bounded-direction velocity impulses", () => {
    expect(getZoomVelocityImpulse(100)).toBeLessThan(0)
    expect(getZoomVelocityImpulse(-100)).toBeGreaterThan(0)
    expect(Math.abs(getZoomVelocityImpulse(4))).toBe(Math.abs(getZoomVelocityImpulse(40)))
  })
})
