declare class ExportXMind {
  static instanceName: string
  mindMap: Record<string, unknown>
  constructor(opt: Record<string, unknown>)
  xmind(data: Record<string, unknown>, name: string): Promise<Blob>
}
export default ExportXMind
