import { create } from "zustand"

export type SettingsSectionId = "preferences" | "editor" | "ai" | "agent" | "mcp" | "about"

interface SettingsDialogState {
  open: boolean
  section: SettingsSectionId
  openSettings: (section?: SettingsSectionId) => void
  closeSettings: () => void
  setSection: (section: SettingsSectionId) => void
}

export const useSettingsDialog = create<SettingsDialogState>(set => ({
  open: false,
  section: "preferences",
  openSettings: section => set(state => ({ open: true, section: section ?? state.section })),
  closeSettings: () => set({ open: false }),
  setSection: section => set({ section }),
}))
