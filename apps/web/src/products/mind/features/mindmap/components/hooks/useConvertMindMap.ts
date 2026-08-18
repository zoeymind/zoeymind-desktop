import { useCallback, useEffect } from 'react'
import { logger } from '@zoeymind/logger'
import type { default as MindMap } from 'simple-mind-map'
import type { NodeData } from 'simple-mind-map'
import { i18next } from '@zoeymind/i18n'

// 飞书思维导图数据类型
interface FSNode {
  id: string
  text: Array<{ style?: { bold?: boolean }; text: string; type: number }>
  highlight?: string
  children: FSNode[]
  modified?: number
  collapsed?: boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 笔记样式对象结构复杂且动态
  note?: Array<{ style?: any; text: string; type: number }>
}

interface FSMindMap {
  type: string
  data: {
    nodes: FSNode[]
    theme: string
    structure: string
    globalLineStyle: string
  }
}

// 目标思维导图数据类型
interface MyNode {
  data: {
    text: string
    icon?: string[]
    expand: boolean
    isActive: boolean
  }
  children: MyNode[]
}

interface MyMindMap {
  simpleMindMap: boolean
  data: MyNode[]
}

type ExtendedRenderer = MindMap['renderer'] & {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 复制数据结构动态，包含节点树和各种属性
  beingCopyData?: any
}

// 样式映射常量
const ICON_TO_STYLE: Record<string, { isBold?: boolean; highlight?: string }> = {
  sign_2: { isBold: true },
  priority_1: { highlight: 'red' },
  priority_2: { highlight: 'yellow' },
  priority_3: { highlight: 'pink' }
}

const STYLE_TO_ICON: Record<string, string> = {
  bold: 'sign_2',
  red: 'priority_1',
  yellow: 'priority_2',
  pink: 'priority_3'
}

// sign_1 已废弃：用例节点只需 priority_* 图标即可标识

// 工具函数
const generateId = () =>
  Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)

const copyToClipboard = async (htmlContent: string, plainText: string, formatName: string) => {
  if (navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
    try {
      const clipboardItem = new ClipboardItem({
        'text/html': new Blob([htmlContent], { type: 'text/html' }),
        'text/plain': new Blob([plainText], { type: 'text/plain' })
      })
      await navigator.clipboard.write([clipboardItem])
      logger.info(`已复制${formatName}格式到剪贴板`)
    } catch (err) {
      logger.error(`${formatName}格式复制失败:`, err)
    }
  } else {
    logger.warn('浏览器不支持 Clipboard API 写入 text/html')
  }
}

// 解析纯文本为节点数组
const parseTextToNodes = (text: string): NodeData[] => {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(line => ({
      data: { text: line, expand: true },
      children: []
    }))
}

export const useConvertMindMap = (mindMap?: MindMap | null) => {
  // 飞书格式转换为目标格式
  const convertFsToMyNode = useCallback((node: FSNode): MyNode => {
    const text = node.text?.map(t => t.text).join('') || ''
    const icons: string[] = []

    // 检查样式并转换为图标
    if (node.text?.some(t => t.style?.bold)) {
      icons.push(STYLE_TO_ICON.bold)
    }

    if (node.highlight && STYLE_TO_ICON[node.highlight]) {
      icons.push(STYLE_TO_ICON[node.highlight])
    }

    return {
      data: {
        text,
        expand: true,
        isActive: true,
        ...(icons.length > 0 && { icon: icons })
      },
      children: node.children?.map(child => convertFsToMyNode(child)) || []
    }
  }, [])

  // 目标格式转换为飞书格式 - 完整修复版本
  const convertMyToFsNode = useCallback((node: MyNode): FSNode => {
    const icons = new Set(node.data.icon || [])
    let highlight: string | undefined
    let isBold = false

    // 解析图标为样式
    icons.forEach(icon => {
      const style = ICON_TO_STYLE[icon]
      if (style) {
        if (style.isBold) isBold = true
        if (style.highlight) highlight = style.highlight
      }
    })

    const fsNode: FSNode = {
      id: generateId(),
      text: [
        {
          text: node.data.text,
          type: 1,
          style: isBold ? { bold: true } : {}
        }
      ],
      modified: Date.now(),
      children: node.children?.map(child => convertMyToFsNode(child)) || []
    }

    // 添加 collapsed 属性（只有有子节点的节点才需要）
    if (node.children && node.children.length > 0) {
      fsNode.collapsed = true
    }

    // 添加 highlight 属性
    if (highlight) {
      fsNode.highlight = highlight
    }

    return fsNode
  }, [])

  // 生成飞书 HTML 结构的辅助函数
  const generateFsHtmlStructure = useCallback((nodes: FSNode[]): string => {
    return nodes
      .map(node => {
        let html = '<li>'

        // 生成节点内容
        const classes = ['content', 'mubu-node']
        if (node.collapsed) classes.push('collapsed')
        if (node.highlight) classes.push(`highlight-${node.highlight}`)

        html += `<span class="${classes.join(' ')}">`

        // 处理文本样式
        if (node.text?.[0]?.style?.bold) {
          html += `<span class="bold">${node.text[0].text}</span>`
        } else {
          html += `<span>${node.text?.[0]?.text || ''}</span>`
        }

        html += '</span><br />'

        // 处理子节点
        if (node.children && node.children.length > 0) {
          node.children.forEach(child => {
            html += '<ul class="children">'
            html += generateFsHtmlStructure([child])
            html += '</ul>'
          })
        }

        html += '</li>'
        return html
      })
      .join('')
  }, [])

  // 格式转换
  const convertMyToFs = useCallback(
    (myData: MyMindMap): FSMindMap => ({
      type: 'define',
      data: {
        nodes: myData.data.map(convertMyToFsNode),
        theme: 'classic',
        structure: 'right',
        globalLineStyle: 'polyline'
      }
    }),
    [convertMyToFsNode]
  )

  const convertFsToMy = useCallback(
    (fsData: FSMindMap): MyMindMap => ({
      simpleMindMap: true,
      data: (fsData.data.nodes || []).map(convertFsToMyNode)
    }),
    [convertFsToMyNode]
  )

  // 复制飞书格式到剪贴板 - 完整修复版本
  const copyFsDataToClipboard = useCallback(
    async (fsData: FSMindMap) => {
      const jsonStr = encodeURIComponent(JSON.stringify(fsData))

      // 生成完整的 HTML 结构，与飞书格式保持一致
      const htmlStructure = generateFsHtmlStructure(fsData.data.nodes)
      const htmlContent = `<meta charset='utf-8'><ul class="mm-editor-clipboard" data-type="minder" data-json="${jsonStr}">${htmlStructure}&nbsp;</ul>`

      const plainText = JSON.stringify(fsData)
      await copyToClipboard(htmlContent, plainText, '飞书')
    },
    [generateFsHtmlStructure]
  )

  // 获取节点文本的通用函数
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 节点数据结构在不同格式间差异很大，使用any保证兼容性
  const getNodeText = (node: any): string => {
    if (node?.data?.text) return node.data.text
    if (node?.nodeData?.data?.text) return node.nodeData.data.text
    if (node?.text && Array.isArray(node.text)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 文本对象结构动态
      return node.text.map((t: any) => t.text || '').join('')
    }
    logger.warn('未能识别的节点格式:', node)
    return i18next.t('mindmap.toast.unnamedNode')
  }

  // 递归处理XMind节点
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- XMind节点结构复杂且版本间有差异
  const processXMindNode = useCallback((node: any): { text: string; children: any[] } => {
    const text = getNodeText(node)
    const childrenArray = node?.children || node?.nodeData?.children || []
    const children = Array.isArray(childrenArray) ? childrenArray.map(processXMindNode) : []

    return { text, children }
  }, [])

  // 构建XMind HTML结构
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 子节点数组结构动态
  const buildXMindHtml = (node: { text: string; children: any[] }): string => {
    let html = `<ul><li><p>${node.text}</p>`

    if (node.children?.length > 0) {
      html += '<ul>'
      node.children.forEach(child => {
        html += `<li><p>${child.text}</p>`
        if (child.children?.length > 0) {
          html += buildXMindHtml({ text: '', children: child.children })
        }
        html += '</li>'
      })
      html += '</ul>'
    }

    return `${html}</li></ul>`
  }

  // 构建纯文本格式
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 子节点数组结构动态
  const buildPlainText = (node: { text: string; children: any[] }, level = 0): string => {
    let text = node.text

    if (node.children?.length > 0) {
      text += `\n${node.children
        .map(child => {
          let childText = '\t'.repeat(level + 1) + child.text
          if (child.children?.length > 0) {
            childText += `\n${child.children
              // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 孙子节点结构动态
              .map((grandChild: any) => '\t'.repeat(level + 2) + grandChild.text)
              .join('\n')}`
          }
          return childText
        })
        .join('\n')}`
    }

    return text
  }

  // 复制XMind格式到剪贴板 - 支持多个节点
  const copyXMindDataToClipboard = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 复制数据可能是单个节点或节点数组
    async (data: any) => {
      try {
        logger.info('要复制的数据:', data)

        // 处理多个节点的情况
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 处理后的数据子节点结构动态
        let processedData: { text: string; children: any[] }

        if (Array.isArray(data)) {
          // 多个节点：创建一个虚拟根节点包含所有节点
          processedData = {
            text: '',
            children: data.map(processXMindNode)
          }
        } else {
          // 单个节点：直接处理
          processedData = processXMindNode(data)
        }

        logger.info('处理后的数据:', processedData)

        const fragmentId = `${Date.now()}-${Math.floor(Math.random() * 10000)}`

        // 构建HTML：如果是多个节点，直接输出子节点列表
        let htmlStructure: string
        if (Array.isArray(data) && processedData.children.length > 0) {
          // 多个节点：直接构建子节点的HTML
          htmlStructure = `<ul>${processedData.children
            .map(
              child =>
                `<li><p>${child.text}</p>${child.children?.length > 0 ? buildXMindHtml({ text: '', children: child.children }) : ''}</li>`
            )
            .join('')}</ul>`
        } else {
          // 单个节点：使用原有逻辑
          htmlStructure = buildXMindHtml(processedData)
        }

        const htmlContent = `<meta charset='utf-8'><div xmind-vk-document-fragment-id="${fragmentId}">${htmlStructure}</div>`
        const plainText = buildPlainText(processedData)

        await copyToClipboard(htmlContent, plainText, 'XMind')
      } catch (error) {
        logger.error('复制XMind格式失败:', error)
      }
    },
    [processXMindNode]
  )

  // 解析XMind HTML结构
  const parseXMindHtml = (element: Element): NodeData[] => {
    const result: NodeData[] = []

    const processLiElement = (li: Element): NodeData => {
      const pElement = li.querySelector('p')
      const text = pElement?.textContent || ''

      const nodeData: NodeData = {
        data: { text, expand: true },
        children: []
      }

      const childUl = li.querySelector(':scope > ul')
      if (childUl) {
        const childLiElements = childUl.querySelectorAll(':scope > li')
        nodeData.children = Array.from(childLiElements).map(processLiElement)
      }

      return nodeData
    }

    const ulElements = element.querySelectorAll(':scope > ul')
    ulElements.forEach(ul => {
      const liElements = ul.querySelectorAll(':scope > li')
      liElements.forEach(li => {
        result.push(processLiElement(li))
      })
    })

    return result
  }

  // 拦截复制事件
  const interceptCopy = useCallback(() => {
    if (!mindMap?.renderer) return

    const originalCopy = mindMap.renderer.copy as () => void
    mindMap.renderer.copy = function () {
      originalCopy.call(this)

      const renderer = this as ExtendedRenderer
      if (renderer.beingCopyData) {
        try {
          const fsData = convertMyToFs({ simpleMindMap: true, data: renderer.beingCopyData })
          copyFsDataToClipboard(fsData)
        } catch (error) {
          logger.error('转换并复制思维导图数据失败:', error)
        }
      }
    }
  }, [mindMap, convertMyToFs, copyFsDataToClipboard])

  // 拦截粘贴事件
  const interceptPaste = useCallback(() => {
    if (!mindMap?.renderer) return

    const originalPaste = mindMap.renderer.paste as () => void
    mindMap.renderer.paste = async function () {
      try {
        if (!navigator.clipboard?.read) {
          originalPaste.call(this)
          return
        }

        const clipboardItems = await navigator.clipboard.read()
        let htmlContent = ''

        // 获取HTML内容
        for (const item of clipboardItems) {
          if (item.types.includes('text/html')) {
            const blob = await item.getType('text/html')
            htmlContent = await blob.text()
            break
          }
        }

        // 处理飞书格式
        if (htmlContent.includes('mm-editor-clipboard')) {
          const match = htmlContent.match(/data-json="([^"]+)"/)
          if (match?.[1]) {
            const jsonStr = decodeURIComponent(match[1])
            const fsData = JSON.parse(jsonStr)
            const myData = convertFsToMy(fsData)
            mindMap.execCommand('INSERT_MULTI_CHILD_NODE', [], myData.data)
            logger.info('成功粘贴飞书格式')
            return
          }
        }

        // 处理XMind格式
        if (htmlContent.includes('xmind-vk-document-fragment-id')) {
          logger.info('检测到XMind格式HTML:', htmlContent)

          try {
            const parser = new DOMParser()
            const doc = parser.parseFromString(htmlContent, 'text/html')
            const xmindElement = doc.querySelector('[xmind-vk-document-fragment-id]')

            if (xmindElement) {
              const parsedData = parseXMindHtml(xmindElement)
              logger.info('解析后的XMind数据:', parsedData)

              if (parsedData.length > 0) {
                mindMap.execCommand('INSERT_MULTI_CHILD_NODE', [], parsedData)
                logger.info('成功粘贴XMind格式')
                return
              }
            }
          } catch (error) {
            logger.error('解析XMind格式失败:', error)
          }
        }

        // 处理纯文本格式 - 按换行拆分成多个节点
        let plainText = ''
        for (const item of clipboardItems) {
          if (item.types.includes('text/plain')) {
            const blob = await item.getType('text/plain')
            plainText = await blob.text()
            break
          }
        }

        if (plainText.trim() && plainText.includes('\n')) {
          logger.info('检测到多行纯文本:', plainText)
          try {
            const parsedNodes = parseTextToNodes(plainText)
            if (parsedNodes.length > 1) {
              mindMap.execCommand('INSERT_MULTI_CHILD_NODE', [], parsedNodes)
              logger.info('成功粘贴纯文本格式，共', parsedNodes.length, '个节点')
              return
            }
          } catch (error) {
            logger.error('解析纯文本格式失败:', error)
          }
        }

        // 默认处理
        originalPaste.call(this)
      } catch (error) {
        logger.error('处理粘贴事件失败:', error)
        originalPaste.call(this)
      }
    }
  }, [mindMap, convertFsToMy])

  useEffect(() => {
    if (mindMap) {
      interceptCopy()
      interceptPaste()
    }
  }, [mindMap, interceptCopy, interceptPaste])

  return {
    convertFsToMy,
    convertMyToFs,
    convertFsToMyNode,
    convertMyToFsNode,
    copyXMindDataToClipboard
  }
}

export default useConvertMindMap
