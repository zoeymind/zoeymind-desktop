/**
 * 组织显示策略。
 *
 * 任何 UI 显示 org name 前都应过这一层，以便统一处理显示规则。
 */

export interface OrgLike {
  name: string
}

export function getOrgDisplayName(org: OrgLike): string {
  return org.name
}

export function getOrgAvatarLetter(org: OrgLike): string {
  return (org.name?.charAt(0) ?? '').toUpperCase()
}
