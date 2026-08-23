// @ts-nocheck — vendored engine source
import JSZip from 'jszip'
import xmlConvert from 'xml-js'
import { isUndef } from '../utils/index'
import {
  getSummaryText,
  getSummaryText2,
  getRoot,
  getItemByName,
  getElementsByType,
  addSummaryData,
  handleNodeImageFromXmind
} from '../utils/xmind'
import { transformToXmind } from './xmind-export'
//  解析.xmind文件
const parseXmindFile = (file, handleMultiCanvas) => {
  return new Promise((resolve, reject) => {
    JSZip.loadAsync(file).then(
      async zip => {
        try {
          let content: Record<string, unknown> | null = null
          let jsonFile = zip.files['content.json']
          let xmlFile = zip.files['content.xml'] || zip.files['/content.xml']
          if (jsonFile) {
            let json = await jsonFile.async('string')
            content = await transformXmind(json, zip.files, handleMultiCanvas)
          } else if (xmlFile) {
            let xml = await xmlFile.async('string')
            let json = xmlConvert.xml2json(xml)
            content = transformOldXmind(json)
          }
          if (content) {
            resolve(content)
          } else {
            reject(new Error('解析失败'))
          }
        } catch (error) {
          reject(error)
        }
      },
      e => {
        reject(e)
      }
    )
  })
}
//  转换xmind数据
const transformXmind = async (content, files, handleMultiCanvas) => {
  content = JSON.parse(content)
  let data = null
  if (content.length > 1 && typeof handleMultiCanvas === 'function') {
    data = await handleMultiCanvas(content)
  }
  if (!data) {
    data = content[0]
  }
  const nodeTree = data.rootTopic
  const newTree = {}
  const waitLoadImageList = []
  const walk = async (node, newNode) => {
    newNode.data = {
      // 节点内容
      text: isUndef(node.title) ? '' : node.title
    }
    // 节点备注
    if (node.notes) {
      const notesData = node.notes.realHTML || node.notes.plain
      newNode.data.note = notesData ? notesData.content || '' : ''
    }
    // 超链接
    if (node.href && /^https?:\/\//.test(node.href)) {
      newNode.data.hyperlink = node.href
    }
    // 标签
    if (node.labels && node.labels.length > 0) {
      newNode.data.tag = node.labels
    }
    // 图片
    handleNodeImageFromXmind(node, newNode, waitLoadImageList, files)
    // 概要
    const selfSummary = []
    const childrenSummary = []
    if (newNode._summary) {
      selfSummary.push(newNode._summary)
    }
    if (Array.isArray(node.summaries) && node.summaries.length > 0) {
      node.summaries.forEach(item => {
        addSummaryData(
          selfSummary,
          childrenSummary,
          () => {
            return getSummaryText(node, item.topicId)
          },
          item.range
        )
      })
    }
    newNode.data.generalization = selfSummary
    // 子节点
    newNode.children = []
    if (node.children && node.children.attached && node.children.attached.length > 0) {
      node.children.attached.forEach((item, index) => {
        const newChild: Record<string, unknown> = {}
        newNode.children.push(newChild)
        if (childrenSummary[index]) {
          newChild._summary = childrenSummary[index]
        }
        walk(item, newChild)
      })
    }
  }
  walk(nodeTree, newTree)
  await Promise.all(waitLoadImageList)
  return newTree
}
//  转换旧版xmind数据，xmind8
const transformOldXmind = content => {
  const data = JSON.parse(content)
  const elements = data.elements
  const root = getRoot(elements)
  const newTree = {}
  const walk = (node, newNode) => {
    const nodeElements = node.elements
    let nodeTitle = getItemByName(nodeElements, 'title')
    nodeTitle = nodeTitle && nodeTitle.elements && nodeTitle.elements[0].text
    // 节点内容
    newNode.data = {
      text: isUndef(nodeTitle) ? '' : nodeTitle
    }
    // 节点备注
    try {
      const notesElement = getItemByName(nodeElements, 'notes')
      if (notesElement) {
        newNode.data.note = notesElement.elements[0].elements[0].elements[0].text
      }
    } catch (error) {
      console.log(error)
    }
    // 超链接
    try {
      if (
        node.attributes &&
        node.attributes['xlink:href'] &&
        /^https?:\/\//.test(node.attributes['xlink:href'])
      ) {
        newNode.data.hyperlink = node.attributes['xlink:href']
      }
    } catch (error) {
      console.log(error)
    }
    // 标签
    try {
      const labelsElement = getItemByName(nodeElements, 'labels')
      if (labelsElement) {
        newNode.data.tag = labelsElement.elements.map(item => {
          return item.elements[0].text
        })
      }
    } catch (error) {
      console.log(error)
    }
    const childrenItem = getItemByName(nodeElements, 'children')
    // 概要
    const selfSummary = []
    const childrenSummary = []
    try {
      if (newNode._summary) {
        selfSummary.push(newNode._summary)
      }
      const summariesItem = getItemByName(nodeElements, 'summaries')
      if (
        summariesItem &&
        Array.isArray(summariesItem.elements) &&
        summariesItem.elements.length > 0
      ) {
        summariesItem.elements.forEach(item => {
          addSummaryData(
            selfSummary,
            childrenSummary,
            () => {
              return getSummaryText2(childrenItem, item.attributes['topic-id'])
            },
            item.attributes.range
          )
        })
      }
    } catch (error) {
      console.log(error)
    }
    newNode.data.generalization = selfSummary
    // 子节点
    newNode.children = []
    if (childrenItem && childrenItem.elements && childrenItem.elements.length > 0) {
      const children = getElementsByType(childrenItem.elements, 'attached')
      ;(children || []).forEach((item, index) => {
        const newChild: Record<string, unknown> = {}
        newNode.children.push(newChild)
        if (childrenSummary[index]) {
          newChild._summary = childrenSummary[index]
        }
        walk(item, newChild)
      })
    }
  }
  walk(root, newTree)
  return newTree
}
export default {
  parseXmindFile,
  transformXmind,
  transformOldXmind,
  transformToXmind
}
