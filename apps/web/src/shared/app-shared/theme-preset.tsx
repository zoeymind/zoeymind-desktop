/**
 * 主题预设 Provider —— 桌面端保留画布/UI 主题切换能力。
 *
 * 真实预设数据来自 `@zoeymind/ui`（THEME_PRESETS + applyThemePreset）。
 * 存偏好用 localStorage，不走后端。
 *
 * light/dark mode 由 `@zoeymind/ui` 的 ThemeProvider 通过 `<html class="dark">`
 * 切换；这里 useMemo 从 root className 推断当前 mode 传给 applyThemePreset。
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  THEME_PRESETS,
  THEME_PRESET_STORAGE_KEY,
  applyThemeOrClear,
  type ThemePreset
} from '@zoeymind/ui'

interface ThemePresetContextValue {
  preset: string
  setPreset: (id: string) => void
  presets: ThemePreset[]
}

const ThemePresetContext = createContext<ThemePresetContextValue | null>(null)

function currentMode(): 'light' | 'dark' {
  if (typeof document === 'undefined') return 'light'
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

export function ThemePresetProvider({ children }: { children: ReactNode }) {
  const [preset, setPresetState] = useState<string>(() => {
    if (typeof window === 'undefined') return 'default'
    return window.localStorage.getItem(THEME_PRESET_STORAGE_KEY) ?? 'default'
  })

  const apply = useCallback((id: string) => {
    if (typeof document === 'undefined') return
    const found = THEME_PRESETS.find(p => p.id === id)
    applyThemeOrClear(found, currentMode(), document.documentElement)
  }, [])

  useEffect(() => {
    apply(preset)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(THEME_PRESET_STORAGE_KEY, preset)
    }
  }, [apply, preset])

  // dark/light 切换时同步一次（监听 <html class> 变化）
  useEffect(() => {
    if (typeof document === 'undefined') return
    const observer = new MutationObserver(() => apply(preset))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [apply, preset])

  const value = useMemo<ThemePresetContextValue>(
    () => ({ preset, setPreset: setPresetState, presets: THEME_PRESETS }),
    [preset]
  )

  return <ThemePresetContext.Provider value={value}>{children}</ThemePresetContext.Provider>
}

export function useThemePreset(): ThemePresetContextValue {
  const ctx = useContext(ThemePresetContext)
  if (!ctx) {
    throw new Error('useThemePreset must be inside <ThemePresetProvider>')
  }
  return ctx
}

/** 设置页里可能需要 ThemeMenu；桌面端先给一个极简 select。 */
export function ThemeMenu(): ReactNode {
  const { preset, setPreset, presets } = useThemePreset()
  return (
    <select
      value={preset}
      onChange={e => setPreset(e.target.value)}
      className="border rounded px-2 py-1 bg-background"
    >
      {presets.map(p => (
        <option key={p.id} value={p.id}>
          {p.label}
        </option>
      ))}
    </select>
  )
}
