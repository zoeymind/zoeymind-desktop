import Base from './Base'
declare class OrganizationStructure extends Base {
  constructor(opt?: {})
  doLayout(callback: any): void
  computedBaseValue(): void
  computedLeftValue(): void
  adjustLeftValue(): void
  updateBrothers(node: any, addWidth: any): void
  renderLine(node: any, lines: any, style: any, lineStyle: any): void
  renderLineCurve(node: any, lines: any, style: any): any[]
  renderLineDirect(node: any, lines: any, style: any): any[]
  renderLineStraight(node: any, lines: any, style: any): any[]
  renderExpandBtn(node: any, btn: any): void
  renderGeneralization(list: any): void
  renderExpandBtnRect(rect: any, expandBtnSize: any, width: any, height: any, node: any): void
}
export default OrganizationStructure
