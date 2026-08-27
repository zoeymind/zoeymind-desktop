export type AgentOnboardingTarget = "all" | "cli" | "mcp" | "skills"

const TARGET_STEPS: Record<AgentOnboardingTarget, string> = {
  all: `Install the latest packages globally:
   npm install --global @zoeymind/cli@latest @zoeymind/mcp@latest`,
  cli: `Install the latest CLI globally:
   npm install --global @zoeymind/cli@latest`,
  mcp: `Install the latest MCP server globally:
   npm install --global @zoeymind/mcp@latest`,
  skills: `Install the official Skill's default MCP execution adapter:
   npm install --global @zoeymind/mcp@latest`,
}

export function agentOnboardingPrompt(target: AgentOnboardingTarget): string {
  const needsMcp = target === "all" || target === "mcp" || target === "skills"
  const needsCli = target === "all" || target === "cli"
  const doctorCommands = [
    ...(needsCli ? ["zoeymind doctor --json"] : []),
    ...(needsMcp ? ["zoeymind-mcp doctor --json"] : []),
  ]

  return `Set up ZoeyMind local automation on this machine. Execute the work; do not only explain commands.

1. Detect whether this Agent is Claude Code, Codex, OpenCode, or OMP. Check Node.js before running npm or npx. If Node.js is absent or older than 22, install the current Node.js 22 LTS using the machine's existing version manager; when none exists, use the official installer from https://nodejs.org/en/download. Start a fresh shell, then verify [96mnode --version[0m, [96mnpm --version[0m, and [96mnpx --version[0m before continuing.
2. ${TARGET_STEPS[target]}
3. Install the official ZoeyMind Agent Skill globally for the detected host:
   npx --yes skills add zoeymind/zoeymind-desktop --skill zoeymind --global --agent <claude-code|codex|opencode|universal> --yes
   Use universal for OMP; OMP loads the resulting ~/.agents/skills/zoeymind directory natively.
4. ${
    needsMcp
      ? `Configure the local stdio MCP server under the key "zoeymind" without overwriting unrelated config.
   - Claude Code: inspect with \`claude mcp get zoeymind\`; if absent, run \`claude mcp add --scope user zoeymind -- zoeymind-mcp\`.
   - Codex: inspect with \`codex mcp get zoeymind --json\`; if absent, run \`codex mcp add zoeymind -- zoeymind-mcp\`.
   - OpenCode: safely merge this entry into the user config's \`mcp\` object: \`"zoeymind":{"type":"local","command":["zoeymind-mcp"],"enabled":true}\`.
   - OMP: safely merge \`"zoeymind":{"command":"zoeymind-mcp"}\` into the \`mcpServers\` object in \`~/.omp/agent/mcp.json\`.
   Preserve an existing correct entry; repair only the ZoeyMind entry when it points elsewhere.`
      : "No MCP configuration is required for this target."
  }
5. ZoeyMind Desktop must be running with Preferences → External automation enabled. A project should be open and ready. Do not start, stop, or restart Desktop yourself; ask the user if either prerequisite is missing.
6. Run these diagnostics and inspect every check:
   ${doctorCommands.length > 0 ? doctorCommands.join("\n   ") : "If @zoeymind/cli or @zoeymind/mcp is already installed, run its doctor; otherwise verify the installed skill with `npx --yes skills list --global --agent <detected-agent>`."}
7. Verify the host configuration and installed skill:
   - Claude Code: \`claude mcp get zoeymind\` when MCP is selected, and confirm the \`zoeymind\` skill is installed.
   - Codex: \`codex mcp get zoeymind --json\` when MCP is selected, and confirm the \`zoeymind\` skill is installed.
   - OpenCode: \`opencode mcp list\` when MCP is selected, and confirm the \`zoeymind\` skill is installed.
   - OMP: start one new ephemeral OMP session and confirm the \`zoeymind\` MCP server and Skill are discovered; OMP mounts MCP tools under its normal tool or \`xd://\` surface.
8. Load and follow the \`zoeymind\` skill. Perform one read-only outline query against the active project. Do not edit user content during setup verification.
9. If this running Agent cannot hot-load a newly added MCP server or skill, use the CLI doctor/read-only query when available, then explicitly tell the user to start one new Agent session. Do not claim MCP tools are available in the current session until they are discovered.
10. Report the detected host, commands executed, exact doctor check statuses, skill location, MCP status when selected, and read-only query result. Treat any doctor \`fail\` as incomplete and repair it before finishing.`
}
