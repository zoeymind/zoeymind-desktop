// @ts-nocheck — dormant bridge IDB storage, replaced by src/shared/native/*
import { openDB, DBSchema, IDBPDatabase } from 'idb'
import { defaultMindmapData as defaultData } from '@zoeymind/shared'
import { logger } from '@zoeymind/logger'
import type { MindMapNodeTree } from 'simple-mind-map'

// 定义数据库结构
interface MindMapDB extends DBSchema {
  mindmaps: {
    key: string // projectId-备份类型(main/backup)
    value: {
      key: string
      projectId: string
      data: MindMapNodeTree
      backupType: 'main' | 'backup'
      timestamp: Date
    }
    indexes: {
      'by-project': string // 按项目ID索引
      'by-timestamp': Date // 按时间戳索引
    }
  }
  viewdata: {
    key: string // projectId
    value: {
      projectId: string
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 视图变换数据结构复杂且动态变化，使用any保证兼容性
      viewData: any // 视图变换数据
      timestamp: Date
    }
    indexes: {
      'by-timestamp': Date // 按时间戳索引
    }
  }
}

let dbPromise: Promise<IDBPDatabase<MindMapDB>> | null = null

// 提取需要保存的数据
const extractSaveData = (nodeData: MindMapNodeTree): MindMapNodeTree => {
  if (!nodeData || !nodeData.data) {
    return defaultData
  }

  // 只保存必要的节点数据
  const result: MindMapNodeTree = {
    data: {
      text: nodeData.data.text || '',
      uid: nodeData.data.uid,
      expand: nodeData.data.expand,
      isActive: nodeData.data.isActive,
      richText: nodeData.data.richText,
      resetRichText: nodeData.data.resetRichText
    },
    children: []
  }

  // 保存图标数据
  if (Array.isArray(nodeData.data.icon)) {
    result.data.icon = [...nodeData.data.icon]
  }

  // 保存自定义数据
  if (nodeData.data.customData && typeof nodeData.data.customData === 'object') {
    result.data.customData = { ...(nodeData.data.customData as Record<string, unknown>) }
  }

  // 保存样式数据
  if (nodeData.data.style && typeof nodeData.data.style === 'object') {
    result.data.style = { ...(nodeData.data.style as Record<string, unknown>) }
  }

  // 递归处理子节点
  if (Array.isArray(nodeData.children)) {
    result.children = nodeData.children
      .filter(
        (child: unknown): child is MindMapNodeTree => child !== null && typeof child === 'object'
      )
      .map((child: MindMapNodeTree) => extractSaveData(child))
  } else {
    result.children = []
  }

  return result
}

// 初始化数据库
const getDB = async () => {
  if (!dbPromise) {
    dbPromise = openDB<MindMapDB>('mindmap-db', 3, {
      upgrade(db) {
        // 创建思维导图存储
        if (!db.objectStoreNames.contains('mindmaps')) {
          const mindmapsStore = db.createObjectStore('mindmaps', { keyPath: 'key' })
          mindmapsStore.createIndex('by-project', 'projectId')
          mindmapsStore.createIndex('by-timestamp', 'timestamp')
        }

        // 创建视图数据存储
        if (!db.objectStoreNames.contains('viewdata')) {
          const viewdataStore = db.createObjectStore('viewdata', { keyPath: 'projectId' })
          viewdataStore.createIndex('by-timestamp', 'timestamp')
        }
      }
    })
  }
  return dbPromise
}

// 生成默认项目ID
const DEFAULT_PROJECT_ID = 'default-project'

// 导出数据库接口
export const mindmapDB = {
  // 保存思维导图数据
  async save(data: MindMapNodeTree, projectId: string = DEFAULT_PROJECT_ID): Promise<boolean> {
    try {
      if (!data || !data.data) {
        logger.warn('尝试保存空数据')
        return false
      }

      const db = await getDB()
      const saveData = extractSaveData(data)
      const timestamp = new Date()

      // 保存主数据
      await db.put('mindmaps', {
        key: `${projectId}-main`,
        projectId,
        data: saveData,
        backupType: 'main',
        timestamp
      })

      // 保存备份数据
      await db.put('mindmaps', {
        key: `${projectId}-backup`,
        projectId,
        data: saveData,
        backupType: 'backup',
        timestamp
      })

      // 项目时间戳更新现在由projectDB负责

      return true
    } catch (error) {
      logger.error('保存思维导图数据失败:', error)
      return false
    }
  },

  // 加载思维导图数据
  async load(projectId: string = DEFAULT_PROJECT_ID): Promise<MindMapNodeTree> {
    try {
      const db = await getDB()

      // 尝试获取主数据
      const mainData = await db.get('mindmaps', `${projectId}-main`)
      if (mainData) {
        return mainData.data
      }

      // 如果主数据不存在，尝试获取备份数据
      const backupData = await db.get('mindmaps', `${projectId}-backup`)
      if (backupData) {
        return backupData.data
      }

      // 如果都没有，返回默认数据
      return defaultData
    } catch (error) {
      logger.error('加载思维导图数据失败:', error)
      // 返回默认数据
      return defaultData
    }
  },

  // 清除特定项目的思维导图数据
  async clear(projectId: string = DEFAULT_PROJECT_ID): Promise<boolean> {
    try {
      const db = await getDB()
      await db.delete('mindmaps', `${projectId}-main`)
      await db.delete('mindmaps', `${projectId}-backup`)
      return true
    } catch (error) {
      logger.error('清除思维导图数据失败:', error)
      return false
    }
  },

  // 项目管理功能已移至projectDB.ts，mindmapDB只负责思维导图数据存储

  // 保存视图数据
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 视图数据结构动态，包含scale、translateX、translateY等属性
  async saveViewData(viewData: any, projectId: string = DEFAULT_PROJECT_ID): Promise<boolean> {
    try {
      const db = await getDB()
      await db.put('viewdata', {
        projectId,
        viewData,
        timestamp: new Date()
      })
      return true
    } catch (error) {
      logger.error('保存视图数据失败:', error)
      return false
    }
  },

  // 加载视图数据
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 返回的视图数据结构动态，包含各种变换属性
  async loadViewData(projectId: string = DEFAULT_PROJECT_ID): Promise<any | null> {
    try {
      const db = await getDB()
      const result = await db.get('viewdata', projectId)
      return result?.viewData || null
    } catch (error) {
      logger.error('加载视图数据失败:', error)
      return null
    }
  }
}