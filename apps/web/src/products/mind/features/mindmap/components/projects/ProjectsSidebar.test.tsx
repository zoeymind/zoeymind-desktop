// @vitest-environment jsdom

import { fireEvent, render } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ProjectsSidebar } from "./ProjectsSidebar"

vi.mock("@zoeymind/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock("@/shared/app-shared", () => ({ AppVersionStatus: () => null }))
vi.mock("./NewProjectMenu", () => ({ NewProjectMenu: () => null }))
vi.mock("./SidebarFolders", () => ({ SidebarFolders: () => null }))

describe("ProjectsSidebar help", () => {
  it("opens each help page from one footer menu", () => {
    const onOpenHelp = vi.fn()
    const view = render(
      <ProjectsSidebar
        activeView="all"
        activeFolderId={null}
        onViewChange={vi.fn()}
        onSelectFolder={vi.fn()}
        helpPage={null}
        onOpenHelp={onOpenHelp}
        collapsed={false}
        onToggleCollapse={vi.fn()}
      />
    )

    fireEvent.click(view.getByText("projects.help.entry"))
    fireEvent.click(view.getByText("projects.help.agent.entry"))
    expect(onOpenHelp).toHaveBeenLastCalledWith("agent")

    fireEvent.click(view.getByText("projects.help.entry"))
    fireEvent.click(view.getByText("projects.help.cli.entry"))
    expect(onOpenHelp).toHaveBeenLastCalledWith("cli")

    fireEvent.click(view.getByText("projects.help.entry"))
    fireEvent.click(view.getByText("projects.help.mcp.entry"))
    expect(onOpenHelp).toHaveBeenLastCalledWith("mcp")
    fireEvent.click(view.getByText("projects.help.entry"))
    fireEvent.click(view.getByText("projects.help.skills.entry"))
    expect(onOpenHelp).toHaveBeenLastCalledWith("skills")

    fireEvent.click(view.getByText("projects.help.entry"))
    fireEvent.click(view.getByText("projects.help.shortcuts.entry"))
    expect(onOpenHelp).toHaveBeenLastCalledWith("shortcuts")

    fireEvent.click(view.getByText("projects.help.entry"))
    fireEvent.click(view.getByText("projects.rules.entry"))
    expect(onOpenHelp).toHaveBeenLastCalledWith("rules")
  })
})
