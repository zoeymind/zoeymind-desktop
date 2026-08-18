// @ts-nocheck — vendored engine source
export default class Lru {
  declare max: number
  declare size: number
  declare pool: Map<string | number, unknown>

  constructor(max: number) {
    this.max = max || 1000
    this.size = 0
    this.pool = new Map()
  }

  add(key: string | number, value: unknown): boolean {
    const isExist = this.has(key)
    if (!isExist && this.size >= this.max) {
      return false
    }
    this.delete(key)
    this.pool.set(key, value)
    this.size++
    return true
  }

  delete(key: string | number) {
    if (this.pool.has(key)) {
      this.pool.delete(key)
      this.size--
    }
  }

  has(key: string | number): boolean {
    return this.pool.has(key)
  }

  get(key: string | number): unknown {
    if (this.pool.has(key)) {
      return this.pool.get(key)
    }
    return undefined
  }

  clear() {
    this.size = 0
    this.pool = new Map()
  }
}