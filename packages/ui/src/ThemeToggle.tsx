import { Moon, Sun, Monitor } from 'lucide-react'
import { Button } from './button'
import { useTheme, type Theme } from './hooks/useTheme'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip'
import { useTranslation } from '@zoeymind/i18n'

// 主题循环顺序：亮色 -> 暗色 -> 跟随系统 -> 亮色
const themeOrder: Theme[] = ['light', 'dark', 'system']

const themeLabelKeys: Record<Theme, string> = {
  light: 'ui.theme.light',
  dark: 'ui.theme.dark',
  system: 'ui.theme.system'
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const { t } = useTranslation()

  const handleToggle = () => {
    const currentIndex = themeOrder.indexOf(theme)
    const nextIndex = (currentIndex + 1) % themeOrder.length
    setTheme(themeOrder[nextIndex])
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button variant="ghost" size="icon" className="size-8" onClick={handleToggle}>
              {theme === 'light' && <Sun className="size-4" />}
              {theme === 'dark' && <Moon className="size-4" />}
              {theme === 'system' && <Monitor className="size-4" />}
              <span className="sr-only">{t('ui.theme.toggle')}</span>
            </Button>
          }
        />
        <TooltipContent>
          <p>{t(themeLabelKeys[theme])}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
