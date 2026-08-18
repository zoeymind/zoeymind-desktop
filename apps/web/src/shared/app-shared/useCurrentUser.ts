/**
 * 桌面端零用户概念。保留 hook 只为兼容原 API 形态；`data` 恒为 null，
 * 消费方 UI 里不展示任何头像/邮箱/个人中心入口。
 */

interface UseCurrentUserResult {
  data: null
  isLoading: false
  isPending: false
}

export function useCurrentUser(): UseCurrentUserResult {
  return { data: null, isLoading: false, isPending: false }
}
