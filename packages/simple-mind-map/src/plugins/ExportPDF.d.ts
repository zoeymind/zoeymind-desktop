declare class ExportPDF {
  mindMap: Record<string, unknown>
  static instanceName: string
  constructor(opt: Record<string, unknown>)
  pdf(img: string): Promise<string>
}
export default ExportPDF
