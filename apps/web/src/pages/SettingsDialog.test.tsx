// @vitest-environment jsdom

import { fireEvent, render } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { SettingsDialog } from "./SettingsDialog"
import { useSettingsDialog } from "@/shared/app-shared"

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
    const view = render(<SettingsDialog open onOpenChange={vi.fn()} />)

    expect(view.getByText("preferences-content")).toBeTruthy()

    fireEvent.click(view.getByTestId("settings-nav-editor"))
    expect(view.getByText("editor-content")).toBeTruthy()

    fireEvent.click(view.getByTestId("settings-nav-agent"))
    expect(view.getByText("agent-content")).toBeTruthy()

    fireEvent.click(view.getByTestId("settings-nav-mcp"))
    expect(view.getByText("mcp-content")).toBeTruthy()

    fireEvent.click(view.getByTestId("settings-nav-about"))
    expect(view.getByText("log-content")).toBeTruthy()
  })
})
