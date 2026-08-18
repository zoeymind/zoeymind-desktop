// @ts-nocheck — vendored engine source
import {
  imgToDataUrl,
  downloadFile,
  readBlob,
  removeHTMLEntities,
  resizeImgSize,
  handleSelfCloseTags,
  addXmlns
} from '../utils'
import { SVG, G } from '@svgdotjs/svg.js'
import type { Element } from '@svgdotjs/svg.js'
import drawBackgroundImageToCanvas from '../utils/simulateCSSBackgroundInCanvas'
import { transformToMarkdown } from '../parse/toMarkdown'
import { ERROR_TYPES } from '../constants/constant'
import { transformToTxt } from '../parse/toTxt'

//  导出插件
class Export {
  declare static instanceName: string
  declare mindMap

  //  构造函数
  constructor(opt: { mindMap: Record<string, unknown> }) {
    this.mindMap = opt.mindMap
  }

  //  导出
  async export(type: string, isDownload = true, name = '思维导图', ...args: unknown[]) {
    if (this[type as keyof Export]) {
      const result = await (this[type as keyof Export] as (...a: unknown[]) => unknown)(
        name,
        ...args
      )
      if (isDownload) {
        downloadFile(result as string, name + '.' + type)
      }
      return result
    } else {
      return null
    }
  }

  // 创建图片url转换任务
  createTransformImgTaskList(svg, tagName: string, propName: string, getUrlFn) {
    const imageList = svg.find(tagName)
    return imageList.map(async item => {
      const imgUlr = getUrlFn(item)
      // 已经是data:URL形式不用转换
      if (/^data:/.test(imgUlr) || imgUlr === 'none') {
        return
      }
      const imgData = await imgToDataUrl(imgUlr)
      item.attr(propName, imgData)
    })
  }

  //  获取svg数据
  async getSvgData(node?: Record<string, unknown>) {
    const opt = this.mindMap.opt as Record<string, unknown>
    let {
      exportPaddingX = 0,
      exportPaddingY = 0,
      errorHandler = () => {},
      resetCss = '',
      addContentToHeader = '',
      addContentToFooter = '',
      handleBeingExportSvg
    } = opt
    const svgData = this.mindMap.getSvgData({
      paddingX: exportPaddingX,
      paddingY: exportPaddingY,
      addContentToHeader,
      addContentToFooter,
      node
    }) as { svg: G; svgHTML: string; clipData: Record<string, unknown> | null }
    let { svg, svgHTML, clipData } = svgData
    if (clipData) {
      clipData.paddingX = exportPaddingX
      clipData.paddingY = exportPaddingY
    }
    let svgIsChange = false
    // svg的image标签，把图片的url转换成data:url类型，否则导出会丢失图片
    const task1 = this.createTransformImgTaskList(svg, 'image', 'href', item => {
      return item.attr('href') || item.attr('xlink:href')
    })
    // html的img标签
    const task2 = this.createTransformImgTaskList(svg, 'img', 'src', item => {
      return item.attr('src')
    })
    const taskList = [...task1, ...task2]
    try {
      await Promise.all(taskList)
    } catch (error) {
      ;(errorHandler as (type: string, err: unknown) => void)(
        ERROR_TYPES.EXPORT_LOAD_IMAGE_ERROR,
        error
      )
    }
    // 开启了节点富文本编辑，需要增加一些样式
    if ((this.mindMap as Record<string, unknown>).richText) {
      const foreignObjectList = svg.find('foreignObject')
      if (foreignObjectList.length > 0) {
        foreignObjectList[0].add(SVG(`<style>${resetCss}</style>`))
        svgIsChange = true
      }
      // 如果还开启了数学公式，还要插入katex库的样式
      const formulaPlugin = (this.mindMap as Record<string, unknown>).formula as Record<
        string,
        unknown
      >
      if (formulaPlugin) {
        const formulaList = svg.find('.ql-formula')
        if (formulaList.length > 0) {
          const styleText = (formulaPlugin.getStyleText as () => string)()
          if (styleText) {
            const styleEl = document.createElement('style')
            styleEl.innerHTML = styleText
            addXmlns(styleEl)
            foreignObjectList[0].add(styleEl as unknown as Element)
            svgIsChange = true
          }
        }
      }
    }
    // 自定义处理svg的方法
    if (typeof handleBeingExportSvg === 'function') {
      svgIsChange = true
      svg = (handleBeingExportSvg as (svg: G) => G)(svg)
    }
    // svg节点内容有变，需要重新获取html字符串
    if (taskList.length > 0 || svgIsChange) {
      svgHTML = svg.svg()
    }
    return {
      node: svg,
      str: svgHTML,
      clipData
    }
  }

  //   svg转png
  svgToPng(
    svgSrc: string,
    transparent: boolean,
    clipData: Record<string, unknown> | null = null,
    fitBg = false,
    format = 'image/png'
  ) {
    const opt = this.mindMap.opt as Record<string, unknown>
    const { maxCanvasSize, minExportImgCanvasScale } = opt
    const { promise, resolve, reject } = Promise.withResolvers<string>()
    const img = new Image()
    // 跨域图片需要添加这个属性，否则画布被污染了无法导出图片
    img.setAttribute('crossOrigin', 'anonymous')
    img.onload = async () => {
      try {
        const canvas = document.createElement('canvas')
        const dpr = Math.max(window.devicePixelRatio, minExportImgCanvasScale as number)
        // 图片原始大小
        let imgWidth = img.width
        let imgHeight = img.height
        // 如果是裁减操作的话，那么需要手动添加内边距，及调整图片大小为实际的裁减区域的大小，不要忘了内边距哦
        let paddingX = 0
        let paddingY = 0
        if (clipData) {
          paddingX = clipData.paddingX as number
          paddingY = clipData.paddingY as number
          imgWidth = (clipData.width as number) + paddingX * 2
          imgHeight = (clipData.height as number) + paddingY * 2
        }
        // 适配背景图片的大小
        let fitBgImgWidth = 0
        let fitBgImgHeight = 0
        const { backgroundImage } = this.mindMap.themeConfig as Record<string, unknown>
        if (fitBg && backgroundImage && !transparent) {
          const bgImgSize: [number, number] | null = (await new Promise(resolveSize => {
            const bgImg = new Image()
            bgImg.onload = () => {
              resolveSize([bgImg.width, bgImg.height])
            }
            bgImg.onerror = () => {
              resolveSize(null)
            }
            bgImg.src = backgroundImage as string
          })) as [number, number] | null
          if (bgImgSize) {
            const imgRatio = imgWidth / imgHeight
            const bgRatio = bgImgSize[0] / bgImgSize[1]
            if (imgRatio > bgRatio) {
              fitBgImgWidth = imgWidth
              fitBgImgHeight = imgWidth / bgRatio
            } else {
              fitBgImgHeight = imgHeight
              fitBgImgWidth = imgHeight * bgRatio
            }
          }
        }
        // 检查是否超出canvas支持的像素上限
        // canvas大小需要乘以dpr
        let scaleX = 1
        let scaleY = 1
        let canvasWidth = (fitBgImgWidth || imgWidth) * dpr
        let canvasHeight = (fitBgImgHeight || imgHeight) * dpr
        if (canvasWidth > (maxCanvasSize as number) || canvasHeight > (maxCanvasSize as number)) {
          let newWidth: number | null = null
          let newHeight: number | null = null
          if (canvasWidth > (maxCanvasSize as number)) {
            // 如果宽度超出限制，那么调整为上限值
            newWidth = maxCanvasSize as number
          } else if (canvasHeight > (maxCanvasSize as number)) {
            // 高度同理
            newHeight = maxCanvasSize as number
          }
          // 计算缩放后的宽高
          const res = resizeImgSize(canvasWidth, canvasHeight, newWidth, newHeight)
          scaleX = res[0] / canvasWidth
          scaleY = res[1] / canvasHeight
          canvasWidth = res[0]
          canvasHeight = res[1]
        }
        canvas.width = canvasWidth
        canvas.height = canvasHeight
        const styleWidth = canvasWidth / dpr
        const styleHeight = canvasHeight / dpr
        // canvas元素实际上的大小
        canvas.style.width = styleWidth + 'px'
        canvas.style.height = styleHeight + 'px'
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.scale(dpr, dpr)
          // 绘制背景
          if (!transparent) {
            await this.drawBackgroundToCanvas(ctx, styleWidth, styleHeight)
          }
          // 图片绘制到canvas里
          // 如果有裁减数据，那么需要进行裁减
          const fitBgLeft = (fitBgImgWidth > 0 ? (fitBgImgWidth - imgWidth) / 2 : 0) * scaleX
          const fitBgTop = (fitBgImgHeight > 0 ? (fitBgImgHeight - imgHeight) / 2 : 0) * scaleY
          if (clipData) {
            ctx.drawImage(
              img,
              clipData.left as number,
              clipData.top as number,
              clipData.width as number,
              clipData.height as number,
              paddingX * scaleX + fitBgLeft,
              paddingY * scaleY + fitBgTop,
              (clipData.width as number) * scaleX,
              (clipData.height as number) * scaleY
            )
          } else {
            ctx.drawImage(img, fitBgLeft, fitBgTop, imgWidth * scaleX, imgHeight * scaleY)
          }
        }
        resolve(canvas.toDataURL(format))
      } catch (error) {
        reject(error as Error)
      }
    }
    img.onerror = (e: string | Event) => {
      reject(e as unknown as Error)
    }
    img.src = svgSrc
    return promise
  }

  //  在canvas上绘制思维导图背景
  drawBackgroundToCanvas(ctx: CanvasRenderingContext2D, width: number, height: number) {
    const { promise, resolve, reject } = Promise.withResolvers<void>()
    const themeConfig = this.mindMap.themeConfig as Record<string, unknown>
    const {
      backgroundColor = '#fff',
      backgroundImage,
      backgroundRepeat = 'no-repeat',
      backgroundPosition = 'center center',
      backgroundSize = 'cover'
    } = themeConfig
    // 背景颜色
    ctx.save()
    ctx.rect(0, 0, width, height)
    ctx.fillStyle = backgroundColor as string
    ctx.fill()
    ctx.restore()
    // 背景图片
    if (backgroundImage && backgroundImage !== 'none') {
      ctx.save()
      drawBackgroundImageToCanvas(
        ctx,
        width,
        height,
        backgroundImage as string,
        {
          backgroundRepeat: backgroundRepeat as string,
          backgroundPosition: backgroundPosition as string,
          backgroundSize: backgroundSize as string
        },
        (err?: unknown) => {
          if (err) {
            reject(err as Error)
          } else {
            resolve()
          }
          ctx.restore()
        }
      )
    } else {
      resolve()
    }
    return promise
  }

  //  在svg上绘制思维导图背景
  drawBackgroundToSvg(svg) {
    const { promise, resolve } = Promise.withResolvers<void>()
    const themeConfig = this.mindMap.themeConfig as Record<string, unknown>
    const { backgroundColor = '#fff', backgroundImage, backgroundRepeat = 'repeat' } = themeConfig
    // 背景颜色
    svg.css('background-color', backgroundColor as string)
    // 背景图片
    if (backgroundImage && backgroundImage !== 'none') {
      imgToDataUrl(backgroundImage as string).then(imgDataUrl => {
        svg.css('background-image', `url(${imgDataUrl})`)
        svg.css('background-repeat', backgroundRepeat as string)
        resolve()
      })
    } else {
      resolve()
    }
    return promise
  }

  // 导出为指定格式的图片
  async _image(
    format: string,
    name: string,
    transparent = false,
    node: Record<string, unknown> | null = null,
    fitBg = false
  ) {
    const renderer = this.mindMap.renderer as Record<string, unknown>
    const textEdit = renderer.textEdit as Record<string, unknown>
    ;(textEdit.hideEditTextBox as () => void)()
    this.handleNodeExport(node)
    const { str, clipData } = await this.getSvgData(node || undefined)
    const svgUrl = await this.fixSvgStrAndToBlob(str as string)
    const res = await this.svgToPng(
      svgUrl as string,
      transparent,
      clipData as Record<string, unknown> | null,
      fitBg,
      format
    )
    return res
  }

  //  导出为png
  async png(...args: unknown[]) {
    const firstArg = args[0] as string
    const secondArg = args[1] as boolean | undefined
    const thirdArg = args[2] as Record<string, unknown> | null | undefined
    const fourthArg = args[3] as boolean | undefined
    const res = await this._image(
      'image/png',
      firstArg,
      secondArg ?? false,
      thirdArg ?? null,
      fourthArg ?? false
    )
    return res
  }

  // 导出为jpg
  async jpg(...args: unknown[]) {
    const firstArg = args[0] as string
    const secondArg = args[1] as boolean | undefined
    const thirdArg = args[2] as Record<string, unknown> | null | undefined
    const fourthArg = args[3] as boolean | undefined
    const res = await this._image(
      'image/jpg',
      firstArg,
      secondArg ?? false,
      thirdArg ?? null,
      fourthArg ?? false
    )
    return res
  }

  // 导出指定节点，如果该节点是激活状态，那么取消激活和隐藏展开收起按钮
  handleNodeExport(node: Record<string, unknown> | null) {
    if (node && (node.getData as (key: string) => boolean)('isActive')) {
      ;(node.deactivate as () => void)()
      const opt = this.mindMap.opt as Record<string, unknown>
      const { alwaysShowExpandBtn, notShowExpandBtn } = opt
      if (
        !alwaysShowExpandBtn &&
        !notShowExpandBtn &&
        (node.getData as (key: string) => boolean)('expand')
      ) {
        ;(node.removeExpandBtn as () => void)()
      }
    }
  }

  //  导出为pdf
  async pdf(name: string, transparent = false, fitBg = false) {
    const doExportPDF = (this.mindMap as Record<string, unknown>).doExportPDF as Record<
      string,
      unknown
    >
    if (!doExportPDF) {
      throw new Error('请注册ExportPDF插件')
    }
    const img = await this.png(name, transparent, null, fitBg)
    const res = await (doExportPDF.pdf as (img: string) => Promise<string>)(img)
    return res
  }

  // 导出为xmind
  async xmind(name: string) {
    const doExportXMind = (this.mindMap as Record<string, unknown>).doExportXMind as Record<
      string,
      unknown
    >
    if (!doExportXMind) {
      throw new Error('请注册ExportXMind插件')
    }
    const data = this.mindMap.getData() as Record<string, unknown>
    const blob = await (
      doExportXMind.xmind as (data: Record<string, unknown>, name: string) => Promise<Blob>
    )(data, name)
    const res = await readBlob(blob)
    return res
  }

  //  导出为svg
  async svg(name: string) {
    const renderer = this.mindMap.renderer as Record<string, unknown>
    const textEdit = renderer.textEdit as Record<string, unknown>
    ;(textEdit.hideEditTextBox as () => void)()
    const result = await this.getSvgData()
    const svgNode = result.node
    svgNode.first().before(SVG(`<title>${name}</title>`))
    await this.drawBackgroundToSvg(svgNode)
    const str = svgNode.svg() as string
    const res = await this.fixSvgStrAndToBlob(str)
    return res
  }

  // 修复svg字符串，并且转换为blob数据
  async fixSvgStrAndToBlob(str: string) {
    // 移除字符串中的html实体
    str = removeHTMLEntities(str)
    // 给html自闭合标签添加闭合状态
    str = handleSelfCloseTags(str)
    // 转换成blob数据
    const blob = new Blob([str], {
      type: 'image/svg+xml'
    })
    const res = await readBlob(blob)
    return res
  }

  //  导出为json
  async json(name: string, withConfig = true) {
    const data = this.mindMap.getData(withConfig)
    const str = JSON.stringify(data)
    const blob = new Blob([str])
    const res = await readBlob(blob)
    return res
  }

  //  专有文件，其实就是json文件
  async smm(name: string, withConfig: boolean) {
    const res = await this.json(name, withConfig)
    return res
  }

  // markdown文件
  async md() {
    const data = this.mindMap.getData()
    const content = transformToMarkdown(data)
    const blob = new Blob([content])
    const res = await readBlob(blob)
    return res
  }

  // txt文件
  async txt() {
    const data = this.mindMap.getData()
    const content = transformToTxt(data)
    const blob = new Blob([content])
    const res = await readBlob(blob)
    return res
  }
}

Export.instanceName = 'doExport'

export default Export