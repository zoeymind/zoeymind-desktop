---
name: reuse-ui-components
description: 前端开发前强制先搜通用组件再动手，杜绝自造已有组件。适用于写/改任何前端 UI —— 表单、表格、弹框、头像、通知、卡片、菜单等。触发词：写前端、加页面、做组件、这个 UI、加个弹框/表格/头像、前端开发。开发涉及用户信息/头像、列表、overlay、toast 时尤其必须先读本 skill。
---

# 前端组件复用（先搜后建）

**最高优先级：写任何前端 UI 前，先搜现有组件，绝不自造已有的东西。** 本 skill 是 `AGENTS.md`「UI / UX 规则」的可触发入口——动手前走一遍，把被动规则变成主动动作。

## 动手前必做（顺序不可跳）

1. 搜 `@zoeymind/ui` barrel：`grep "export" packages/ui/src/index.ts`（64 个通用组件）
2. 搜业务共享层 barrel：`grep "export" apps/web/src/shared/app-shared/index.ts`（业务共享组件/hook）
3. **搜业务功能层**——通用 barrel 找不到 ≠ 不存在。组织/成员/切换器类在 `shared/organization`，认证/账户菜单在 `shared/auth`，引导流程在 `shared/onboarding`。功能型组件（组织切换、成员管理、账户菜单等）先 grep 这些目录：`grep -r "export" apps/web/src/shared/organization apps/web/src/shared/auth apps/web/src/shared/onboarding | grep -i "<关键词>"`。
4. **参考同类产品页面的现有用法**——你要做的东西，别的产品/页面大概率已经做过。grep 同名概念看它们用了什么：如"组织切换"→ `grep -rn "WorkspaceSwitcher\|OrgWorkspaceSwitcher\|switchOrg" apps/web/src`。侧边栏顶部、TopBar 这些位置的现成组件直接拿来用，别重搓。
5. **以上全无**才自建。深度规范查 `docs/STYLEGUIDE.md`（token 角色、组件选型、fork 表）。

> 真实教训：有人在 QMS "创建第一个项目"时自搓了个组织切换胶囊下拉，但侧边栏顶部早有 `WorkspaceSwitcher`（`shared/organization`）+ `useOrganization().switchOrg`。根因：只搜了 ui/app-shared 两个 barrel，没搜业务功能层、没看侧边栏现成用法。功能组件必搜业务层 + 同类页面。

## 高频场景 → 指定组件（用错就是 bug）

| 场景                            | 必用组件                                                | 来源                         | 关键                                                                                                                                          |
| ------------------------------- | ------------------------------------------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **渲染某个用户/头像**           | `UserAvatarWithCard`                                    | `@zoeymind/app-shared`       | 自带 hover 名片（name+email），无 email 自动拉 `user.getPublicProfile`。传 `user={{id,name,email?,avatar?}}`。不需卡片显式 `showCard={false}` |
| 非用户头像（组织/空间/app）     | `OrgAvatar`/`WorkspaceAvatar`                           | `@zoeymind/ui`               | 用户头像**禁止**直接用 `Avatar/AvatarImage/AvatarFallback`                                                                                    |
| 多行列表（分页/排序/过滤/选择） | `DataTable` + `useClientDataTable`/`useServerDataTable` | `@zoeymind/ui`               | 表头用 `DataTableColumnHeader`，加载用 `DataTableSkeleton`，静态展示才用 `Table` 原语                                                         |
| 需要输入的编辑/创建             | `Dialog` + `DialogHeader/Footer` + `FieldGroup`         | `@zoeymind/ui`               | 别自己拼 `<div className="space-y-4">`                                                                                                        |
| 破坏性操作确认                  | `useConfirm()` Promise 模式                             | `apps/admin/.../use-confirm` | 或 `ConfirmDialog`/`AlertDialog`                                                                                                              |
| 侧面板详情/筛选                 | `Sheet`                                                 | `@zoeymind/ui`               |                                                                                                                                               |
| 悬停快速信息                    | `HoverCard`                                             | `@zoeymind/ui`               |                                                                                                                                               |
| 点击展开菜单/内容               | `Popover`                                               | `@zoeymind/ui`               |                                                                                                                                               |
| 多 tab 设置面板                 | `SettingsShell`                                         | `@zoeymind/ui`               | 禁手搓 sidebar+content，禁用垂直 Tabs 当侧栏                                                                                                  |
| **操作结果反馈**                | `toast`                                                 | `@zoeymind/app-shared`       | 只在 mutation `onSuccess` toast；错误已挂全局 handler 别手动 toast；禁 `import from 'sonner'`                                                 |
| 页面内联静态横幅                | `Alert`                                                 | `@zoeymind/ui`               | 不用它做操作反馈（那是 toast）                                                                                                                |
| 表单字段级错误                  | `FormMessage`                                           | `@zoeymind/ui`               |                                                                                                                                               |
| 图标                            | `lucide-react`                                          |                              | 作为组件对象传 `icon={CheckIcon}`；禁第二套图标库；禁 emoji 当图标                                                                            |

## 硬约束（红线）

- **第三方组件保持官方样式**：shadcn/Radix/react-day-picker 不套 `border`/`rounded-*`/`bg-*` 装饰 wrapper，不塞自定义色。改观感调主题变量或 `THEME_PRESETS`。
- **颜色只用语义 CSS 变量**：`bg-primary`/`text-muted-foreground`，禁硬编码 `bg-blue-500`。
- **卡片不嵌卡片**：`bg-card` 面板内的次级卡片用 `bg-muted/30~50` + `border`，不再套 `bg-card`，不加 `shadow-*`。
- **shadcn 组合**：item 套 group（`SelectItem`→`SelectGroup` 等）；`Separator` 替 `<hr>`；`Skeleton` 替 `animate-pulse`；`Badge` 替自定义 span。
- **列表 key 用稳定唯一 id**（数据库 id/uuid），禁 title/name/index；cmdk `value` 用 id，搜索文本走 `keywords`。
- **文案走 `t()`**：中英成对，`placeholder`/`title`/`aria-label` 全走 i18n。

## 包分层（放对层）

依赖单向：`@zoeymind/ui`（不认识业务）← `@zoeymind/app-shared`（业务胶水）← `apps/*`。认识业务往上放，不认识往下沉。底层要用上层的东西 = 那东西错位了，下沉它而非反向 import。

## 自检

写完前端自问：这个头像/表格/弹框/卡片，是不是已有通用组件？我是不是又拼了一个 `<div>` 造轮子？溢出/空态/加载/错误四态齐不齐？320px 验过没？
