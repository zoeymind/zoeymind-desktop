import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { useTheme, THEME_PRESET_STORAGE_KEY, THEME_PRESETS, applyThemeOrClear } from "@zoeymind/ui"

interface ThemePresetContextValue {
  presetId: string
  setPreset: (id: string) => void
}

const ThemePresetContext = createContext<ThemePresetContextValue | undefined>(undefined)

/**
 * Hook to consume the theme preset context.
 * Returns the current preset ID and a setter function.
 */
export function useThemePreset(): ThemePresetContextValue {
  const ctx = useContext(ThemePresetContext)
  if (!ctx) {
    throw new Error("useThemePreset must be used within ThemePresetProvider")
  }
  return ctx
}

interface ThemePresetProviderProps {
  children: ReactNode
}

/**
 * Provider that manages runtime theme preset application.
 * - Reads persisted preset ID from localStorage
 * - Applies the preset's token set on mount and when preset/theme changes
 * - Converts colors to HSL via culori
 * - Clears all managed keys when Default is selected
 * - Re-applies whenever resolvedTheme (light/dark) changes
 */
export function ThemePresetProvider({ children }: ThemePresetProviderProps): ReactNode {
  const { resolvedTheme } = useTheme()
  const [presetId, setPresetId] = useState<string>(() => {
    if (typeof window === "undefined") return ""
    try {
      return window.localStorage.getItem(THEME_PRESET_STORAGE_KEY) ?? ""
    } catch {
      return ""
    }
  })

  // Find the current preset (or undefined if Default)
  const currentPreset = THEME_PRESETS.find(p => p.id === presetId)

  // Apply theme whenever presetId or resolved theme changes
  useEffect(() => {
    const root = document.documentElement
    const mode = (resolvedTheme ?? "light") as "light" | "dark"
    applyThemeOrClear(currentPreset, mode, root)
  }, [presetId, resolvedTheme, currentPreset])

  const handleSetPreset = (id: string) => {
    setPresetId(id)
    try {
      window.localStorage.setItem(THEME_PRESET_STORAGE_KEY, id)
    } catch {
      /* ignore quota/availability errors */
    }
  }

  const value: ThemePresetContextValue = {
    presetId,
    setPreset: handleSetPreset,
  }

  return <ThemePresetContext.Provider value={value}>{children}</ThemePresetContext.Provider>
}
