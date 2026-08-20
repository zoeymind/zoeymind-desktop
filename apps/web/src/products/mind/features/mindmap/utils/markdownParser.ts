/**
 * Markdown 文件解析工具
 * 基于 simple-mind-map 的 markdown API 实现
 */
import type { MindMapNodeTree } from "simple-mind-map"

/**
 * Emoji到思维导图图标的映射关系
 */
const EMOJI_TO_ICON_MAPPING: Record<string, string> = {
  "🚩": "sign_2", // 红旗 -> 红色标志（模块节点）
  // ⭐ 不再映射到 sign_1，用例节点只通过 priority_* 标识
}

/**
 * 思维导图图标到Emoji的反向映射关系
 */
const ICON_TO_EMOJI_MAPPING: Record<string, string> = {
  sign_2: "🚩", // 红色标志 -> 红旗（模块节点）
}

/**
 * 优先级图标到优先级标记的映射关系
 */
const ICON_TO_PRIORITY_MAPPING: Record<string, string> = {
  priority_1: "P1",
  priority_2: "P2",
  priority_3: "P3",
}

/**
 * 从文本中提取emoji和优先级标记并转换为图标
 * @param text 包含emoji和优先级标记的文本
 * @returns { cleanText: string, icons: string[] }
 */
export const extractEmojisAndConvertToIcons = (
  text: string
): { cleanText: string; icons: string[] } => {
  const icons: string[] = []
  let cleanText = text

  // 1. 先处理优先级标记 P1/P2/P3
  const priorityMatches = cleanText.match(/\bP[123]\b/g)
  if (priorityMatches) {
    priorityMatches.forEach(match => {
      const priorityLevel = match.charAt(1) // 获取数字部分
      const priorityIcon = `priority_${priorityLevel}`

      if (!icons.includes(priorityIcon)) {
        icons.push(priorityIcon)
      }

      // 从文本中移除优先级标记
      cleanText = cleanText.replace(new RegExp(`\\b${match}\\b`, "g"), "").trim()
    })
  }

  // 2. 再处理emoji
  Object.keys(EMOJI_TO_ICON_MAPPING).forEach(emoji => {
    if (text.includes(emoji)) {
      const iconId = EMOJI_TO_ICON_MAPPING[emoji]
      if (iconId && !icons.includes(iconId)) {
        icons.push(iconId)
      }
      // 从文本中移除emoji
      cleanText = cleanText.replace(new RegExp(escapeRegExp(emoji), "g"), "").trim()
    }
  })

  // 3. 清理多余的空格和符号
  cleanText = cleanText
    .replace(/\s+/g, " ") // 合并多个空格为一个
    .replace(/^\s*[&\-\s]*\s*/, "") // 移除开头的&、-、空格等
    .replace(/\s*[&\-\s]*$/, "") // 移除结尾的&、-、空格等
    .trim() // 最终trim

  return { cleanText, icons }
}

/**
 * 转义正则表达式特殊字符
 * @param string 需要转义的字符串
 * @returns 转义后的字符串
 */
const escapeRegExp = (string: string): string => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/**
 * 将图标转换为emoji和优先级标记并添加到文本中
 * @param text 原始文本
 * @param icons 图标数组
 * @returns 包含emoji和优先级标记的文本
 */
const convertIconsToEmojiAndPriority = (text: string, icons: string[] = []): string => {
  const emojis: string[] = []
  const priorities: string[] = []

  // 转换图标为emoji和优先级标记
  icons.forEach(icon => {
    if (ICON_TO_EMOJI_MAPPING[icon]) {
      emojis.push(ICON_TO_EMOJI_MAPPING[icon])
    } else if (ICON_TO_PRIORITY_MAPPING[icon]) {
      priorities.push(ICON_TO_PRIORITY_MAPPING[icon])
    }
  })

  // 组合文本：优先级标记 + emoji + 文本
  const parts: string[] = []
  if (priorities.length > 0) {
    parts.push(...priorities)
  }
  if (emojis.length > 0) {
    parts.push(...emojis)
  }
  parts.push(text)

  return parts.join(" ").trim()
}

/**
 * 使用 simple-mind-map 库的原生类型
 */
export type { MindMapNodeTree as MindMapNodeTree }

/**
 * 生成唯一ID
 * @returns 唯一标识符
 */
export const generateUID = (): string => {
  return Math.random().toString(36).substring(2, 9) + Date.now().toString(36)
}

/**
 * 将Markdown字符串转换为思维导图数据
 * @param markdownContent Markdown内容字符串
 * @returns Promise<MindMapNodeTree> 转换后的思维导图数据
 */
export const convertMarkdownToMindMapNodeTree = async (
  markdownContent: string
): Promise<MindMapNodeTree> => {
  return parseMarkdownContent(markdownContent)
}

/**
 * 解析Markdown内容
 * @param markdownContent Markdown内容
 * @returns 解析后的思维导图数据
 */
const parseMarkdownContent = (markdownContent: string): MindMapNodeTree => {
  const lines = markdownContent.split("\n").filter(line => line.trim())

  if (lines.length === 0) {
    return {
      data: { text: "空文档", uid: generateUID(), expand: true, isActive: false, richText: false },
      children: [],
    }
  }

  const parseHeadingLevel = (line: string): number => {
    const match = line.match(/^(#+)\s/)
    return match ? match[1].length : 0
  }

  const rootNode: MindMapNodeTree = {
    data: {
      text: "Markdown导入",
      uid: generateUID(),
      expand: true,
      isActive: false,
      richText: false,
    },
    children: [],
  }

  const nodeStack: Array<{ node: MindMapNodeTree; level: number }> = [{ node: rootNode, level: 0 }]

  const createNode = (text: string): MindMapNodeTree => {
    const { cleanText, icons } = extractEmojisAndConvertToIcons(text)
    const node: MindMapNodeTree = {
      data: { text: cleanText, uid: generateUID(), expand: true, isActive: false, richText: false },
      children: [],
    }
    if (icons.length > 0) node.data.icon = icons
    return node
  }

  for (const line of lines) {
    const trimmedLine = line.trim()
    if (!trimmedLine) continue

    const headingLevel = parseHeadingLevel(trimmedLine)

    if (headingLevel > 0) {
      const text = trimmedLine.replace(/^#+\s*/, "")
      const newNode = createNode(text)

      while (nodeStack.length > 1 && nodeStack[nodeStack.length - 1].level >= headingLevel) {
        nodeStack.pop()
      }

      nodeStack[nodeStack.length - 1].node.children.push(newNode)
      nodeStack.push({ node: newNode, level: headingLevel })
    } else if (trimmedLine.startsWith("- ") || trimmedLine.startsWith("* ")) {
      const text = trimmedLine.replace(/^[-*]\s*/, "")
      const newNode = createNode(text)
      nodeStack[nodeStack.length - 1].node.children.push(newNode)
    } else {
      const newNode = createNode(trimmedLine)
      nodeStack[nodeStack.length - 1].node.children.push(newNode)
    }
  }

  return rootNode
}

/**
 * 解析Markdown文件
 * @param file Markdown文件对象
 * @returns Promise<MindMapNodeTree> 解析后的思维导图数据
 */
export const parseMarkdownFile = async (file: File): Promise<MindMapNodeTree> => {
  if (!file.name.toLowerCase().endsWith(".md")) {
    throw new Error("不支持的文件类型，请选择.md文件")
  }

  const content = await file.text()

  return await convertMarkdownToMindMapNodeTree(content)
}

/**
 * 将思维导图数据转换为Markdown字符串（包含图标信息）
 * @param mindMapData 思维导图数据
 * @returns Promise<string> Markdown字符串
 */
export const convertMindMapNodeTreeToMarkdown = async (
  mindMapData: MindMapNodeTree
): Promise<string> => {
  const exportNode = (node: MindMapNodeTree, level: number = 0): string => {
    const indent = "  ".repeat(level)
    const prefix = level === 0 ? "# " : "- "

    // 将图标转换为emoji和优先级标记，并添加到文本中
    const textWithIcons = convertIconsToEmojiAndPriority(node.data.text, node.data.icon)
    let result = `${indent}${prefix}${textWithIcons}\n`

    for (const child of node.children) {
      result += exportNode(child, level + 1)
    }

    return result
  }

  return exportNode(mindMapData)
}

/**
 * 将思维导图数据转换为带图标的Markdown字符串（新增的增强导出函数）
 * @param mindMapData 思维导图数据
 * @returns Promise<string> 包含图标信息的Markdown字符串
 */
export const convertMindMapNodeTreeToMarkdownWithIcons = async (
  mindMapData: MindMapNodeTree
): Promise<string> => {
  return convertMindMapNodeTreeToMarkdown(mindMapData)
}
