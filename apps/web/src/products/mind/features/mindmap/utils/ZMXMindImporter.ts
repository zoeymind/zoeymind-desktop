// @ts-nocheck — cloud/collab-heavy legacy; runtime behavior gated by no-op shims
import JSZip from "jszip"
import { logger } from "@zoeymind/logger"
import { parseXmlContent } from "@/products/mind/utils/xmlParser"
import type { MindMapNodeTree } from "simple-mind-map"

/**
 * MeterSphere XMind 导入器（代码内部以 "ZM" 命名，"ZM" = MeterSphere 测试管理工具的导出格式）
 * ----------
 * 用于将 MeterSphere 导出的 XMind 文件解析回思维导图。
 * 支持解析：
 * - 模块节点（纯文本，无前缀）
 * - 测试用例节点（case：前缀）
 * - 前置条件节点（前置条件：前缀）
 * - 用例等级节点（用例等级：前缀）
 * - 步骤描述节点（固定文本）
 * - 步骤节点（步骤：前缀）
 * - 预期结果节点（预期结果：前缀）
 *
 * 类/函数名保留 ZM 前缀是历史原因（避免一次性 rename 影响 import path）；
 * **用户可见的字符串一律使用 MeterSphere**。
 */

/**
 * 从 title 中提取纯文本
 */
const extractTextFromTitle = (title: unknown): string => {
  if (title === undefined || title === null) return ""
  if (typeof title === "string") return title
  if (typeof title === "object") {
    const obj = title as Record<string, unknown>
    if ("#text" in obj) return String(obj["#text"] || "")
    if ("content" in obj) return String(obj.content || "")
    if ("text" in obj) return String(obj.text || "")
    if ("plain" in obj) return String(obj.plain || "")
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
    return ""
  }
  return String(title)
}

/**
 * XMind主题数据结构
 */
export interface XMindTopic {
  id?: string
  title?: string
  "marker-refs"?: {
    "marker-ref":
      | {
          "marker-id": string
        }
      | Array<{
          "marker-id": string
        }>
  }
  markers?: Array<{
    markerId: string
  }>
  children?: {
    topics?: {
      topic: XMindTopic | XMindTopic[]
    }
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
 * 解析后的节点信息
 */
interface ParsedNodeInfo {
  type:
    | "root"
    | "module"
    | "testcase"
    | "precondition"
    | "priority"
    | "steps"
    | "step"
    | "step_desc"
    | "expected"
  text: string
  rawText: string
}

/**
 * 解析节点文本，识别节点类型
 */
const parseNodeText = (text: string): ParsedNodeInfo => {
  const trimmed = text.trim()

  // 固定文本节点
  if (trimmed === "步骤描述" || trimmed === "步骤描述：" || trimmed === "步骤描述:") {
    return { type: "steps", text: trimmed, rawText: trimmed }
  }

  // 前缀节点
  if (/^case[:：]/i.test(trimmed)) {
    return {
      type: "testcase",
      text: trimmed.replace(/^case[:：]/i, "").trim(),
      rawText: trimmed,
    }
  }

  if (/^前置条件[:：]/.test(trimmed)) {
    return {
      type: "precondition",
      text: trimmed.replace(/^前置条件[:：]/, "").trim(),
      rawText: trimmed,
    }
  }

  if (/^(用例等级|优先级)[:：]/.test(trimmed)) {
    return {
      type: "priority",
      text: trimmed.replace(/^(用例等级|优先级)[:：]/, "").trim(),
      rawText: trimmed,
    }
  }

  if (/^步骤[:：]/.test(trimmed)) {
    return {
      type: "step",
      text: trimmed.replace(/^步骤[:：]/, "").trim(),
      rawText: trimmed,
    }
  }

  if (/^文本描述[:：]/.test(trimmed)) {
    return {
      type: "step_desc",
      text: trimmed.replace(/^文本描述[:：]/, "").trim(),
      rawText: trimmed,
    }
  }
  if (/^预期结果[:：]/.test(trimmed)) {
    return {
      type: "expected",
      text: trimmed.replace(/^预期结果[:：]/, "").trim(),
      rawText: trimmed,
    }
  }

  // 默认为模块节点
  return { type: "module", text: trimmed, rawText: trimmed }
}

/**
 * 将用例等级文本转换为图标ID
 */
const convertPriorityToIcon = (priorityText: string): string | undefined => {
  const trimmed = priorityText.trim()
  const priorityMap: Record<string, string> = {
    P0: "priority_1",
    P1: "priority_2",
    P2: "priority_3",
    P3: "priority_3",
  }
  return priorityMap[trimmed]
}

/**
 * 转换图标ID
 */
const convertIconId = (iconId: string): string | undefined => {
  if (iconId.startsWith("priority-")) {
    const priorityMap: Record<string, string> = {
      "priority-1": "priority_1",
      "priority-2": "priority_2",
      "priority-3": "priority_3",
    }
    return priorityMap[iconId]
  }
  return undefined
}

const getChildTopics = (topic: XMindTopic): XMindTopic[] => {
  const children: XMindTopic[] = []
  if (topic.children && topic.children.topics) {
    const childTopics = topic.children.topics.topic
    if (Array.isArray(childTopics)) {
      children.push(...childTopics)
    } else if (childTopics) {
      children.push(childTopics)
    }
  }
  if (topic.children && Array.isArray(topic.children.attached)) {
    children.push(...topic.children.attached)
  }
  return children
}

/**
 * 递归转换 XMind 主题为 MeterSphere 格式的 MindMapNodeTree
 */
const convertTopicToMindMapNodeTree = (
  topic: XMindTopic,
  isRoot: boolean = false
): MindMapNodeTree => {
  const text = extractTextFromTitle(topic.title)
  const parsed = parseNodeText(text)

  // 基本节点数据
  const mindMapData: MindMapNodeTree = {
    data: {
      text: parsed.text,
      uid: topic.id || "",
      expand: isRoot,
      isActive: false,
      richText: false,
    },
    children: [],
  }

  // 处理图标
  const icons: string[] = []
  if (topic["marker-refs"] && topic["marker-refs"]["marker-ref"]) {
    const markerRef = topic["marker-refs"]["marker-ref"]
    const markerIds = Array.isArray(markerRef) ? markerRef : [markerRef]
    markerIds.forEach(m => {
      const converted = convertIconId(m["marker-id"])
      if (converted) icons.push(converted)
    })
  } else if (topic.markers && Array.isArray(topic.markers)) {
    topic.markers.forEach(marker => {
      const converted = convertIconId(marker.markerId)
      if (converted) icons.push(converted)
    })
  }

  const childCandidates = getChildTopics(topic)

  const hasTestCaseChildren = childCandidates.some(child => {
    const childText = extractTextFromTitle(child.title)
    const childParsed = parseNodeText(childText)
    return ["precondition", "priority", "steps", "step", "expected", "step_desc"].includes(
      childParsed.type
    )
  })

  const effectiveType = parsed.type === "module" && hasTestCaseChildren ? "testcase" : parsed.type

  // 根据节点类型设置图标
  if (effectiveType === "testcase") {
    // 测试用例节点图标只需 priority_* 即可标识
  } else if (effectiveType === "module") {
    // 模块节点必须有 sign_2 图标
    if (!icons.includes("sign_2")) {
      icons.unshift("sign_2")
    }
  }

  if (icons.length > 0) {
    mindMapData.data.icon = icons
  }

  // 处理子节点
  const children = getChildTopics(topic)

  if (children.length > 0) {
    // MeterSphere 格式特殊处理
    if (effectiveType === "testcase") {
      // 测试用例节点的子节点需要合并
      let precondition = ""
      let priorityIcon = ""
      const steps: Array<{ description: string; expected: string }> = []

      children.forEach(child => {
        const childText = extractTextFromTitle(child.title)
        const childParsed = parseNodeText(childText)
        if (childParsed.type === "precondition") {
          precondition = childParsed.text
        } else if (childParsed.type === "priority") {
          const icon = convertPriorityToIcon(childParsed.text)
          if (icon) priorityIcon = icon
        } else if (childParsed.type === "steps") {
          // 处理步骤节点（旧格式：步骤描述 > 步骤：xxx > 预期结果：xxx）
          const stepChildren = getChildTopics(child)
          stepChildren.forEach(stepChild => {
            const stepText = extractTextFromTitle(stepChild.title)
            const stepParsed = parseNodeText(stepText)
            if (stepParsed.type === "step") {
              let expected = ""
              const expectedChildren = getChildTopics(stepChild)
              expectedChildren.forEach(expectedChild => {
                const expectedText = extractTextFromTitle(expectedChild.title)
                const expectedParsed = parseNodeText(expectedText)
                if (expectedParsed.type === "expected") {
                  expected = expectedParsed.text
                }
              })
              steps.push({
                description: stepParsed.text,
                expected,
              })
            }
          })
        } else if (childParsed.type === "step_desc") {
          // 新格式：文本描述：xxx > 预期结果：xxx
          let expected = ""
          const expectedChildren = getChildTopics(child)
          expectedChildren.forEach(expectedChild => {
            const expectedText = extractTextFromTitle(expectedChild.title)
            const expectedParsed = parseNodeText(expectedText)
            if (expectedParsed.type === "expected") {
              expected = expectedParsed.text
            }
          })
          steps.push({
            description: childParsed.text,
            expected,
          })
        }
      })
      // 合并到测试用例节点
      if (precondition) {
        mindMapData.data.text += ` & ${precondition}`
      }

      if (!priorityIcon) {
        priorityIcon = "priority_2"
      }

      mindMapData.data.icon = [priorityIcon]

      // 创建步骤子节点
      mindMapData.children = steps.map(step => ({
        data: {
          text: `${step.description} & ${step.expected || ""}`,
          uid: "",
          expand: false,
          isActive: false,
          richText: false,
        },
        children: [],
      }))
    } else {
      // 其他节点正常处理
      mindMapData.children = children.map(child => convertTopicToMindMapNodeTree(child, false))
    }
  }

  if (effectiveType === "testcase" && !mindMapData.data.icon) {
    mindMapData.data.icon = ["priority_2"]
  }

  return mindMapData
}

/**
 * 解析 MeterSphere XMind 文件
 * @param file XMind 文件对象
 * @returns 解析后的思维导图数据
 */
export const parseZMXmindFile = async (file: File): Promise<MindMapNodeTree | null> => {
  try {
    const zip = new JSZip()
    const zipFile = await zip.loadAsync(await file.arrayBuffer())

    // 尝试读取 content.json（新版 XMind）
    if (zipFile.files["content.json"]) {
      const jsonContent = await zipFile.files["content.json"].async("string")
      try {
        const content = JSON.parse(jsonContent)
        if (Array.isArray(content) && content.length > 0) {
          const data = content[0]
          if (data.rootTopic) {
            const mindMapData = convertTopicToMindMapNodeTree(data.rootTopic, true)
            return mindMapData
          }
        }
      } catch (e) {
        logger.error("解析 content.json 失败:", e)
      }
    }

    // 尝试读取 content.xml
    const xmlFile = zipFile.files["content.xml"] || zipFile.files["/content.xml"]
    if (xmlFile) {
      try {
        const xmlContent = await xmlFile.async("string")

        // 使用XML解析工具解析XML内容
        const jsonData = parseXmlContent(xmlContent, {
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
          const findTopic = (obj: Record<string, unknown>): XMindData | null => {
            if (!obj || typeof obj !== "object") return null

            // 检查当前对象是否包含topic
            if ("topic" in obj) {
              return { topic: obj.topic as XMindTopic }
            }

            // 检查当前对象的所有属性
            for (const key in obj) {
              if (typeof obj[key] === "object") {
                const result = findTopic(obj[key] as Record<string, unknown>)
                if (result) return result
              }
            }

            return null
          }

          sheetData = findTopic(jsonData as Record<string, unknown>)

          // 如果仍然找不到，说明文件格式无法识别 —— 返回 null，让调用方决定如何处理
          // （之前这里返回了 `jsonData as unknown as MindMapNodeTree`，但 jsonData 不是合法树，
          //  下游消费时一定会崩，是个隐藏的 bug，不是类型问题）
          if (!sheetData) {
            logger.warn("未找到预期的思维导图数据结构，无法转换为节点树")
            return null
          }
        }

        // 转换为MindMapNodeTree格式
        if (sheetData && sheetData.topic) {
          const mindMapData = convertTopicToMindMapNodeTree(sheetData.topic, true)
          return mindMapData
        }
      } catch (xmlError) {
        logger.error("解析 XML 格式失败:", xmlError)
        throw new Error(
          `解析 XML 格式失败: ${xmlError instanceof Error ? xmlError.message : "未知错误"}`
        )
      }
    }

    throw new Error("无效的 MeterSphere XMind 文件")
  } catch (error) {
    logger.error("解析 MeterSphere XMind 文件失败:", error)
    throw error
  }
}
