/**
 * SessionIdMapper - 会话级 UUID ↔ 短 ID 映射
 *
 * AI 侧始终使用短 ID，思维导图核心始终使用 UUID。
 * 本类在两端之间做双向转换，仅在 AI 工具调用链路中使用。
 *
 * 短 ID 格式：任意非空字符串（AI 自由指定，或系统自动分配 n1, n2...）
 *
 * ## 同轮引用支持
 * AI 可以在同一轮工具调用中引用刚预分配的 ID：
 * - Tool 1: add_module({ modules: [{ id: "登录模块" }] }) → reserve("登录模块")
 * - Tool 2: add_module({ parentModuleId: "登录模块" }) → resolveReserved 返回占位符
 * - Tool 1 执行完毕 → bind("登录模块", UUID)
 * - Tool 2 执行时，占位符被替换为真实 UUID
 */

// 任意非空字符串
const SHORT_ID_RE = /^.+$/

export interface MapperState {
  shortToUuid: Record<string, string>
  uuidToShort: Record<string, string>
  counter: number
  reserved: string[]
}

/** 占位符：表示已 reserve 但尚未 bind 的 ID */
export const RESERVED_PLACEHOLDER_PREFIX = '__reserved__:'

export class SessionIdMapper {
  private shortToUuid = new Map<string, string>()
  private uuidToShort = new Map<string, string>()
  private counter = 0
  /** 已 reserve 但尚未 bind 的短 ID */
  private reservedIds = new Set<string>()

  /**
   * UUID → 短 ID（已有映射直接返回，否则自动分配 n1, n2...）
   */
  shorten(uuid: string): string {
    if (!uuid) return uuid

    const existing = this.uuidToShort.get(uuid)
    if (existing) return existing

    // 自动分配 n1, n2, n3...
    let shortId = `n${++this.counter}`
    while (this.shortToUuid.has(shortId) || this.reservedIds.has(shortId)) {
      shortId = `n${++this.counter}`
    }

    this.shortToUuid.set(shortId, uuid)
    this.uuidToShort.set(uuid, shortId)
    return shortId
  }

  /**
   * 短 ID → UUID。非短 ID 格式原样返回（兼容 UUID 直接传入）
   *
   * 对于已 reserve 但未 bind 的 ID，返回占位符而非抛错（支持同轮引用）
   */
  resolve(shortId: string): string {
    if (!shortId) return shortId
    if (!SHORT_ID_RE.test(shortId)) return shortId

    const uuid = this.shortToUuid.get(shortId)
    if (uuid) return uuid

    // 同轮引用：返回占位符，后续由 bindReservedIds 替换
    if (this.reservedIds.has(shortId)) {
      return `${RESERVED_PLACEHOLDER_PREFIX}${shortId}`
    }

    throw new Error(`未知的短 ID: ${shortId}`)
  }

  /**
   * 尝试 resolve，对于 reserved ID 也返回占位符（不抛异常）
   */
  resolveReserved(shortId: string): string {
    if (!shortId) return shortId
    if (!SHORT_ID_RE.test(shortId)) return shortId

    const uuid = this.shortToUuid.get(shortId)
    if (uuid) return uuid

    if (this.reservedIds.has(shortId)) {
      return `${RESERVED_PLACEHOLDER_PREFIX}${shortId}`
    }

    return shortId
  }

  /**
   * 检查是否为占位符
   */
  static isPlaceholder(value: string): boolean {
    return value.startsWith(RESERVED_PLACEHOLDER_PREFIX)
  }

  /**
   * 从占位符提取短 ID
   */
  static extractFromPlaceholder(value: string): string | null {
    if (!value.startsWith(RESERVED_PLACEHOLDER_PREFIX)) return null
    return value.slice(RESERVED_PLACEHOLDER_PREFIX.length)
  }

  /**
   * 将已 reserve 的短 ID 绑定到实际 UUID
   *
   * 如果 UUID 已有自动分配的短 ID，会替换为预分配的 ID
   */
  bind(shortId: string, uuid: string): void {
    // 检查 UUID 是否已有自动分配的短 ID，如果有则替换
    const existingShortId = this.uuidToShort.get(uuid)
    if (existingShortId && existingShortId !== shortId) {
      // 移除旧的自动分配映射
      this.shortToUuid.delete(existingShortId)
    }

    this.reservedIds.delete(shortId)
    this.shortToUuid.set(shortId, uuid)
    this.uuidToShort.set(uuid, shortId)
  }

  /**
   * 检查短 ID 是否已绑定
   */
  hasBind(shortId: string): boolean {
    return this.shortToUuid.has(shortId)
  }

  /**
   * AI 预分配短 ID（标记为已占用，尚无 UUID）
   *
   * ID 格式：任意非空字符串
   *
   * 如果 ID 已存在，自动添加后缀 `_2`, `_3` 等，返回实际分配的 ID
   *
   * @returns 实际分配的短 ID（可能与请求的不同）
   */
  reserve(shortId: string): string {
    // 验证非空
    if (!shortId || !shortId.trim()) {
      throw new Error('ID 不能为空')
    }

    // 如果 ID 可用，直接使用
    if (!this.shortToUuid.has(shortId) && !this.reservedIds.has(shortId)) {
      this.reservedIds.add(shortId)
      return shortId
    }

    // ID 已存在，自动添加后缀
    let suffix = 2
    let newId = `${shortId}_${suffix}`
    while (this.shortToUuid.has(newId) || this.reservedIds.has(newId)) {
      suffix++
      newId = `${shortId}_${suffix}`
      // 防止无限循环
      if (suffix > 999) {
        throw new Error(`无法分配 ID "${shortId}"，已尝试 999 个后缀`)
      }
    }

    this.reservedIds.add(newId)
    return newId
  }

  /**
   * 释放已 reserve 的短 ID（创建失败时）
   */
  unreserve(shortId: string): void {
    this.reservedIds.delete(shortId)
  }

  /**
   * 检查一个字符串是否为短 ID 格式
   */
  static isShortId(id: string): boolean {
    return SHORT_ID_RE.test(id)
  }

  /**
   * 检查短 ID 是否存在有效映射（已 bind 且节点仍存在）
   *
   * @param shortId 短 ID
   * @param validateFn 可选的验证函数，检查 UUID 对应的节点是否存在
   * @returns UUID 如果存在，null 如果不存在或已过期
   */
  resolveWithValidation(shortId: string, validateFn?: (uuid: string) => boolean): string | null {
    if (!shortId || !SHORT_ID_RE.test(shortId)) return shortId || null

    const uuid = this.shortToUuid.get(shortId)
    if (!uuid) {
      // 检查是否是 reserved 但未 bind
      if (this.reservedIds.has(shortId)) {
        return null // 预分配但未创建完成
      }
      return null // 不存在
    }

    // 如果提供了验证函数，检查节点是否仍然存在
    if (validateFn && !validateFn(uuid)) {
      // 节点已被删除，清理过期映射
      this.shortToUuid.delete(shortId)
      this.uuidToShort.delete(uuid)
      return null
    }

    return uuid
  }

  /**
   * 清理过期的映射（节点已被删除）
   *
   * @param existingUuids 当前存在的 UUID 集合
   */
  cleanupStaleMappings(existingUuids: Set<string>): number {
    let cleaned = 0
    for (const [shortId, uuid] of this.shortToUuid.entries()) {
      if (!existingUuids.has(uuid)) {
        this.shortToUuid.delete(shortId)
        this.uuidToShort.delete(uuid)
        cleaned++
      }
    }
    return cleaned
  }

  /**
   * 尝试 resolve，失败则原样返回（安全版本，不抛异常）
   */
  tryResolve(shortId: string): string {
    if (!shortId || !SHORT_ID_RE.test(shortId)) return shortId
    return this.shortToUuid.get(shortId) ?? shortId
  }

  /**
   * 清空映射并重置计数器（[FULL] 上下文时调用）
   */
  reset(): void {
    this.shortToUuid.clear()
    this.uuidToShort.clear()
    this.reservedIds.clear()
    this.counter = 0
  }

  /**
   * 序列化为可持久化的对象
   */
  serialize(): MapperState {
    return {
      shortToUuid: Object.fromEntries(this.shortToUuid),
      uuidToShort: Object.fromEntries(this.uuidToShort),
      counter: this.counter,
      reserved: [...this.reservedIds]
    }
  }

  /**
   * 从持久化数据恢复
   */
  restore(data: MapperState): void {
    this.reset()
    if (data.shortToUuid) {
      for (const [k, v] of Object.entries(data.shortToUuid)) {
        this.shortToUuid.set(k, v)
      }
    }
    if (data.uuidToShort) {
      for (const [k, v] of Object.entries(data.uuidToShort)) {
        this.uuidToShort.set(k, v)
      }
    }
    this.counter = data.counter ?? 0
    if (Array.isArray(data.reserved)) {
      for (const id of data.reserved) {
        this.reservedIds.add(id)
      }
    }
  }

  getStats() {
    return {
      mappingCount: this.shortToUuid.size,
      counter: this.counter,
      reservedCount: this.reservedIds.size
    }
  }
}
