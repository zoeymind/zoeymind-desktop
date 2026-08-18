import { describe, it, expect } from 'vitest'
import {
  PROJECT_PERMISSIONS,
  PROJECT_RESOURCES,
  BuiltinProjectRoles,
  BUILTIN_ROLE_PERMISSIONS,
  roleHasPermission,
  type ProjectPermission
} from '../data/project-permissions'

describe('项目权限 statement 矩阵', () => {
  describe('statement 定义', () => {
    it('覆盖核心业务资源', () => {
      expect(PROJECT_RESOURCES).toContain('bug')
      expect(PROJECT_RESOURCES).toContain('testCase')
      expect(PROJECT_RESOURCES).toContain('testPlan')
      expect(PROJECT_RESOURCES).toContain('testReport')
      expect(PROJECT_RESOURCES).toContain('member')
      expect(PROJECT_RESOURCES).toContain('role')
      expect(PROJECT_RESOURCES).toContain('workspace')
    })

    it('permission 是 资源:动作 格式', () => {
      for (const p of PROJECT_PERMISSIONS) {
        expect(p).toMatch(/^[a-zA-Z]+:[a-zA-Z]+$/)
      }
    })

    it('包含缺陷状态门控权限位', () => {
      const perms: readonly string[] = PROJECT_PERMISSIONS
      expect(perms).toContain('bug:resolve')
      expect(perms).toContain('bug:close')
      expect(perms).toContain('bug:reopen')
    })

    it('每个内置角色的权限都是合法 statement', () => {
      const valid = new Set<string>(PROJECT_PERMISSIONS)
      for (const role of Object.values(BuiltinProjectRoles)) {
        for (const p of BUILTIN_ROLE_PERMISSIONS[role]) {
          expect(valid.has(p)).toBe(true)
        }
      }
    })
  })

  describe('内置角色权限矩阵（ADR 0003 默认切分）', () => {
    it('PM 拥有全部权限（含成员/角色管理）', () => {
      expect(roleHasPermission(BuiltinProjectRoles.ADMIN, 'member:invite')).toBe(true)
      expect(roleHasPermission(BuiltinProjectRoles.ADMIN, 'role:manage')).toBe(true)
      expect(roleHasPermission(BuiltinProjectRoles.ADMIN, 'bug:close')).toBe(true)
      // PM = 全集
      for (const p of PROJECT_PERMISSIONS) {
        expect(roleHasPermission(BuiltinProjectRoles.ADMIN, p)).toBe(true)
      }
    })

    it('测试：用例/计划/报告全权 + 缺陷可关闭/打回', () => {
      expect(roleHasPermission(BuiltinProjectRoles.TESTER, 'testCase:create')).toBe(true)
      expect(roleHasPermission(BuiltinProjectRoles.TESTER, 'testPlan:execute')).toBe(true)
      expect(roleHasPermission(BuiltinProjectRoles.TESTER, 'testReport:publish')).toBe(true)
      expect(roleHasPermission(BuiltinProjectRoles.TESTER, 'bug:close')).toBe(true)
      expect(roleHasPermission(BuiltinProjectRoles.TESTER, 'bug:reopen')).toBe(true)
      // 测试不管成员/角色
      expect(roleHasPermission(BuiltinProjectRoles.TESTER, 'member:invite')).toBe(false)
      expect(roleHasPermission(BuiltinProjectRoles.TESTER, 'role:manage')).toBe(false)
    })

    it('开发：缺陷只能处理中/已解决，用例只读，不能关闭/打回', () => {
      expect(roleHasPermission(BuiltinProjectRoles.DEVELOPER, 'bug:resolve')).toBe(true)
      expect(roleHasPermission(BuiltinProjectRoles.DEVELOPER, 'bug:read')).toBe(true)
      expect(roleHasPermission(BuiltinProjectRoles.DEVELOPER, 'testCase:read')).toBe(true)
      // 开发不能关闭/打回缺陷（测试专属）
      expect(roleHasPermission(BuiltinProjectRoles.DEVELOPER, 'bug:close')).toBe(false)
      expect(roleHasPermission(BuiltinProjectRoles.DEVELOPER, 'bug:reopen')).toBe(false)
      // 开发不能改用例
      expect(roleHasPermission(BuiltinProjectRoles.DEVELOPER, 'testCase:create')).toBe(false)
      expect(roleHasPermission(BuiltinProjectRoles.DEVELOPER, 'testCase:update')).toBe(false)
    })

    it('workspace 粗粒度门控：测试可编辑，开发只读，均不可管理成员/删除', () => {
      expect(roleHasPermission(BuiltinProjectRoles.TESTER, 'workspace:update')).toBe(true)
      expect(roleHasPermission(BuiltinProjectRoles.TESTER, 'workspace:manageMembers')).toBe(false)
      expect(roleHasPermission(BuiltinProjectRoles.TESTER, 'workspace:delete')).toBe(false)
      expect(roleHasPermission(BuiltinProjectRoles.DEVELOPER, 'workspace:read')).toBe(true)
      expect(roleHasPermission(BuiltinProjectRoles.DEVELOPER, 'workspace:update')).toBe(false)
      // PM 可管理成员 + 删除项目
      expect(roleHasPermission(BuiltinProjectRoles.ADMIN, 'workspace:manageMembers')).toBe(true)
      expect(roleHasPermission(BuiltinProjectRoles.ADMIN, 'workspace:delete')).toBe(true)
    })

    it('访客：全部只读，无任何写权限', () => {
      const readPerms = PROJECT_PERMISSIONS.filter(p => p.endsWith(':read'))
      for (const p of readPerms) {
        expect(roleHasPermission(BuiltinProjectRoles.MEMBER, p)).toBe(true)
      }
      const writePerms = PROJECT_PERMISSIONS.filter(p => !p.endsWith(':read'))
      for (const p of writePerms) {
        expect(roleHasPermission(BuiltinProjectRoles.MEMBER, p)).toBe(false)
      }
    })
  })

  describe('roleHasPermission 边界', () => {
    it('未知角色一律无权', () => {
      expect(roleHasPermission('不存在的角色' as never, 'bug:read')).toBe(false)
    })

    it('未知权限一律无权（含 PM）', () => {
      expect(roleHasPermission(BuiltinProjectRoles.ADMIN, 'foo:bar' as ProjectPermission)).toBe(
        false
      )
      expect(roleHasPermission(BuiltinProjectRoles.MEMBER, 'foo:bar' as ProjectPermission)).toBe(
        false
      )
    })
  })
})
