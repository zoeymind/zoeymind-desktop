import { createContext, useContext } from "react"

export interface ThemePresetContextValue {
  presetId: string
  setPreset: (id: string) => void
}

export const ThemePresetContext = createContext<ThemePresetContextValue | undefined>(undefined)

export function useThemePreset(): ThemePresetContextValue {
  const context = useContext(ThemePresetContext)
  if (!context) throw new Error("useThemePreset must be used within ThemePresetProvider")
  return context
}
