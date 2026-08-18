// @ts-nocheck — vendored engine source
import { nextTick } from '.'

class BatchExecution {
  declare has: Record<string, boolean>
  declare queue: Array<{ name: string; fn: () => void }>
  declare nextTick: () => void

  constructor() {
    this.has = {}
    this.queue = []
    this.nextTick = nextTick(this.flush, this)
  }

  push(name: string, fn: () => void) {
    if (this.has[name]) {
      this.replaceTask(name, fn)
      return
    }
    this.has[name] = true
    this.queue.push({ name, fn })
    this.nextTick()
  }

  replaceTask(name: string, fn: () => void) {
    const index = this.queue.findIndex(item => item.name === name)
    if (index !== -1) {
      this.queue[index] = { name, fn }
    }
  }

  flush() {
    const fns = this.queue.slice(0)
    this.queue = []
    fns.forEach(({ name, fn }) => {
      this.has[name] = false
      fn()
    })
  }
}

export default BatchExecution