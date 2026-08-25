// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { SettingsDialog } from "./SettingsDialog"
import { useSettingsDialog } from "@/shared/app-shared"
import { ThemeProvider } from "@zoeymind/ui"

vi.mock("@zoeymind/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock("@/shared/native", () => ({
  loadModelsConfig: vi.fn().mockResolvedValue({ providers: [], models: [] }),
  saveModelsConfig: vi.fn(),
  fetchProviderModels: vi.fn(),
  openGitHubSupport: vi.fn(),
}))
vi.mock("@/shared/app-shared", async importOriginal => {
  const original = await importOriginal<typeof import("@/shared/app-shared")>()
  return {
    ...original,
    AppVersionStatus: () => null,
  }
})
vi.mock("./settings-preference-sections", () => ({
  PreferencesSettingsSection: () => <div>preferences-content</div>,
  EditorSettingsSection: () => <div>editor-content</div>,
  LogSettingsSection: () => <div>log-content</div>,
}))
vi.mock("./settings-ai-agent-sections", () => ({
  AIAgentSettingsSection: () => <div>agent-content</div>,
  SettingsSectionCard: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))
vi.mock("@/products/mind/x/ai-chat/settings/MCPTab", () => ({
  MCPTab: () => <div>mcp-content</div>,
}))

describe("SettingsDialog navigation", () => {
  it("contains editor, AI Agent, and MCP in the global settings shell", () => {
    useSettingsDialog.setState({ open: true, section: "preferences" })
    const view = render(
      <ThemeProvider defaultTheme="light">
        <SettingsDialog open onOpenChange={vi.fn()} />
      </ThemeProvider>
    )

    expect(view.getByText("preferences-content")).toBeTruthy()

    fireEvent.click(view.getByTestId("settings-nav-editor"))
    expect(view.getByText("editor-content")).toBeTruthy()

    fireEvent.click(view.getByTestId("settings-nav-agent"))
    expect(view.getByText("agent-content")).toBeTruthy()

    fireEvent.click(view.getByTestId("settings-nav-mcp"))
    expect(view.getByText("mcp-content")).toBeTruthy()

    fireEvent.click(view.getByTestId("settings-nav-about"))
    expect(view.getByText("log-content")).toBeTruthy()
    const logo = document.querySelector("img[alt='']")
    expect(logo).toBeTruthy()
    expect(logo?.getAttribute("src")).toBeTruthy()
    expect(view.getByText("ZoeyMind Desktop")).toBeTruthy()
    expect(view.getByText("settings.githubSupportAction")).toBeTruthy()
    expect(view.getByText("settings.diagnostics")).toBeTruthy()
    expect(screen.getByText("<Documents>/ZoeyMind")).toBeTruthy()
    expect(screen.getByText("<appData>/models.json")).toBeTruthy()
  })
})
