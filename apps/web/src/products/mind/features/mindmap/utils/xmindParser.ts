// @ts-nocheck — cloud/collab-heavy legacy; runtime behavior gated by no-op shims
import { parseXmlContent } from "@/products/mind/utils/xmlParser"
import JSZip from "jszip"
import { logger } from "@zoeymind/logger"
import type { MindMapNodeTree } from "simple-mind-map"

/**
 * XMind 文件解析工具
 */

/**
 * 从 title 中提取纯文本
 * 处理各种格式：字符串、XML 转 JSON 的对象（含 #text）、富文本对象等
 */
const extractTextFromTitle = (title: unknown): string => {
  if (title === undefined || title === null) return ""
  if (typeof title === "string") return title

  // 处理对象格式
  if (typeof title === "object") {
    const obj = title as Record<string, unknown>
    // XML 转 JSON 格式：{ '#text': '文本', 'svg:xxx': ... }
    if ("#text" in obj) {
      return String(obj["#text"] || "")
    }
    // 富文本格式
    if ("content" in obj) return String(obj.content || "")
    if ("text" in obj) return String(obj.text || "")
    if ("plain" in obj) return String(obj.plain || "")
    // 数组格式：取第一个文本元素
    if (Array.isArray(title)) {
      for (const item of title) {
        if (typeof item === "string") return item
        if (item && typeof item === "object") {
          const itemObj = item as Record<string, unknown>
          if ("#text" in itemObj) return String(itemObj["#text"] || "")
          if ("text" in itemObj) return String(itemObj.text || "")
        }
      }
    }
    // 无法提取，返回空字符串（避免 [object Object]）
    return ""
  }

  return String(title)
}

/**
 * 图标映射关系
 * XMind 星星/旗帜有多种颜色，simple-mind-map 只有单一样式
 * 优先级使用通用规则处理，不需要单独映射
 */
const ICON_MAPPING: Record<string, string> = {
  // 优先级 (保留基础映射)
  "priority-1": "priority_1",
  "priority-2": "priority_2",
  "priority-3": "priority_3",
}

/**
 * 转换图标ID
 * @param iconId 原始图标ID
 * @returns 转换后的图标ID或undefined
 */
const convertIconId = (iconId: string): string | undefined => {
  // 先检查精确映射
  if (ICON_MAPPING[iconId]) {
    return ICON_MAPPING[iconId]
  }
  // 星星图标不再映射（用例节点只通过 priority_* 标识）
  if (iconId.startsWith("star-")) {
    return undefined
  }
  // 所有旗帜图标（任意颜色）映射到 sign_2
  if (iconId.startsWith("flag-")) {
    return "sign_2"
  }
  return undefined
}

/**
 * 标准化图标顺序：优先级在前，星星在后
 * @param icons 原始图标数组
 * @returns 排序后的图标数组
 */
const sortIcons = (icons: string[]): string[] => {
  if (!icons || icons.length === 0) {
    return icons
  }

  const priorityIcons: string[] = []
  const signIcons: string[] = []
  const otherIcons: string[] = []

  icons.forEach(icon => {
    if (icon.startsWith("priority_")) {
      priorityIcons.push(icon)
    } else if (icon.startsWith("sign_")) {
      signIcons.push(icon)
    } else {
      otherIcons.push(icon)
    }
  })

  // 优先级按数字排序
  priorityIcons.sort((a, b) => {
    const aNum = parseInt(a.replace("priority_", ""))
    const bNum = parseInt(b.replace("priority_", ""))
    return aNum - bNum
  })

  // 返回标准顺序：优先级 + 星星 + 其他
  return [...priorityIcons, ...signIcons, ...otherIcons]
}

// 使用 simple-mind-map 库的原生类型
export type { MindMapNodeTree as MindMapNodeTree }

/**
 * XMind主题数据结构
 */
export interface XMindTopic {
  id?: string
  title?: string
  // 旧版标记
  "marker-refs"?: {
    "marker-ref":
      | {
          "marker-id": string
        }
      | Array<{
          "marker-id": string
        }>
  }
  // 新版标记
  markers?: Array<{
    markerId: string
  }>
  children?: {
    topics?: {
      topic: XMindTopic | XMindTopic[]
    }
    // 新版子节点
    attached?: XMindTopic[]
  }
  [key: string]: string | string[] | XMindTopic[] | object | undefined
}

/**
 * XMind数据结构
 */
export interface XMindData {
  topic?: XMindTopic
  sheet?: XMindData
  rootTopic?: XMindTopic
  [key: string]: XMindTopic | XMindData | string | object | undefined
}

/**
 * 将XMind主题转换为MindMapNodeTree
 * @param topic XMind主题数据
 * @param isRoot 是否是根节点
 * @returns 转换后的MindMapNodeTree
 */
export const convertTopicToMindMapNodeTree = (
  topic: XMindTopic,
  isRoot: boolean = false
): MindMapNodeTree => {
  // 基本节点数据 - 使用 extractTextFromTitle 确保 text 是字符串
  const mindMapData: MindMapNodeTree = {
    data: {
      text: extractTextFromTitle(topic.title),
      uid: topic.id || "",
      expand: isRoot, // 根节点展开，其他节点折叠
      isActive: false,
      richText: false,
    },
    children: [],
  }

  // 处理图标 - 支持新旧两种格式
  // 处理旧版格式
  if (topic["marker-refs"] && topic["marker-refs"]["marker-ref"]) {
    const markerRef = topic["marker-refs"]["marker-ref"]
    const markerId = Array.isArray(markerRef)
      ? markerRef
          .map(m => convertIconId(m["marker-id"]))
          .filter((id): id is string => id !== undefined)
      : [convertIconId(markerRef["marker-id"])].filter((id): id is string => id !== undefined)

    if (markerId.length > 0) {
      mindMapData.data.icon = sortIcons(markerId)
    }
  }
  // 处理新版格式
  else if (topic.markers && Array.isArray(topic.markers) && topic.markers.length > 0) {
    const markerId = topic.markers
      .map(marker => convertIconId(marker.markerId))
      .filter((id): id is string => id !== undefined)
    if (markerId.length > 0) {
      mindMapData.data.icon = sortIcons(markerId)
    }
  }

  // 处理子节点 - 支持新旧两种格式
  // 处理旧版格式
  if (topic.children && topic.children.topics) {
    const childTopics = topic.children.topics.topic

    if (Array.isArray(childTopics)) {
      // 多个子节点
      mindMapData.children = childTopics.map(childTopic =>
        convertTopicToMindMapNodeTree(childTopic, false)
      )
    } else if (childTopics) {
      // 单个子节点
      mindMapData.children = [convertTopicToMindMapNodeTree(childTopics, false)]
    }
  }
  // 处理新版格式
  else if (topic.children && topic.children.attached && Array.isArray(topic.children.attached)) {
    mindMapData.children = topic.children.attached.map(childTopic =>
      convertTopicToMindMapNodeTree(childTopic, false)
    )
  }

  return mindMapData
}

/**
 * 将XMind数据转换为MindMapNodeTree
 * @param xmindData XMind解析后的数据
 * @returns 转换后的MindMapNodeTree
 */
export const convertXMindToMindMapNodeTree = (xmindData: XMindData): MindMapNodeTree | null => {
  try {
    // 检查是否有主题数据 - 支持新旧两种格式
    if (!xmindData) {
      logger.warn("XMind数据为空")
      return null
    }

    // 处理旧版格式
    if (xmindData.topic) {
      return convertTopicToMindMapNodeTree(xmindData.topic, true)
    }
    // 处理新版格式
    else if (xmindData.rootTopic) {
      return convertTopicToMindMapNodeTree(xmindData.rootTopic, true)
    }

    logger.warn("XMind数据中没有找到主题数据")
    return null
  } catch (error) {
    logger.error("转换XMind数据失败:", error)
    return null
  }
}

/**
 * 解析 XMind 文件
 * @param file XMind 文件对象
 * @returns 解析后的思维导图数据
 */
export const parseXMindFile = async (file: File) => {
  try {
    const zip = new JSZip()
    const zipFile = await zip.loadAsync(await file.arrayBuffer())

    // 检查文件类型
    let jsonData = null

    // 先尝试读取content.json（新版XMind）
    if (zipFile.files["content.json"]) {
      const jsonContent = await zipFile.files["content.json"].async("string")
      try {
        const content = JSON.parse(jsonContent)
        // 处理新版XMind数据
        if (Array.isArray(content) && content.length > 0) {
          const data = content[0]
          if (data.rootTopic) {
            // 直接转换为MindMapNodeTree格式
            const mindMapData = convertXMindToMindMapNodeTree(data)
            if (mindMapData) {
              // 添加simple-mind-map需要的版本信息
              return {
                data: mindMapData.data,
                children: mindMapData.children,
                smmVersion: "0.13.1-fix.2",
              }
            }

            // 如果转换失败，返回原始数据
            return data
          }
        }
      } catch (e) {
        logger.error("解析content.json失败:", e)
      }
    }

    // 如果没有content.json或解析失败，尝试读取content.xml
    const xmlFile = zipFile.files["content.xml"] || zipFile.files["/content.xml"]
    if (xmlFile) {
      const xmlContent = await xmlFile.async("string")

      // 使用XML解析工具解析XML内容
      jsonData = parseXmlContent(xmlContent, {
        ignoreAttributes: false,
        attributeNamePrefix: "",
        parseAttributeValue: true,
        preserveOrder: false,
      })

      // 根据实际解析结果提取思维导图数据
      let sheetData: XMindData | null = null

      // 尝试多种可能的数据结构
      if (jsonData["xmap-content"] && jsonData["xmap-content"].sheet) {
        sheetData = jsonData["xmap-content"].sheet
      } else if (jsonData.sheet) {
        sheetData = jsonData.sheet
      } else if (jsonData.xmap && jsonData.xmap.sheet) {
        sheetData = jsonData.xmap.sheet
      } else if (jsonData.topic) {
        sheetData = { topic: jsonData.topic }
      } else if (jsonData["xmap-content"] && jsonData["xmap-content"].topic) {
        sheetData = { topic: jsonData["xmap-content"].topic }
      } else {
        // 深度遍历查找topic节点
        const findTopic = (
          obj: Record<string, XMindTopic | XMindData | string | object | undefined>
        ): XMindData | null => {
          if (!obj || typeof obj !== "object") return null

          // 检查当前对象是否包含topic
          if ("topic" in obj) {
            return { topic: obj.topic as XMindTopic }
          }

          // 检查当前对象的所有属性
          for (const key in obj) {
            if (typeof obj[key] === "object") {
              const result = findTopic(
                obj[key] as Record<string, XMindTopic | XMindData | string | object | undefined>
              )
              if (result) return result
            }
          }

          return null
        }

        sheetData = findTopic(
          jsonData as Record<string, XMindTopic | XMindData | string | object | undefined>
        )

        // 如果仍然找不到，返回完整数据
        if (!sheetData) {
          logger.warn("未找到预期的思维导图数据结构，返回完整解析结果")
          return jsonData
        }
      }

      // 转换为MindMapNodeTree格式
      if (sheetData) {
        const mindMapData = convertXMindToMindMapNodeTree(sheetData)
        if (mindMapData) {
          // 添加simple-mind-map需要的版本信息
          return {
            data: mindMapData.data,
            children: mindMapData.children,
            smmVersion: "0.13.1-fix.2",
          }
        }
      }

      // 如果转换失败，返回原始数据
      return sheetData
    }

    throw new Error("无效的 XMind 文件：缺少 content.xml 或 content.json")
  } catch (error) {
    logger.error("解析 XMind 文件失败:", error)
    throw new Error(`解析 XMind 文件失败: ${error instanceof Error ? error.message : "未知错误"}`)
  }
}
