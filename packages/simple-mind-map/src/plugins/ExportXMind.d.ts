declare class ExportXMind {
  static instanceName: string
  mindMap: Record<string, unknown>
  constructor(opt: Record<string, unknown>)
  xmind(data: Record<string, unknown>, name: string): Promise<Blob>
  getXmind(): {
    parseXmindFile: (file: any, handleMultiCanvas: any) => Promise<unknown>
    transformXmind: (content: any, files: any, handleMultiCanvas: any) => Promise<{}>
    transformOldXmind: (content: any) => {}
    transformToXmind: (data: any, name: any) => Promise<Blob>
  }
}
export default ExportXMind
