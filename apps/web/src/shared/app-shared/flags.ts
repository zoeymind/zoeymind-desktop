/**
 * useFlags / useFeature —— 桌面端 stub。
 *
 * 产品仓的 flags 是从 license/SystemConfig 拉的商业能力开关（`ai-agent` /
 * `sso` / `multi-tenancy` / `audit-export` 等）。桌面端全部本地，AI 相关能力
 * 默认开（用户直接接自己的模型），其余关。
 */

export interface FlagsSnapshot {
  'ai-agent': boolean
  'ai-gateway': boolean
  sso: boolean
  'multi-tenancy': boolean
  'audit-export': boolean
  'ui-auto': boolean
}

const DESKTOP_FLAGS: FlagsSnapshot = {
  'ai-agent': true,
  'ai-gateway': false,
  sso: false,
  'multi-tenancy': false,
  'audit-export': false,
  'ui-auto': false
}

export function useFlags(): FlagsSnapshot {
  return DESKTOP_FLAGS
}

export function useFeature(flag: keyof FlagsSnapshot): boolean {
  return DESKTOP_FLAGS[flag] ?? false
}
