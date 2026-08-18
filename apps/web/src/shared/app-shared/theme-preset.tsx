/**
 * 主题预设 Provider —— 桌面端保留画布/UI 主题切换能力。
 *
 * 真实预设数据来自 `@zoeymind/ui`（THEME_PRESETS + applyThemePreset）。
 * 存偏好用 localStorage，不走后端。
 */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  THEME_PRESETS,
  THEME_PRESET_STORAGE_KEY,
  applyThemePreset,
  applyThemeOrClear,
  clearManagedKeys,
  type ThemePreset
} from '@zoeymind/ui'

interface ThemePresetContextValue {
  preset: string
  setPreset: (id: string) => void
  presets: ThemePreset[]
}

const ThemePresetContext = createContext<ThemePresetContextValue | null>(null)

export function ThemePresetProvider({ children }: { children: ReactNode }) {
  const [preset, setPresetState] = useState<string>(() => {
    if (typeof window === 'undefined') return 'default'
    return window.localStorage.getItem(THEME_PRESET_STORAGE_KEY) ?? 'default'
  })

  useEffect(() => {
    const found = THEME_PRESETS.find(p => p.id === preset) ?? null
    if (found) {
      applyThemePreset(found)
    } else {
      clearManagedKeys()
    }
    applyThemeOrClear(found)
    window.localStorage.setItem(THEME_PRESET_STORAGE_KEY, preset)
  }, [preset])

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
          {p.name}
        </option>
      ))}
    </select>
  )
}
