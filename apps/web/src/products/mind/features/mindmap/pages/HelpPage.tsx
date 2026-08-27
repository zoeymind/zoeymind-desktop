import { useState, type ReactNode } from "react"
import {
  BookOpen,
  Bot,
  Check,
  Code2,
  Copy,
  Keyboard,
  Server,
  Sparkles,
  Terminal,
  X,
} from "lucide-react"
import { Button, Separator } from "@zoeymind/ui"
import { useTranslation } from "@zoeymind/i18n"
import { TestCaseRulesPage } from "./TestCaseRulesPage"
import { agentOnboardingPrompt, type AgentOnboardingTarget } from "./agent-onboarding"
export type HelpPageId = "rules" | "agent" | "cli" | "mcp" | "skills" | "shortcuts"

interface HelpPageProps {
  page: HelpPageId
  onClose: () => void
}

const SHORTCUTS = [
  ["Ctrl/⌘ + F", "projects.help.shortcuts.search"],
  ["Enter", "projects.help.shortcuts.sibling"],
  ["Tab", "projects.help.shortcuts.child"],
  ["Alt + /", "projects.help.shortcuts.expand"],
  ["Ctrl/⌘ + C / X / V", "projects.help.shortcuts.clipboard"],
  ["1 / 2 / 3", "projects.help.shortcuts.priority"],
  ["· / `", "projects.help.shortcuts.module"],
] as const

export function HelpPage({ page, onClose }: HelpPageProps) {
  if (page === "rules") return <TestCaseRulesPage onClose={onClose} />
  if (page === "agent") return <AgentHelpPage onClose={onClose} />
  if (page === "cli") return <CliHelpPage onClose={onClose} />
  if (page === "mcp") return <McpHelpPage onClose={onClose} />
  if (page === "skills") return <SkillsHelpPage onClose={onClose} />
  return <ShortcutsHelpPage onClose={onClose} />
}

function HelpLayout({
  icon,
  title,
  description,
  onClose,
  children,
}: {
  icon: ReactNode
  title: string
  description: string
  onClose: () => void
  children: ReactNode
}) {
  const { t } = useTranslation()
  return (
    <div className="no-scrollbar min-h-0 flex-1 overflow-auto bg-muted/30">
      <main className="mx-auto w-full max-w-4xl px-8 py-10">
        <header className="flex items-start justify-between gap-6">
          <div className="max-w-2xl">
            <div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              {icon}
            </div>
            <h1 className="text-balance text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="mt-2 text-pretty text-sm leading-6 text-muted-foreground">
              {description}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-10 shrink-0 text-muted-foreground transition-transform active:scale-[0.96]"
            onClick={onClose}
            aria-label={t("common.close")}
          >
            <X className="size-5" />
          </Button>
        </header>
        <div className="mt-10 space-y-8">{children}</div>
      </main>
    </div>
  )
}

function HelpSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold">{title}</h2>
      <div className="overflow-hidden rounded-2xl bg-background shadow-xs ring-1 ring-border/70">
        {children}
      </div>
    </section>
  )
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto bg-muted/40 px-5 py-4 text-xs leading-6">
      <code>{children}</code>
    </pre>
  )
}
function ForAgentBlock({ target }: { target: AgentOnboardingTarget }) {
  const { t } = useTranslation()
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle")
  const prompt = agentOnboardingPrompt(target)

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(prompt)
      setCopyState("copied")
    } catch {
      setCopyState("failed")
    }
  }

  return (
    <HelpSection title={t("projects.help.forAgent.title")}>
      <div className="flex items-center justify-between gap-4 border-b px-5 py-3">
        <p className="text-pretty text-sm leading-6 text-muted-foreground">
          {t("projects.help.forAgent.description")}
        </p>
        <Button
          type="button"
          variant="outline"
          className="h-10 shrink-0 transition-transform active:scale-[0.96]"
          onClick={() => void copyPrompt()}
        >
          {copyState === "copied" ? <Check /> : <Copy />}
          {t(
            copyState === "copied"
              ? "projects.help.forAgent.copied"
              : copyState === "failed"
                ? "projects.help.forAgent.copyFailed"
                : "projects.help.forAgent.copy"
          )}
        </Button>
      </div>
      <CodeBlock>{prompt}</CodeBlock>
    </HelpSection>
  )
}

function AgentHelpPage({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  return (
    <HelpLayout
      icon={<Bot className="size-5" />}
      title={t("projects.help.agent.title")}
      description={t("projects.help.agent.description")}
      onClose={onClose}
    >
      <ForAgentBlock target="all" />
      <p className="text-pretty text-sm leading-6 text-muted-foreground">
        {t("projects.help.desktopRequirement")}
      </p>
    </HelpLayout>
  )
}

function CliHelpPage({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  return (
    <HelpLayout
      icon={<Terminal className="size-5" />}
      title={t("projects.help.cli.title")}
      description={t("projects.help.cli.description")}
      onClose={onClose}
    >
      <HelpSection title={t("projects.help.installation")}>
        <CodeBlock>{"npm install --global @zoeymind/cli\nzoeymind --help"}</CodeBlock>
      </HelpSection>
      <ForAgentBlock target="cli" />
      <HelpSection title={t("projects.help.cli.commandsTitle")}>
        <CommandRow command="zoeymind doctor --json" description={t("projects.help.cli.doctor")} />
        <Separator />
        <CommandRow command="zoeymind projects" description={t("projects.help.cli.projects")} />
        <Separator />
        <CommandRow
          command={'zoeymind query_current_mindmap \'{"mode":"outline","maxLines":200}\''}
          description={t("projects.help.cli.query")}
        />
        <Separator />
        <CommandRow
          command={
            'zoeymind edit_current_mindmap \'{"anchorTag":"<查询返回的 anchorTag>","patch":"PUT 1.=1:\\n+更新后的项目主题"}\''
          }
          description={t("projects.help.cli.edit")}
        />
      </HelpSection>
      <p className="text-pretty text-sm leading-6 text-muted-foreground">
        {t("projects.help.desktopRequirement")}
      </p>
    </HelpLayout>
  )
}

function McpHelpPage({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  return (
    <HelpLayout
      icon={<Server className="size-5" />}
      title={t("projects.help.mcp.title")}
      description={t("projects.help.mcp.description")}
      onClose={onClose}
    >
      <HelpSection title={t("projects.help.installation")}>
        <CodeBlock>{"npm install --global @zoeymind/mcp"}</CodeBlock>
      </HelpSection>
      <HelpSection title={t("projects.help.mcp.configTitle")}>
        <CodeBlock>
          {'{\n  "mcpServers": {\n    "zoeymind": { "command": "zoeymind-mcp" }\n  }\n}'}
        </CodeBlock>
      </HelpSection>
      <ForAgentBlock target="mcp" />
      <HelpSection title={t("projects.help.mcp.toolsTitle")}>
        <div className="divide-y px-5">
          {["projects", "activate_project", "query_current_mindmap", "edit_current_mindmap"].map(
            tool => (
              <div key={tool} className="flex items-center gap-4 py-3">
                <Code2 className="size-4 shrink-0 text-muted-foreground" />
                <code className="text-xs">{tool}</code>
              </div>
            )
          )}
        </div>
      </HelpSection>
      <p className="text-pretty text-sm leading-6 text-muted-foreground">
        {t("projects.help.desktopRequirement")}
      </p>
    </HelpLayout>
  )
}
function SkillsHelpPage({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  return (
    <HelpLayout
      icon={<Sparkles className="size-5" />}
      title={t("projects.help.skills.title")}
      description={t("projects.help.skills.description")}
      onClose={onClose}
    >
      <HelpSection title={t("projects.help.installation")}>
        <CodeBlock>
          {
            "npx --yes skills add zoeymind/zoeymind-desktop --skill zoeymind --global --agent <claude-code|codex|opencode|universal> --yes"
          }
        </CodeBlock>
      </HelpSection>
      <ForAgentBlock target="skills" />
      <p className="text-pretty text-sm leading-6 text-muted-foreground">
        {t("projects.help.skills.hint")}
      </p>
    </HelpLayout>
  )
}

function CommandRow({ command, description }: { command: string; description: string }) {
  return (
    <div className="grid gap-2 px-5 py-4 sm:grid-cols-[15rem_1fr] sm:items-center">
      <code className="text-xs">{command}</code>
      <span className="text-sm text-muted-foreground">{description}</span>
    </div>
  )
}

function ShortcutsHelpPage({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  return (
    <HelpLayout
      icon={<Keyboard className="size-5" />}
      title={t("projects.help.shortcuts.title")}
      description={t("projects.help.shortcuts.description")}
      onClose={onClose}
    >
      <HelpSection title={t("projects.help.shortcuts.editorTitle")}>
        <div className="divide-y px-5">
          {SHORTCUTS.map(([keys, descriptionKey]) => (
            <div key={keys} className="flex items-center justify-between gap-6 py-3">
              <span className="text-sm text-muted-foreground">{t(descriptionKey)}</span>
              <kbd className="shrink-0 rounded-md border bg-muted px-2 py-1 font-mono text-xs shadow-xs">
                {keys}
              </kbd>
            </div>
          ))}
        </div>
      </HelpSection>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <BookOpen className="size-3.5" />
        {t("projects.help.shortcuts.hint")}
      </div>
    </HelpLayout>
  )
}
