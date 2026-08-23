// @ts-nocheck — vendored engine source
import JSZip from 'jszip'
import { getTextFromHtml } from '../utils/index'
import {
  handleNodeImageToXmind,
  getXmindContentXmlData,
  parseNodeGeneralizationToXmind
} from '../utils/xmind'

// 数据转换为xmind文件
// 直接转换为最新版本的xmind文件 2023.09.11172
export const transformToXmind = async (data, name) => {
  const id = 'simpleMindMap_' + Date.now()
  const imageList = []
  // 转换核心数据
  let newTree: Record<string, unknown> = {}
  let waitLoadImageList = []
  let walk = async (node, newNode, isRoot) => {
    let newData: Record<string, unknown> = {
      id: node.data.uid,
      structureClass: 'org.xmind.ui.logic.right',
      title: getTextFromHtml(node.data.text),
      children: {
        attached: []
      }
    }
    // 备注
    if (node.data.note !== undefined) {
      newData.notes = {
        realHTML: {
          content: node.data.note
        },
        plain: {
          content: node.data.note
        }
      }
    }
    // 超链接
    if (node.data.hyperlink !== undefined) {
      newData.href = node.data.hyperlink
    }
    // 标签
    if (node.data.tag !== undefined) {
      newData.labels = (node.data.tag || []).map(item => {
        return typeof item === 'object' && item !== null ? item.text : item
      })
    }
    // 图片
    handleNodeImageToXmind(node, newData, waitLoadImageList, imageList)
    // 图标/标记
    if (node.data.icon !== undefined && node.data.icon.length > 0) {
      const iconToMarkerId = icon => {
        // priority_N → priority-N（import 的反向映射）
        if (/^priority_\d+$/.test(icon)) return icon.replace('_', '-')
        // sign_2 → flag-yellow（import 的 flag-* → sign_2 反向）
        if (icon === 'sign_2') return 'flag-yellow'
        // 其他图标保持原样（XMind.app 可显示，但 import 时会丢弃）
        return icon
      }
      newData.markers = node.data.icon.map(icon => ({
        markerId: iconToMarkerId(icon)
      }))
    }
    // 样式
    // 暂时不考虑样式
    if (isRoot) {
      newData.class = 'topic'
      newNode.id = id
      newNode.class = 'sheet'
      newNode.title = name
      newNode.extensions = []
      newNode.topicPositioning = 'fixed'
      newNode.topicOverlapping = 'overlap'
      newNode.coreVersion = '2.100.0'
      newNode.rootTopic = newData
    } else {
      Object.keys(newData).forEach(key => {
        newNode[key] = newData[key]
      })
    }
    // 概要
    const { summary, summaries } = parseNodeGeneralizationToXmind(node)
    if (isRoot) {
      if (summaries.length > 0) {
        newNode.rootTopic.children.summary = summary
        newNode.rootTopic.summaries = summaries
      }
    } else {
      if (summaries.length > 0) {
        newNode.children.summary = summary
        newNode.summaries = summaries
      }
    }
    // 子节点
    if (node.children && node.children.length > 0) {
      node.children.forEach(child => {
        let newChild: Record<string, unknown> = {}
        walk(child, newChild, false)
        const children = newData.children as { attached: unknown[] }
        children.attached.push(newChild)
      })
    }
  }
  walk(data, newTree, true)
  await Promise.all(waitLoadImageList)
  const contentData = [newTree]
  // 创建压缩包
  const zip = new JSZip()
  zip.file('content.json', JSON.stringify(contentData))
  zip.file(
    'metadata.json',
    `{"modifier":"","dataStructureVersion":"2","creator":{"name":"mind-map"},"layoutEngineVersion":"3","activeSheetId":"${id}"}`
  )
  zip.file('content.xml', getXmindContentXmlData())
  const manifestData = {
    'file-entries': {
      'content.json': {},
      'metadata.json': {},
      'Thumbnails/thumbnail.png': {}
    }
  }
  // 图片
  if (imageList.length > 0) {
    imageList.forEach(item => {
      manifestData['file-entries']['resources/' + item.name] = {}
      const img = zip.folder('resources')
      img.file(item.name, item.data, { base64: true })
    })
  }
  zip.file('manifest.json', JSON.stringify(manifestData))
  const zipData = await zip.generateAsync({ type: 'blob' })
  return zipData
}
