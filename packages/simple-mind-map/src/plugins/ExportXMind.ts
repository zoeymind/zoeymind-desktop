import xmind from '../parse/xmind'

//  导出XMind插件，需要通过Export插件使用
class ExportXMind {
  declare static instanceName: string
  declare mindMap: Record<string, unknown>

  //  构造函数
  constructor(opt: Record<string, unknown>) {
    this.mindMap = opt.mindMap as Record<string, unknown>
  }

  // 导出xmind
  async xmind(data: Record<string, unknown>, name: string) {
    const zipData = await xmind.transformToXmind(data, name)
    return zipData
  }

  // 获取解析器
  getXmind() {
    return xmind
  }
}

ExportXMind.instanceName = 'doExportXMind'

export default ExportXMind
