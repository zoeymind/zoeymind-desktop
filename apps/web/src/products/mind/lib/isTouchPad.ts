/**
 * 自定义触控板检测函数
 * 通过分析WheelEvent的属性组合来更准确地判断事件是否来自触控板
 */
export const customCheckIsTouchPad = (e: WheelEvent) => {
  // 触控板通常会同时触发X和Y方向的变化
  const hasBothAxis = Math.abs(e.deltaX) > 0 && Math.abs(e.deltaY) > 0

  // 触控板的deltaFactor通常较小
  const isSmallDelta = Math.abs(e.deltaY) < 10 && e.deltaMode === 0

  // 某些Mac触控板会设置这个属性
  const hasWebkitForce = 'webkitForce' in e || 'force' in e

  return hasBothAxis || (isSmallDelta && !e.ctrlKey) || hasWebkitForce
}
