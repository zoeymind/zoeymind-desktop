// @ts-nocheck — vendored engine source
import type MindMap from '../index'

class AutoMove {
  declare mindMap: MindMap
  declare autoMoveTimer: ReturnType<typeof setTimeout> | null

  constructor(mindMap: MindMap) {
    this.mindMap = mindMap
    this.autoMoveTimer = null
  }

  //  鼠标移动事件
  onMove(
    x: number,
    y: number,
    callback: () => void = () => {},
    handle: (...args: unknown[]) => void = () => {}
  ) {
    callback()
    const step = Number(this.mindMap.opt.selectTranslateStep)
    const limit = Number(this.mindMap.opt.selectTranslateLimit)
    let count = 0
    if (x <= this.mindMap.elRect.left + limit) {
      handle('left', step)
      this.mindMap.view.translateX(step)
      count++
    }
    if (x >= this.mindMap.elRect.right - limit) {
      handle('right', step)
      this.mindMap.view.translateX(-step)
      count++
    }
    if (y <= this.mindMap.elRect.top + limit) {
      handle('top', step)
      this.mindMap.view.translateY(step)
      count++
    }
    if (y >= this.mindMap.elRect.bottom - limit) {
      handle('bottom', step)
      this.mindMap.view.translateY(-step)
      count++
    }
    if (count > 0) {
      this.startAutoMove(x, y, callback, handle)
    }
  }

  startAutoMove(x: number, y: number, callback: () => void, handle: (...args: unknown[]) => void) {
    this.autoMoveTimer = setTimeout(() => {
      this.onMove(x, y, callback, handle)
    }, 20)
  }

  clearAutoMoveTimer() {
    clearTimeout(this.autoMoveTimer)
  }
}

export default AutoMove