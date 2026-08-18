declare const _default: {
  parseXmindFile: (file: any, handleMultiCanvas: any) => Promise<unknown>
  transformXmind: (content: any, files: any, handleMultiCanvas: any) => Promise<{}>
  transformOldXmind: (content: any) => {}
  transformToXmind: (data: any, name: any) => Promise<Blob>
}
export default _default
