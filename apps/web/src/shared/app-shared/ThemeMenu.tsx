import { Palette, Sun, Moon, Monitor } from 'lucide-react'
import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  ScrollArea,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
  cn,
  useTheme,
  type Theme,
  THEME_PRESETS
} from '@zoeymind/ui'
import { useTranslation } from '@zoeymind/i18n'
import { useThemePreset } from './ThemePresetProvider'

/**
 * 通用主题菜单 — 包含明暗/系统三档 + 预设网格.
 *
 * variant:
 *   - 'icon'  (默认) — 独立 Popover 触发器（Palette 图标按钮）
 *   - 'sub'   — 嵌入 DropdownMenu 的 Sub 子菜单（推荐用于 SidebarAccountMenu）
 *   - 'inline' — 直接平铺到 DropdownMenu 内部（已废弃，仅向下兼容）
 */

const THEME_MODES: { mode: Theme; icon: typeof Sun; labelKey: string }[] = [
  { mode: 'light', icon: Sun, labelKey: 'ui.theme.light' },
  { mode: 'dark', icon: Moon, labelKey: 'ui.theme.dark' },
  { mode: 'system', icon: Monitor, labelKey: 'ui.theme.system' }
]

export interface ThemeMenuProps {
  /**
   * 触发器变体.
   *   - 'icon'   独立图标按钮 + Popover（默认）
   *   - 'sub'    DropdownMenu 子菜单（按钮 → 展开侧面板）
   *   - 'inline' 平铺在 DropdownMenu 内（已废弃）
   */
  variant?: 'icon' | 'sub' | 'inline'
}

/** 明暗三档 + 预设网格的共享内容块（用于 sub / icon 两种模式）. */
function ThemeContent() {
  const { t } = useTranslation()
  const { theme, setTheme } = useTheme()
  const { presetId, setPreset } = useThemePreset()

  return (
    <div className="space-y-2 p-2">
      {/* 明暗三档 */}
      <div className="flex gap-1">
        {THEME_MODES.map(({ mode, icon: Icon, labelKey }) => (
          <Button
            key={mode}
            variant={theme === mode ? 'secondary' : 'ghost'}
            size="icon"
            className="flex-1"
            aria-label={t(labelKey)}
            title={t(labelKey)}
            onClick={() => setTheme(mode)}
          >
            <Icon className="size-4" />
          </Button>
        ))}
      </div>
      {/* 预设网格 */}
      <div className="grid grid-cols-2 gap-1.5">
        {THEME_PRESETS.map(p => {
          const active = presetId === p.id
          return (
            <button
              key={p.id || 'default'}
              type="button"
              onClick={() => setPreset(p.id)}
              aria-pressed={active}
              className={cn(
                'flex flex-col gap-1.5 rounded-lg border p-2 text-left transition-colors hover:bg-accent',
                active ? 'border-ring ring-2 ring-ring' : 'border-border'
              )}
            >
              <span className="flex h-6 w-full overflow-hidden rounded-sm border">
                {p.preview.map((color, i) => (
                  <span key={i} className="flex-1" style={{ backgroundColor: color }} />
                ))}
              </span>
              <span className="truncate text-xs text-muted-foreground">{p.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function ThemeMenu({ variant = 'icon' }: ThemeMenuProps) {
  const { t } = useTranslation()
  const { theme, setTheme } = useTheme()
  const { presetId, setPreset } = useThemePreset()

  // sub 模式：DropdownMenuSub（侧面板，跟「语言」切换一致）
  if (variant === 'sub') {
    return (
      <DropdownMenuSub>
        <DropdownMenuSubTrigger className="gap-2">
          <Palette className="size-4" />
          {t('common.themePreset')}
        </DropdownMenuSubTrigger>
        <DropdownMenuPortal>
          <DropdownMenuSubContent className="w-56 p-0">
            <div className="shrink-0 border-b px-3 py-2 text-sm font-medium">
              {t('common.themePreset')}
            </div>
            <div
              className="overflow-y-auto"
              style={{
                maxHeight:
                  'min(400px, calc(var(--radix-dropdown-menu-content-available-height, 480px) - 40px))'
              }}
            >
              <ThemeContent />
            </div>
          </DropdownMenuSubContent>
        </DropdownMenuPortal>
      </DropdownMenuSub>
    )
  }

  // inline 模式（平铺，已废弃但向下兼容）
  if (variant === 'inline') {
    return (
      <div className="space-y-2 border-t pt-2 mt-2">
        <div className="flex gap-1 px-2">
          {THEME_MODES.map(({ mode, icon: Icon, labelKey }) => (
            <Button
              key={mode}
              variant={theme === mode ? 'secondary' : 'ghost'}
              size="icon"
              className="flex-1 h-8"
              aria-label={t(labelKey)}
              title={t(labelKey)}
              onClick={() => setTheme(mode)}
            >
              <Icon className="size-3.5" />
            </Button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2 px-2 pb-2 max-h-48 overflow-y-auto">
          {THEME_PRESETS.map(p => {
            const active = presetId === p.id
            return (
              <button
                key={p.id || 'default'}
                type="button"
                onClick={() => setPreset(p.id)}
                aria-pressed={active}
                className={cn(
                  'flex flex-col gap-1 rounded-lg border p-1.5 text-left transition-colors hover:bg-accent',
                  active ? 'border-ring ring-2 ring-ring' : 'border-border'
                )}
              >
                <span className="flex h-5 w-full overflow-hidden rounded-sm border">
                  {p.preview.map((color, i) => (
                    <span key={i} className="flex-1" style={{ backgroundColor: color }} />
                  ))}
                </span>
                <span className="truncate text-xs text-muted-foreground">{p.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // icon 模式（默认）: Popover 触发器 + 弹出内容
  return (
    <Popover>
      <PopoverTrigger
        nativeButton
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('common.themePreset')}
            title={t('common.themePreset')}
          >
            <Palette className="size-4" />
          </Button>
        }
      />
      <PopoverContent align="end" className="w-72 p-0">
        <div className="border-b px-3 py-2 text-sm font-medium">{t('common.themePreset')}</div>
        <div className="p-3 space-y-2">
          <div className="flex gap-1">
            {THEME_MODES.map(({ mode, icon: Icon, labelKey }) => (
              <Button
                key={mode}
                variant={theme === mode ? 'secondary' : 'ghost'}
                size="icon"
                className="flex-1"
                aria-label={t(labelKey)}
                title={t(labelKey)}
                onClick={() => setTheme(mode)}
              >
                <Icon className="size-4" />
              </Button>
            ))}
          </div>
          <ScrollArea className="h-80">
            <div className="grid grid-cols-2 gap-2 pr-3">
              {THEME_PRESETS.map(p => {
                const active = presetId === p.id
                return (
                  <button
                    key={p.id || 'default'}
                    type="button"
                    onClick={() => setPreset(p.id)}
                    aria-pressed={active}
                    className={cn(
                      'flex flex-col gap-1.5 rounded-lg border p-2 text-left transition-colors hover:bg-accent',
                      active ? 'border-ring ring-2 ring-ring' : 'border-border'
                    )}
                  >
                    <span className="flex h-7 w-full overflow-hidden rounded-md border">
                      {p.preview.map((color, i) => (
                        <span key={i} className="flex-1" style={{ backgroundColor: color }} />
                      ))}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">{p.label}</span>
                  </button>
                )
              })}
            </div>
          </ScrollArea>
        </div>
      </PopoverContent>
    </Popover>
  )
}
