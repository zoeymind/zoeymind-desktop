import type { Preview } from '@storybook/react'
import { withThemeByClassName } from '@storybook/addon-themes'
import { I18nProvider, i18next } from '@zoeymind/i18n'
import { ThemeProvider } from '../src/hooks/useTheme'
import { THEME_PRESETS, applyThemeOrClear, type ThemePreset } from '../src/theme'
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet
} from '@tanstack/react-router'
import { NuqsAdapter } from 'nuqs/adapters/react'
import { useEffect, type JSX, type ReactNode } from 'react'
import './preview.css'

// Storybook 10 侧栏顶部自带 "Get started" onboarding widget，无官方开关关闭。
// preview 与 manager 同源，可访问 window.parent；一次性隐藏它。
if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
  const parent = window.parent
  const hideOnboarding = () => {
    const btn = parent.document.querySelector('button[aria-label="Open onboarding guide"]')
    if (!btn) return false
    let el: HTMLElement | null = btn as HTMLElement
    for (let i = 0; i < 15 && el; i++) {
      const txt = (el.textContent || '').trim()
      if (txt.includes("See what's new") && txt.includes('Publish')) {
        el.style.setProperty('display', 'none', 'important')
        return true
      }
      el = el.parentElement
    }
    ;(btn as HTMLElement).style.setProperty('display', 'none', 'important')
    return true
  }
  if (!hideOnboarding()) {
    const obs = new MutationObserver(() => {
      if (hideOnboarding()) obs.disconnect()
    })
    obs.observe(parent.document.body, { childList: true, subtree: true })
    setTimeout(() => obs.disconnect(), 15000)
  }
}

function makeStoryRouter(node: ReactNode) {
  const rootRoute = createRootRoute({ component: () => <Outlet /> })
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => <>{node}</>
  })
  const routeTree = rootRoute.addChildren([indexRoute])
  return createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ['/'] })
  })
}

/** Apply the tweakcn theme preset by id whenever globals change. */
function useThemePreset(presetId: string, mode: 'light' | 'dark') {
  useEffect(() => {
    const preset = THEME_PRESETS.find((p: ThemePreset) => p.id === presetId)
    applyThemeOrClear(preset, mode, document.documentElement)
  }, [presetId, mode])
}

/** Switch i18next language whenever the locale global changes. */
function useLocaleSync(locale: string) {
  useEffect(() => {
    if (i18next.language !== locale) void i18next.changeLanguage(locale)
  }, [locale])
}

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i
      }
    },
    layout: 'centered',
    backgrounds: {
      default: 'app',
      values: [
        { name: 'app', value: 'var(--color-background)' },
        { name: 'white', value: '#ffffff' },
        { name: 'black', value: '#0a0a0a' }
      ]
    }
  },
  globalTypes: {
    locale: {
      description: '界面语言 / Interface locale',
      toolbar: {
        icon: 'globe',
        items: [
          { value: 'zh-CN', right: '🇨🇳', title: '简体中文' },
          { value: 'en-US', right: '🇺🇸', title: 'English' }
        ],
        dynamicTitle: true
      }
    },
    themePreset: {
      description: '主题预设 / Theme preset',
      toolbar: {
        icon: 'paintbrush',
        items: THEME_PRESETS.map((p: ThemePreset) => ({
          value: p.id || 'default',
          title: p.label
        })),
        dynamicTitle: true
      }
    }
  },
  initialGlobals: {
    locale: 'zh-CN',
    themePreset: 'default'
  },
  decorators: [
    (Story, ctx): JSX.Element => {
      const locale = (ctx.globals.locale ?? 'zh-CN') as string
      const presetId = (ctx.globals.themePreset ?? 'default') as string
      const mode = ctx.globals.theme === 'dark' ? 'dark' : 'light'

      // eslint-disable-next-line react-hooks/rules-of-hooks
      useLocaleSync(locale)
      // eslint-disable-next-line react-hooks/rules-of-hooks
      useThemePreset(presetId === 'default' ? '' : presetId, mode)

      const inner = ctx.parameters?.router ? (
        <RouterProvider router={makeStoryRouter(<Story />)} />
      ) : (
        <Story />
      )
      return (
        <NuqsAdapter>
          <I18nProvider>
            <ThemeProvider>{inner}</ThemeProvider>
          </I18nProvider>
        </NuqsAdapter>
      )
    },
    withThemeByClassName({
      themes: {
        light: '',
        dark: 'dark'
      },
      defaultTheme: 'light'
    })
  ]
}

export default preview
