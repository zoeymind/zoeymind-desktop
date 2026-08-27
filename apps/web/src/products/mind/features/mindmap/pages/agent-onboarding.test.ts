import { describe, expect, it } from "vitest"
import { agentOnboardingPrompt } from "./agent-onboarding"

describe("ZoeyMind For Agent onboarding prompt", () => {
  it("installs and verifies the full CLI, MCP, and Skill path", () => {
    const prompt = agentOnboardingPrompt("all")

    expect(prompt).toContain("@zoeymind/cli@latest @zoeymind/mcp@latest")
    expect(prompt).toContain("https://nodejs.org/en/download")
    expect(prompt).toContain("node --version")
    expect(prompt).toContain("skills add zoeymind/zoeymind-desktop --skill zoeymind")
    expect(prompt).toContain("claude mcp add --scope user zoeymind -- zoeymind-mcp")
    expect(prompt).toContain("codex mcp add zoeymind -- zoeymind-mcp")
    expect(prompt).toContain('"type":"local","command":["zoeymind-mcp"]')
    expect(prompt).toContain("--agent <claude-code|codex|opencode|universal>")
    expect(prompt).toContain('"zoeymind":{"command":"zoeymind-mcp"}')
    expect(prompt).toContain("~/.omp/agent/mcp.json")
    expect(prompt).toContain("new ephemeral OMP session")
    expect(prompt).toContain("zoeymind doctor --json")
    expect(prompt).toContain("zoeymind-mcp doctor --json")
    expect(prompt).toContain("one read-only outline query")
    expect(prompt).toContain("Do not claim MCP tools are available")
  })

  it("keeps CLI setup independent from MCP configuration", () => {
    const prompt = agentOnboardingPrompt("cli")

    expect(prompt).toContain("@zoeymind/cli@latest")
    expect(prompt).toContain("No MCP configuration is required")
    expect(prompt).toContain("zoeymind doctor --json")
    expect(prompt).not.toContain("zoeymind-mcp doctor --json")
  })

  it("installs a skill with an executable MCP adapter", () => {
    const prompt = agentOnboardingPrompt("skills")

    expect(prompt).toContain("npm install --global @zoeymind/mcp@latest")
    expect(prompt).toContain("skills add zoeymind/zoeymind-desktop")
    expect(prompt).toContain("zoeymind-mcp doctor --json")
    expect(prompt).toContain("Load and follow the `zoeymind` skill")
  })
})
