import { openDB, DBSchema, IDBPDatabase } from 'idb'
import { defaultData } from '@/products/mind/features/mindmap/components/hooks/useCanvasManager'
import { logger } from '@zoeymind/logger'
import type { MindMapNodeTree } from 'simple-mind-map'

// 定义数据库结构
interface MindMapDB extends DBSchema {
  mindmaps: {
    key: string // workspaceId-备份类型(main/backup)
    value: {
      key: string
      workspaceId: string
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
    key: string // workspaceId
    value: {
      workspaceId: string
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
    dbPromise = openDB<MindMapDB>('mindmap-db', 4, {
      async upgrade(db, oldVersion, _newVersion, tx) {
        // v3 及以前:初次建表 (mindmaps 用 'key' 作 keyPath;viewdata 用 'workspaceId')
        if (oldVersion < 3) {
          if (!db.objectStoreNames.contains('mindmaps')) {
            const mindmapsStore = db.createObjectStore('mindmaps', { keyPath: 'key' })
            mindmapsStore.createIndex('by-project', 'workspaceId')
            mindmapsStore.createIndex('by-timestamp', 'timestamp')
          }
          if (!db.objectStoreNames.contains('viewdata')) {
            const viewdataStore = db.createObjectStore('viewdata', { keyPath: 'workspaceId' })
            viewdataStore.createIndex('by-timestamp', 'timestamp')
          }
        }

        // v3 → v4: projectId → workspaceId 字段迁移 (#37 只改了 TS 字段名,忘了 bump 版本号)
        // viewdata: keyPath 从 'projectId' 变成 'workspaceId' — IDB keyPath 不可变,删重建
        // (视图变换态可丢,pan/zoom 会立刻重新落盘)
        if (oldVersion < 4) {
          if (db.objectStoreNames.contains('viewdata')) {
            db.deleteObjectStore('viewdata')
          }
          const viewdataStore = db.createObjectStore('viewdata', { keyPath: 'workspaceId' })
          viewdataStore.createIndex('by-timestamp', 'timestamp')

          // mindmaps: 主 keyPath 'key' 不变,只需搬记录里的 projectId → workspaceId + 重建索引
          if (db.objectStoreNames.contains('mindmaps')) {
            const store = tx.objectStore('mindmaps')
            if (store.indexNames.contains('by-project')) {
              store.deleteIndex('by-project')
            }
            let cursor = await store.openCursor()
            while (cursor) {
              const value = cursor.value as Record<string, unknown>
              if ('projectId' in value && !('workspaceId' in value)) {
                value.workspaceId = value.projectId
                delete value.projectId
                await cursor.update(value as never)
              }
              cursor = await cursor.continue()
            }
            store.createIndex('by-project', 'workspaceId')
          }
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
  async save(data: MindMapNodeTree, workspaceId: string = DEFAULT_PROJECT_ID): Promise<boolean> {
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
        key: `${workspaceId}-main`,
        workspaceId,
        data: saveData,
        backupType: 'main',
        timestamp
      })

      // 保存备份数据
      await db.put('mindmaps', {
        key: `${workspaceId}-backup`,
        workspaceId,
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
  async load(workspaceId: string = DEFAULT_PROJECT_ID): Promise<MindMapNodeTree> {
    try {
      const db = await getDB()

      // 尝试获取主数据
      const mainData = await db.get('mindmaps', `${workspaceId}-main`)
      if (mainData) {
        return mainData.data
      }

      // 如果主数据不存在，尝试获取备份数据
      const backupData = await db.get('mindmaps', `${workspaceId}-backup`)
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
  async clear(workspaceId: string = DEFAULT_PROJECT_ID): Promise<boolean> {
    try {
      const db = await getDB()
      await db.delete('mindmaps', `${workspaceId}-main`)
      await db.delete('mindmaps', `${workspaceId}-backup`)
      return true
    } catch (error) {
      logger.error('清除思维导图数据失败:', error)
      return false
    }
  },

  // 项目管理功能已移至projectDB.ts，mindmapDB只负责思维导图数据存储

  // 保存视图数据
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 视图数据结构动态，包含scale、translateX、translateY等属性
  async saveViewData(viewData: any, workspaceId: string = DEFAULT_PROJECT_ID): Promise<boolean> {
    try {
      const db = await getDB()
      await db.put('viewdata', {
        workspaceId,
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
  async loadViewData(workspaceId: string = DEFAULT_PROJECT_ID): Promise<any | null> {
    try {
      const db = await getDB()
      const result = await db.get('viewdata', workspaceId)
      return result?.viewData || null
    } catch (error) {
      logger.error('加载视图数据失败:', error)
      return null
    }
  }
}
