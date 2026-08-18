import Base from './Base'
declare class LogicalStructure extends Base {
  constructor(opt: {}, layout: any)
  doLayout(callback: any): void
  computedBaseValue(): void
  computedTopValue(): void
  adjustTopValue(): void
  updateBrothers(node: any, addHeight: any): void
  renderLine(node: any, lines: any, style: any, lineStyle: any): void
  renderLineStraight(node: any, lines: any, style: any): any[]
  renderLineDirect(node: any, lines: any, style: any): any[]
  renderLineCurve(node: any, lines: any, style: any): any[]
  renderExpandBtn(node: any, btn: any): void
  renderGeneralization(list: any): void
  renderExpandBtnRect(rect: any, expandBtnSize: any, width: any, height: any): void
}
export default LogicalStructure
