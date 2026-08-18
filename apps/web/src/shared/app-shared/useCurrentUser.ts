/**
 * useCurrentUser —— 桌面端本地占位。
 *
 * 用户已明确"不需要有用户相关的内容"：桌面端 UI 上不展示头像/账号菜单/邮箱。
 * 但很多组件源码里仍写 `user?.name`, `user?.id`；直接返回 null 会 NPE。
 *
 * 折衷：返回一个稳定的空 user，name/avatar 都是空串 —— 组件渲染时"什么都看不见"
 * 但不会崩。真正的账号 UI 组件（UserAvatarWithCard 等）在 index.ts 里是 null 组件。
 */

export interface LocalUser {
  id: string
  name: string
  email: string
  avatar: string
  image: string | null
}

const LOCAL_USER: LocalUser = {
  id: 'local',
  name: '',
  email: '',
  avatar: '',
  image: null
}

interface UseCurrentUserResult {
  data: LocalUser
  isLoading: false
  isPending: false
}

export function useCurrentUser(): UseCurrentUserResult {
  return { data: LOCAL_USER, isLoading: false, isPending: false }
}
