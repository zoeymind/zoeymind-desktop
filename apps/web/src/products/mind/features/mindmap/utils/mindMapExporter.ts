// @ts-nocheck — cloud/collab-heavy legacy; runtime behavior gated by no-op shims
import { logger } from '@zoeymind/logger'
import type { default as MindMap, MindMapNodeTree } from 'simple-mind-map'

/**
 * 思维导图导出工具
 *
 * 提供各种格式的导出功能，包括获取预览图
 */

/**
 * 获取思维导图的PNG预览图
 * @param mindMap 思维导图实例
 * @returns Promise<string> 返回base64格式的图片数据
 */
export const getMindMapPreview = async (mindMap: MindMap): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      // 自定义回调函数，获取base64图像数据
      const customCallback = (data: string) => {
        resolve(data)
      }

      // 设置导出的文件名和透明度
      const fileName = 'preview'
      const transparent = false

      // 创建一个对象来拦截导出函数的结果
      if (!mindMap.doExport?.png) {
        throw new Error('导出功能未初始化')
      }

      const origFn = mindMap.doExport.png
      mindMap.doExport.png = async (name, trans) => {
        // 恢复原始函数
        if (mindMap.doExport) {
          mindMap.doExport.png = origFn
        }
        // 调用原始函数获取数据
        const result = await origFn.call(mindMap.doExport, name, trans)
        // 调用自定义回调
        customCallback(result)
        return result
      }

      // 触发导出
      mindMap.doExport.png(fileName, transparent)
    } catch (error) {
      logger.error('生成思维导图预览图失败:', error)
      reject(error)
    }
  })
}

/**
 * 获取思维导图中的测试用例总数（使用 priority_* 图标标识）
 * @param mindMap 思维导图实例
 * @returns 测试用例总数
 */
export const getNodeCount = (mindMap: MindMap): number => {
  try {
    // 检查思维导图实例是否有效
    if (!mindMap) {
      logger.warn('思维导图实例无效')
      return 0
    }

    // 获取完整的思维导图数据（包括未渲染/折叠的节点）
    const rawData = mindMap.getData()

    if (!rawData) {
      logger.warn('无法获取思维导图原始数据')
      return 0
    }

    let count = 0

    // 递归遍历完整数据树，统计带有 priority_* 图标的节点（测试用例）
    const traverseDataTree = (node: MindMapNodeTree) => {
      if (!node) return

      const nodeData = node.data
      if (nodeData && nodeData.icon && Array.isArray(nodeData.icon)) {
        // 检查是否包含 priority_* 图标（测试用例标识）
        if (nodeData.icon.some((icon: string) => icon.startsWith('priority_'))) {
          count++
        }
      }

      // 递归处理子节点
      if (node.children && Array.isArray(node.children)) {
        node.children.forEach((child: MindMapNodeTree) => {
          traverseDataTree(child)
        })
      }
    }

    // 从根节点开始遍历
    traverseDataTree(rawData as MindMapNodeTree)

    return count
  } catch (error) {
    logger.error('计算测试用例数量失败:', error)
    return 0
  }
}

/**
 * 计算字符串字节大小
 * @param str 要计算的字符串
 * @returns 字节大小
 */
export const getStringSizeInBytes = (str: string): number => {
  // 创建一个Blob对象来精确计算字符串的字节大小
  const blob = new Blob([str])
  return blob.size
}

/**
 * 生成项目缩略图并保存到项目元数据中
 * @param mindMap 思维导图实例
 * @param workspaceId 项目ID
 */
export const generateAndSavePreview = async (
  mindMap: MindMap,
  workspaceId: string
): Promise<void> => {
  if (!mindMap || !workspaceId) return

  try {
    // 检查是否正在渲染或编辑中
    if (mindMap.renderer?.isRendering || mindMap.renderer?.textEdit?.showTextEdit) {
      logger.warn('思维导图正在渲染或编辑中，跳过预览图生成')
      return
    }

    // 获取思维导图预览图
    const previewData = await getMindMapPreview(mindMap)

    // 获取测试用例计数
    const nodeCount = getNodeCount(mindMap)

    // 计算思维导图数据大小
    let fileSize = 0
    try {
      // 获取完整的思维导图数据
      const mindMapData = mindMap.getData()
      // 转换为JSON字符串
      const jsonData = JSON.stringify(mindMapData)
      // 计算字节大小
      fileSize = getStringSizeInBytes(jsonData)
      logger.info(`思维导图数据大小: ${fileSize} 字节`)
    } catch (error) {
      logger.error('计算思维导图数据大小失败:', error)
    }

    // 向项目元数据中保存预览图和节点计数
    const { projectDB } = await import('@/shared/mindmap-bridge')

    await projectDB.updateProject(workspaceId, {
      metadata: {
        preview: previewData,
        nodeCount,
        fileSize,
        lastUpdated: new Date()
      }
    })

    logger.info(`项目预览图已更新，测试用例数量: ${nodeCount}，数据大小: ${fileSize} 字节`)
  } catch (error) {
    logger.error('保存项目预览图失败:', error)
  }
}