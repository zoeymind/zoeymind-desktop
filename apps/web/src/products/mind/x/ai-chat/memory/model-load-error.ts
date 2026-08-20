export function describeModelLoadError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  if (/unexpected token ['"]?<['"]?|<!doctype|not valid json/i.test(message)) {
    return "模型下载源返回了网页而不是模型文件，请检查网络后重试。"
  }
  return message
}
