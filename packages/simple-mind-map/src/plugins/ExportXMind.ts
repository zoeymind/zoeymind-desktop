// @ts-nocheck — vendored engine source
import { transformToXmind } from '../parse/xmind-export'

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
    return transformToXmind(data, name)
  }
}

ExportXMind.instanceName = 'doExportXMind'

export default ExportXMind
