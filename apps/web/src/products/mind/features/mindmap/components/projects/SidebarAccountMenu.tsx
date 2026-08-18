/**
 * 侧栏底部「个人中心」下拉.
 *
 * 触发器是全宽卡片(头像 + 姓名 + 当前组织名 + 展开符), 菜单内容由共享的
 * AccountMenuContent 提供; 语言与主题是本菜单独有的, 经 extraSections 注入 ——
 * ThemeMenu 在 shared/app-shared, 比 AccountMenuContent 所在的 shared/auth 高
 * 一层, 只能由调用方(本文件)传入。
 *
 * 账户设置新标签打开 Hub: 导图可能有未保存编辑, 不离开当页。
 */

import { ChevronsUpDown, Languages, Check } from 'lucide-react'
import {
  Button,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal
} from '@zoeymind/ui'
import {
  useTranslation,
  useLocale,
  useChangeLocale,
  SUPPORTED_LOCALES,
  type SupportedLocale
} from '@zoeymind/i18n'
import { AccountMenuContent, useAccountUI, UserAvatar } from '@/shared/auth'
import { ThemeMenu } from '@/shared/app-shared'

export function SidebarAccountMenu() {
  const ui = useAccountUI()
  const { t } = useTranslation()
  const locale = useLocale()
  const changeLocale = useChangeLocale()

  // 同 AccountMenu: 菜单内的「个人设置」要读 currentOrg.id, 这里提前挡住 trigger。
  if (!ui.user || !ui.currentOrg) return null

  // 触发按钮底部副标题: 显示当前所在 org 名, 让用户一眼看到自己在哪.
  const currentSpaceLabel = ui.currentOrg.name || ui.user.email || ''

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        nativeButton
        render={
          <Button
            variant="ghost"
            data-testid="account-menu"
            className="h-auto w-full justify-start gap-2 px-2 py-1.5"
          >
            <UserAvatar user={ui.user} size="md" square />
            <div className="grid min-w-0 flex-1 text-left leading-tight">
              <span className="truncate text-sm font-semibold">
                {ui.user.name || t('account.menu.unknownUser')}
              </span>
              <span className="truncate text-xs text-muted-foreground">{currentSpaceLabel}</span>
            </div>
            <ChevronsUpDown className="ml-auto size-3.5 shrink-0 text-muted-foreground" />
          </Button>
        }
      />

      {/* 身份已在 trigger 卡片展示, 故内容区不重复渲染头部 */}
      <AccountMenuContent
        side="top"
        align="start"
        className="w-[240px]"
        headerVariant="none"
        extraSections={
          <>
            <DropdownMenuSeparator className="my-1" />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="gap-2">
                <Languages className="size-4" />
                {t('language.switch')}
              </DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent>
                  {SUPPORTED_LOCALES.map((loc: SupportedLocale) => (
                    <DropdownMenuItem
                      key={loc}
                      onClick={() => changeLocale(loc)}
                      className="cursor-pointer gap-2"
                    >
                      <span className="flex-1">{t(`language.${loc}`)}</span>
                      {loc === locale && <Check className="size-4 shrink-0" />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>

            {/* 主题: 明暗 + 预设 (通用 ThemeMenu 组件) */}
            <ThemeMenu variant="sub" />
          </>
        }
      />
    </DropdownMenu>
  )
}
