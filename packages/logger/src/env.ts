import { isBrowser } from './colors'

// 运行时环境判定：前后端共用一份 logger，生产判定必须两端都成立。
// - Node：process.env.NODE_ENV === 'production'
// - 浏览器（Vite 构建）：import.meta.env.PROD（编译期常量，dev=false / build=true）
//
// Node 的 TS 类型不认识 Vite 注入的 import.meta.env，故此处一次性具名断言到
// 最小结构；这是「库类型无法表达且运行时检查无意义」的场景，断言范围限定在本模块。
const viteMeta = import.meta as unknown as { env?: { PROD?: boolean } }

function detectProduction(): boolean {
  if (isBrowser) {
    return viteMeta.env?.PROD === true
  }
  return typeof process !== 'undefined' && process.env.NODE_ENV === 'production'
}

export const isProduction = detectProduction()
