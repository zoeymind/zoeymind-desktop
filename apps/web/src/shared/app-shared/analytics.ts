/**
 * Analytics —— 桌面端 no-op。产品仓的埋点是 posthog/segment 之类，桌面端不外发。
 */

interface AnalyticsClient {
  track: (event: string, props?: Record<string, unknown>) => void
  trackEvent: (event: string, props?: Record<string, unknown>) => Promise<void>
  page: (name?: string, props?: Record<string, unknown>) => void
  identify: (userId: string, traits?: Record<string, unknown>) => void
}

const NOOP_CLIENT: AnalyticsClient = {
  track: () => undefined,
  trackEvent: () => Promise.resolve(),
  page: () => undefined,
  identify: () => undefined,
}

export function useAnalytics(): AnalyticsClient {
  return NOOP_CLIENT
}

/** 事件名常量集合，占位；具体值等被消费到再补。 */
export const ANALYTICS_EVENTS: Record<string, string> = {}
