export default class Lru {
  max: number
  size: number
  pool: Map<string | number, unknown>
  constructor(max: number)
  add(key: string | number, value: unknown): boolean
  delete(key: string | number): void
  has(key: string | number): boolean
  get(key: string | number): unknown
  clear(): void
}
