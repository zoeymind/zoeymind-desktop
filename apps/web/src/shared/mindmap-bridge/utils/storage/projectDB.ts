/**
 * 项目管理数据库服务
 *
 * 负责项目的创建、查询、更新和删除操作
 * 与 chatDB 和 mindmapDB 集成，提供完整的项目管理功能
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb'

import { logger } from '@zoeymind/logger'

// 项目数据库接口定义
export interface ProjectDB extends DBSchema {
  projects: {
    key: string
    value: {
      id: string
      name: string
      description?: string
      icon?: string
      createdAt: Date
      updatedAt: Date
      isArchived: boolean
      tags?: string[]
      metadata?: Record<string, unknown>
      owner: string
      collaborators?: string[]
      stats?: ProjectStats
      statsCachedTime?: Date
    }
    indexes: {
      'by-updated': Date // 按最后更新时间索引
      'by-name': string // 按名称索引
      'by-owner': string // 按所有者索引
    }
  }
  // 添加快照存储
  snapshots: {
    key: string
    value: {
      id: string
      projectId: string
      name: string
      description?: string
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 思维导图数据结构复杂，包含节点树和各种配置
      data: any // 思维导图数据
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 视图数据包含缩放、平移等动态属性
      viewData?: any // 视图数据
      createdAt: Date
      isAuto: boolean // 是否为自动快照
      version: number // 快照版本号
    }
    indexes: {
      'by-project': string
      'by-created': Date
      'by-project-created': [string, Date]
    }
  }
}

// 项目接口定义
export interface Project {
  id: string
  name: string
  description?: string
  icon?: string
  createdAt: Date
  updatedAt: Date
  isArchived: boolean
  tags?: string[]
  metadata?: Record<string, unknown>
  owner: string
  collaborators?: string[]
  nodeCount?: number // 节点数量（云项目从数据库获取，本地项目从metadata获取）
}

// 项目统计信息接口
export interface ProjectStats {
  conversationCount: number
  messageCount: number
  lastActive?: Date
}

// 项目与统计合并接口
export interface ProjectWithStats extends Project {
  stats: ProjectStats
}

let dbPromise: Promise<IDBPDatabase<ProjectDB>> | null = null
// 添加一个初始化标志，避免重复输出日志
let isInitializing = false

// 初始化数据库
const getDB = async () => {
  if (!dbPromise) {
    // 如果已经在初始化中，则等待完成
    if (isInitializing) {
      while (isInitializing) {
        await new Promise(resolve => setTimeout(resolve, 50))
      }
      // 确保dbPromise已经被初始化
      if (dbPromise) {
        return dbPromise
      }
      // 如果dbPromise仍为null，则继续初始化过程
    }

    // 设置初始化标志
    isInitializing = true

    dbPromise = openDB<ProjectDB>('project-db', 2, {
      upgrade(db, oldVersion, newVersion, transaction) {
        // 只在第一次真正的初始化时输出日志
        logger.info(`升级项目数据库，旧版本: ${oldVersion}, 新版本: ${newVersion}`)

        // 创建项目存储
        if (!db.objectStoreNames.contains('projects')) {
          logger.info('创建projects存储')
          const projectsStore = db.createObjectStore('projects', { keyPath: 'id' })
          projectsStore.createIndex('by-updated', 'updatedAt')
          projectsStore.createIndex('by-name', 'name')
          projectsStore.createIndex('by-owner', 'owner')
        }

        // 创建快照存储
        if (!db.objectStoreNames.contains('snapshots')) {
          logger.info('创建snapshots存储')
          const snapshotsStore = db.createObjectStore('snapshots', { keyPath: 'id' })
          snapshotsStore.createIndex('by-project', 'projectId')
          snapshotsStore.createIndex('by-created', 'createdAt')
          snapshotsStore.createIndex('by-project-created', ['projectId', 'createdAt'])
        }

        // 添加数据验证和错误处理
        transaction.oncomplete = event => {
          logger.info('项目数据库升级完成', event)
        }

        transaction.onerror = event => {
          logger.error('项目数据库升级出错', event)
        }
      }
    }).finally(() => {
      // 清除初始化标志
      isInitializing = false
    })
  }

  // 确保数据库初始化成功
  try {
    const db = await dbPromise
    // 验证对象存储是否存在
    const storeNames = Array.from(db.objectStoreNames)
    // 不再输出日志，减少控制台污染

    const hasRequiredStores = storeNames.includes('projects')

    if (!hasRequiredStores) {
      logger.error('项目数据库缺少必要的对象存储，尝试清除数据库重新创建')
      // 关闭当前连接
      db.close()
      // 清除 dbPromise
      dbPromise = null
      // 删除数据库
      await deleteProjectDB('project-db')
      // 重新调用自身重新创建数据库
      return getDB()
    }

    return db
  } catch (error) {
    logger.error('项目数据库初始化失败:', error)
    // 清除 dbPromise 以便下次尝试重新创建
    dbPromise = null
    // 清除初始化标志
    isInitializing = false
    throw error
  }
}

// 添加 deleteProjectDB 工具函数
const deleteProjectDB = async (name: string): Promise<void> => {
  logger.info(`删除项目数据库: ${name}`)
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name)
    request.onsuccess = () => {
      logger.info(`项目数据库 ${name} 删除成功`)
      resolve()
    }
    request.onerror = event => {
      logger.error(`项目数据库 ${name} 删除失败:`, event)
      reject(new Error('删除项目数据库失败'))
    }
  })
}

// 生成项目ID
const createProjectId = (): string => {
  return `project-${Date.now()}-${Math.floor(Math.random() * 10000)}`
}

// 获取默认所有者ID (可以从用户系统中获取)
const getDefaultOwner = (): string => {
  return 'default-user'
}

// 导出项目数据库接口
export const projectDB = {
  // 获取所有项目
  async getProjects(includeArchived: boolean = false): Promise<Project[]> {
    try {
      const db = await getDB()
      // 直接获取所有项目，避免索引过滤损坏数据
      const projects = await db.getAll('projects')

      // 检测并修复损坏的项目数据
      const repairedProjects = []
      for (const project of projects) {
        if (!project?.id) continue // 跳过无效项目

        // 检测项目是否损坏
        const isDamaged =
          !project.name ||
          typeof project.isArchived !== 'boolean' ||
          !project.createdAt ||
          !project.updatedAt ||
          !project.owner

        if (isDamaged) {
          // 直接替换整个JSON对象
          const fixedProject = {
            ...project, // 先保留原有字段
            // 然后修复关键字段
            id: project.id,
            name: project.name || `项目-${project.id.slice(-8)}`,
            createdAt: project.createdAt || new Date(),
            updatedAt: project.updatedAt || new Date(),
            isArchived: typeof project.isArchived === 'boolean' ? project.isArchived : false,
            owner: project.owner || getDefaultOwner()
          }

          logger.info('🔧 修复损坏项目:', project.id, fixedProject)

          // 异步持久化修复
          setTimeout(async () => {
            try {
              const writeDB = await getDB()
              await writeDB.put('projects', fixedProject)
              logger.info('💾 项目修复成功:', project.id)
            } catch (error) {
              logger.error('❌ 项目修复失败:', project.id, error)
            }
          }, 0)

          repairedProjects.push(fixedProject)
        } else {
          repairedProjects.push(project)
        }
      }

      // 按更新时间排序
      repairedProjects.sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      )

      // 过滤归档的项目，现在可以安全地访问isArchived属性
      return includeArchived
        ? repairedProjects
        : repairedProjects.filter(project => !project.isArchived)
    } catch (error) {
      logger.error('获取项目列表失败:', error)
      return []
    }
  },

  // 获取项目详情
  async getProject(projectId: string): Promise<Project | null> {
    try {
      const db = await getDB()
      const project = await db.get('projects', projectId)

      if (!project) return null

      // 检测项目是否损坏，损坏则直接替换
      const isDamaged =
        !project.name ||
        typeof project.isArchived !== 'boolean' ||
        !project.createdAt ||
        !project.updatedAt ||
        !project.owner

      if (isDamaged) {
        const fixedProject = {
          ...project, // 先保留原有字段
          // 然后修复关键字段
          id: project.id,
          name: project.name || `项目-${project.id.slice(-8)}`,
          createdAt: project.createdAt || new Date(),
          updatedAt: project.updatedAt || new Date(),
          isArchived: typeof project.isArchived === 'boolean' ? project.isArchived : false,
          owner: project.owner || getDefaultOwner()
        }

        logger.info('🔧 修复单个项目:', project.id)

        // 同步持久化修复
        await db.put('projects', fixedProject)
        return fixedProject
      }

      return project
    } catch (error) {
      logger.error('获取项目详情失败:', error)
      return null
    }
  },

  // 创建新项目
  async createProject(name: string, options: Partial<Project> = {}): Promise<string> {
    try {
      const db = await getDB()
      const id = createProjectId()
      const timestamp = new Date()

      const project: Project = {
        id,
        name,
        createdAt: timestamp,
        updatedAt: timestamp,
        isArchived: false, // 明确设置为false，而不是undefined
        owner: getDefaultOwner(),
        ...options
      }

      // 验证数据完整性
      if (!project.id || !project.name || typeof project.isArchived !== 'boolean') {
        throw new Error('项目数据不完整')
      }

      await db.put('projects', project)
      logger.info('项目创建成功:', id)
      return id
    } catch (error) {
      logger.error('创建项目失败:', error)
      throw error // 抛出错误，让调用方处理
    }
  },

  // 更新项目信息
  async updateProject(projectId: string, updates: Partial<Project>): Promise<boolean> {
    try {
      const db = await getDB()
      const project = await db.get('projects', projectId)

      if (!project) {
        return false
      }

      // 合并元数据更新
      if (updates.metadata && project.metadata) {
        updates.metadata = {
          ...project.metadata,
          ...updates.metadata
        }
      }

      const updatedProject = {
        ...project,
        ...updates,
        updatedAt: new Date() // 自动更新时间戳
      }

      await db.put('projects', updatedProject)
      return true
    } catch (error) {
      logger.error('更新项目失败:', error)
      return false
    }
  },

  // 仅更新项目元数据，不改变更新时间
  async updateProjectMetadata(
    projectId: string,
    metadata: Record<string, unknown>
  ): Promise<boolean> {
    try {
      const db = await getDB()
      const project = await db.get('projects', projectId)

      if (!project) {
        return false
      }

      // 合并元数据
      const updatedMetadata = {
        ...project.metadata,
        ...metadata
      }

      const updatedProject = {
        ...project,
        metadata: updatedMetadata
        // 不更新 updatedAt 时间戳
      }

      await db.put('projects', updatedProject)
      return true
    } catch (error) {
      logger.error('更新项目元数据失败:', error)
      return false
    }
  },

  // 归档项目
  async archiveProject(projectId: string): Promise<boolean> {
    return this.updateProject(projectId, { isArchived: true })
  },

  // 恢复项目
  async unarchiveProject(projectId: string): Promise<boolean> {
    return this.updateProject(projectId, { isArchived: false })
  },

  // 删除项目及其所有相关数据
  async deleteProject(projectId: string): Promise<boolean> {
    try {
      // 首先删除所有关联的聊天记录
      // V1 chat 数据 (chat-db) 已不再有活 UI 访问, 无需清理
      // 删除IndexedDB中的思维导图数据
      const { mindmapDB } = await import('./mindmapDB')
      await mindmapDB.clear(projectId)

      // 清除LocalStorage中的数据
      const dataKey = `mindmap_data_${projectId}`
      const viewKey = `mindmap_view_${projectId}`
      localStorage.removeItem(dataKey)
      localStorage.removeItem(viewKey)

      // 然后删除项目本身
      const db = await getDB()
      await db.delete('projects', projectId)

      logger.info(`项目 ${projectId} 及其所有相关数据已删除`)
      return true
    } catch (error) {
      logger.error('删除项目失败:', error)
      return false
    }
  },

  // 获取项目统计信息
  async getProjectStats(_projectId: string): Promise<ProjectStats | null> {
    // V1 chat 数据 (chat-db) 已无活 UI, stats 固定返回 0
    return {
      conversationCount: 0,
      messageCount: 0
    }
  },

  // 优化后的获取带统计信息的项目列表方法
  async getProjectsWithStats(includeArchived: boolean = false): Promise<ProjectWithStats[]> {
    try {
      const projects = await this.getProjects(includeArchived)

      // 并行处理所有项目的统计信息
      const statsPromises = projects.map(async project => {
        try {
          // projects已经经过getProjects的数据修复，这里不需要额外检查

          // 首先检查项目元数据中是否有最近的统计信息
          const metadata = project.metadata || {}
          const cachedStats = metadata.stats as ProjectStats | undefined
          const statsCachedTime = metadata.statsCachedTime as Date | undefined

          // 如果有缓存的统计信息且缓存时间在30分钟以内，直接使用缓存
          const now = new Date()
          const useCache =
            cachedStats &&
            statsCachedTime &&
            now.getTime() - new Date(statsCachedTime).getTime() < 1800000 // 30分钟 = 1800000毫秒

          let stats: ProjectStats

          if (useCache) {
            stats = cachedStats
          } else {
            // 获取最新的统计信息
            stats = (await this.getProjectStats(project.id)) || {
              conversationCount: 0,
              messageCount: 0
            }

            // 更新项目元数据中的统计信息
            await this.updateProjectMetadata(project.id, {
              stats,
              statsCachedTime: new Date()
            }).catch(err => logger.error('更新项目统计信息缓存失败:', err))
          }

          return {
            ...project,
            stats
          }
        } catch (error) {
          logger.error('处理项目统计信息失败:', project.id, error)
          // 返回带默认统计信息的项目
          return {
            ...project,
            stats: {
              conversationCount: 0,
              messageCount: 0
            }
          }
        }
      })

      // 等待所有统计信息处理完成
      const results = await Promise.all(statsPromises)
      return results
    } catch (error) {
      logger.error('获取带统计信息的项目列表失败:', error)
      return []
    }
  },

  // 按标签查找项目
  async findProjectsByTags(tags: string[], includeArchived: boolean = false): Promise<Project[]> {
    try {
      const projects = await this.getProjects(includeArchived)

      // 过滤包含指定标签的项目
      return projects.filter(project => {
        if (!project.tags) return false
        return tags.some(tag => project.tags?.includes(tag))
      })
    } catch (error) {
      logger.error('按标签查找项目失败:', error)
      return []
    }
  },

  // 搜索项目
  async searchProjects(query: string, includeArchived: boolean = false): Promise<Project[]> {
    try {
      const projects = await this.getProjects(includeArchived)
      const lowerQuery = query.toLowerCase()

      // 按名称和描述搜索
      return projects.filter(project => {
        const nameMatch = project.name.toLowerCase().includes(lowerQuery)
        const descMatch = project.description?.toLowerCase().includes(lowerQuery) || false
        return nameMatch || descMatch
      })
    } catch (error) {
      logger.error('搜索项目失败:', error)
      return []
    }
  },

  // 快照管理功能
  snapshots: {
    // 创建快照
    async create(
      projectId: string,
      name: string,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 快照数据结构动态，包含脑图和视图数据
      data: any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 视图数据结构动态
      viewData?: any,
      isAuto: boolean = false,
      description?: string
    ): Promise<string> {
      try {
        const db = await getDB()
        const snapshotId = `snapshot_${projectId}_${Date.now()}`

        // 获取当前项目的快照数量来确定版本号
        const existingSnapshots = await db.getAllFromIndex('snapshots', 'by-project', projectId)
        const version = existingSnapshots.length + 1

        const snapshot = {
          id: snapshotId,
          projectId,
          name,
          description,
          data,
          viewData,
          createdAt: new Date(),
          isAuto,
          version
        }

        await db.add('snapshots', snapshot)

        // 如果是自动快照，清理旧的自动快照（保留最多20个）
        if (isAuto) {
          await projectDB.snapshots.cleanupAutoSnapshots(projectId)
        }

        logger.info(`快照 ${snapshotId} 创建成功`)
        return snapshotId
      } catch (error) {
        logger.error('创建快照失败:', error)
        throw error
      }
    },

    // 获取项目的所有快照
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 快照数据结构包含各种动态属性
    async getByProject(projectId: string): Promise<any[]> {
      try {
        const db = await getDB()
        const snapshots = await db.getAllFromIndex(
          'snapshots',
          'by-project-created',
          IDBKeyRange.bound([projectId, new Date(0)], [projectId, new Date()])
        )
        return snapshots.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      } catch (error) {
        logger.error('获取项目快照失败:', error)
        return []
      }
    },

    // 获取单个快照
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 返回的快照数据结构动态
    async getById(snapshotId: string): Promise<any | null> {
      try {
        const db = await getDB()
        return (await db.get('snapshots', snapshotId)) || null
      } catch (error) {
        logger.error('获取快照失败:', error)
        return null
      }
    },

    // 删除快照
    async delete(snapshotId: string): Promise<boolean> {
      try {
        const db = await getDB()
        await db.delete('snapshots', snapshotId)
        logger.info(`快照 ${snapshotId} 删除成功`)
        return true
      } catch (error) {
        logger.error('删除快照失败:', error)
        return false
      }
    },

    // 清理旧的自动快照（保留最多20个）
    async cleanupAutoSnapshots(projectId: string): Promise<void> {
      try {
        const db = await getDB()
        const autoSnapshots = await db.getAllFromIndex('snapshots', 'by-project', projectId)

        // 筛选出自动快照并按时间排序
        const sortedAutoSnapshots = autoSnapshots
          .filter(s => s.isAuto)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

        // 如果超过20个，删除最旧的
        if (sortedAutoSnapshots.length > 20) {
          const toDelete = sortedAutoSnapshots.slice(20)
          for (const snapshot of toDelete) {
            await db.delete('snapshots', snapshot.id)
          }
          logger.info(`清理了 ${toDelete.length} 个旧的自动快照`)
        }
      } catch (error) {
        logger.error('清理自动快照失败:', error)
      }
    },

    // 检查是否需要创建自动快照（距离上次自动快照超过1小时）
    async shouldCreateAutoSnapshot(projectId: string): Promise<boolean> {
      try {
        const db = await getDB()
        const autoSnapshots = await db.getAllFromIndex('snapshots', 'by-project', projectId)

        // 筛选出自动快照并找到最新的
        const latestAutoSnapshot = autoSnapshots
          .filter(s => s.isAuto)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]

        if (!latestAutoSnapshot) {
          return true // 没有自动快照，需要创建
        }

        // 检查是否超过1小时
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
        return latestAutoSnapshot.createdAt < oneHourAgo
      } catch (error) {
        logger.error('检查自动快照条件失败:', error)
        return false
      }
    }
  }
}

// chatDB 依赖已移除 (V1 数据已无活 UI 消费者)
