import { ListTree, MousePointerClick, Tags, X } from "lucide-react"
import { Button, Separator } from "@zoeymind/ui"
import { useTranslation } from "@zoeymind/i18n"
import { TestCaseRulesMindMap } from "@/products/mind/features/mindmap/components/TestCaseRulesMindMap"
import { nodeIconList } from "simple-mind-map/src/svg/icons"

const iconByKey = Object.fromEntries(
  nodeIconList.flatMap(group =>
    group.list.map((item: { name: string; icon: string }) => [
      `${group.type}_${item.name}`,
      item.icon,
    ])
  )
) as Record<string, string>

function NodeTypeIcon({ iconKey }: { iconKey?: string }) {
  const icon = iconKey ? iconByKey[iconKey] : undefined
  return icon ? (
    <span
      className="flex size-6 items-center justify-center [&_svg]:size-5"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: icon }}
    />
  ) : (
    <span className="text-xs text-muted-foreground">—</span>
  )
}

function RuleRow({
  marker,
  title,
  description,
}: {
  marker: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="grid gap-3 py-4 sm:grid-cols-[7rem_10rem_1fr] sm:items-center">
      <div className="flex items-center">{marker}</div>
      <div className="text-sm font-medium text-foreground">{title}</div>
      <div className="text-sm text-muted-foreground text-pretty">{description}</div>
    </div>
  )
}

function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex min-w-7 items-center justify-center rounded-md border bg-background px-2 py-1 font-mono text-xs font-medium shadow-xs">
      {children}
    </kbd>
  )
}

export function TestCaseRulesPage({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()

  return (
    <div className="no-scrollbar min-h-0 flex-1 overflow-auto bg-muted/30">
      <main className="mx-auto w-full max-w-4xl px-8 py-10">
        <header className="flex items-start justify-between gap-6">
          <div className="max-w-2xl">
            <div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ListTree className="size-5" aria-hidden="true" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-balance">
              {t("projects.rules.title")}
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground text-pretty">
              {t("projects.rules.description")}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-10 shrink-0 text-muted-foreground active:scale-[0.96] transition-transform"
            onClick={onClose}
            aria-label={t("common.close")}
            title={t("common.close")}
          >
            <X className="size-5" aria-hidden="true" />
          </Button>
        </header>

        <section className="mt-10" aria-labelledby="node-rules-title">
          <h2 id="node-rules-title" className="text-base font-semibold">
            {t("projects.rules.nodeTypesTitle")}
          </h2>
          <div className="mt-3 rounded-2xl bg-background px-5 shadow-xs ring-1 ring-border/70">
            <RuleRow
              marker={<NodeTypeIcon iconKey="sign_2" />}
              title={t("projects.rules.moduleName")}
              description={t("projects.rules.moduleDescription")}
            />
            <Separator />
            <RuleRow
              marker={<NodeTypeIcon iconKey="priority_1" />}
              title={t("projects.rules.caseName")}
              description={t("projects.rules.caseDescription")}
            />
            <Separator />
            <RuleRow
              marker={<NodeTypeIcon />}
              title={t("projects.rules.stepName")}
              description={t("projects.rules.stepDescription")}
            />
          </div>
        </section>

        <section className="mt-8" aria-labelledby="text-rules-title">
          <h2 id="text-rules-title" className="text-base font-semibold">
            {t("projects.rules.textRulesTitle")}
          </h2>
          <div className="mt-3 overflow-hidden rounded-2xl bg-background shadow-xs ring-1 ring-border/70">
            <div className="grid gap-2 px-5 py-4 sm:grid-cols-[10rem_1fr] sm:items-center">
              <span className="text-sm font-medium">{t("projects.rules.caseTextLabel")}</span>
              <code className="w-fit rounded-md bg-muted px-2.5 py-1.5 text-sm">
                {t("projects.rules.caseTextFormat")}
              </code>
            </div>
            <Separator />
            <div className="grid gap-2 px-5 py-4 sm:grid-cols-[10rem_1fr] sm:items-center">
              <span className="text-sm font-medium">{t("projects.rules.stepTextLabel")}</span>
              <code className="w-fit rounded-md bg-muted px-2.5 py-1.5 text-sm">
                {t("projects.rules.stepTextFormat")}
              </code>
            </div>
            <div className="bg-muted/40 px-5 py-3 text-xs leading-5 text-muted-foreground">
              {t("projects.rules.separatorNote")}
            </div>
          </div>
        </section>

        <section className="mt-8" aria-labelledby="structure-rules-title">
          <h2 id="structure-rules-title" className="text-base font-semibold">
            {t("projects.rules.structureTitle")}
          </h2>
          <div className="mt-3 rounded-2xl bg-background p-5 shadow-xs ring-1 ring-border/70">
            <TestCaseRulesMindMap />
            <p className="mt-4 text-sm leading-6 text-muted-foreground text-pretty">
              {t("projects.rules.structureDescription")}
            </p>
          </div>
        </section>

        <section className="mt-8" aria-labelledby="priority-rules-title">
          <h2 id="priority-rules-title" className="text-base font-semibold">
            {t("projects.rules.priorityTitle")}
          </h2>
          <div className="mt-3 rounded-2xl bg-background px-5 shadow-xs ring-1 ring-border/70">
            <RuleRow
              marker={
                <div className="flex gap-1.5">
                  <NodeTypeIcon iconKey="priority_1" />
                  <NodeTypeIcon iconKey="priority_2" />
                  <NodeTypeIcon iconKey="priority_3" />
                </div>
              }
              title={t("projects.rules.priorityName")}
              description={t("projects.rules.priorityDescription")}
            />
          </div>
        </section>

        <section className="mt-8" aria-labelledby="shortcut-rules-title">
          <h2 id="shortcut-rules-title" className="text-base font-semibold">
            {t("projects.rules.shortcutsTitle")}
          </h2>
          <div className="mt-3 rounded-2xl bg-background p-5 shadow-xs ring-1 ring-border/70">
            <div className="flex items-start gap-3">
              <MousePointerClick
                className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <div className="space-y-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Key>`</Key>
                  <span className="text-muted-foreground">
                    {t("projects.rules.moduleShortcut")}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Key>1</Key>
                  <Key>2</Key>
                  <Key>3</Key>
                  <span className="text-muted-foreground">
                    {t("projects.rules.priorityShortcut")}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Key>Enter</Key>
                  <Key>Tab</Key>
                  <span className="text-muted-foreground">{t("projects.rules.nodeShortcut")}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="mt-10 flex items-center gap-2 text-xs text-muted-foreground">
          <Tags className="size-3.5" aria-hidden="true" />
          {t("projects.rules.footer")}
        </div>
      </main>
    </div>
  )
}
