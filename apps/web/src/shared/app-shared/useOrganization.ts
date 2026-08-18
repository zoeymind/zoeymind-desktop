/**
 * useOrganization —— 桌面端"本地单组织"占位。
 *
 * 桌面端没有多租户概念，返回一个稳定的 { currentOrg, organizations, switchOrg }，
 * 让 mind features 里 `useOrganization().currentOrg.id` 之类的取用继续可编译。
 */

export interface LocalOrg {
  id: string
  name: string
  role: 'OWNER'
}

const LOCAL_ORG: LocalOrg = { id: 'local', name: 'Local', role: 'OWNER' }

interface UseOrganizationResult {
  currentOrg: LocalOrg
  organizations: LocalOrg[]
  switchOrg: (id: string) => void
  isLoading: false
}

export function useOrganization(): UseOrganizationResult {
  return {
    currentOrg: LOCAL_ORG,
    organizations: [LOCAL_ORG],
    switchOrg: () => undefined,
    isLoading: false
  }
}
