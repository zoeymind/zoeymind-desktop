declare class Formula {
  static instanceName: string
  opt: Record<string, unknown>
  mindMap: any
  config: any
  cssEl: any
  constructor(opt: any)
  onDestroy(): void
  init(): void
  getKatexConfig(): {
    throwOnError: boolean
    errorColor: string
    output: string
  }
  extendQuill(): void
  getStyleText(): string
  addStyle(): void
  removeStyle(): void
  insertFormulaToNode(node: any, formula: any): void
  latexRichToText(nodeText: any): any
  formatLatex(richText: any): void
  checkFormulaIsLegal(str: any): boolean
  beforePluginRemove(): void
  beforePluginDestroy(): void
}
export default Formula
