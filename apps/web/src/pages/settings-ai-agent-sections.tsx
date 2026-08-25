import { useState, type ReactNode } from "react"
import { CheckCircle2 } from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  Switch,
} from "@zoeymind/ui"
import { useTranslation } from "@zoeymind/i18n"
import { LOCAL_AI_TOOLS } from "@/products/mind/x/ai-chat/local-tools"
import { MemorySettingsTab } from "@/products/mind/x/ai-chat/components/inputView/MemorySettingsTab"
import { useDocumentEditApprovalSetting } from "@/products/mind/x/ai-chat/hooks/useDocumentEditApprovalSetting"
import {
  getMindmapContextEnabled,
  setMindmapContextEnabled,
} from "@/products/mind/x/ai-chat/hooks/useUserPrompt"

export function AIAgentSettingsSection() {
  const { t } = useTranslation()
  const [mindmapContextEnabled, setMindmapContextEnabledState] = useState(() =>
    getMindmapContextEnabled()
  )
  const { enabled: editApprovalEnabled, setEnabled: setEditApprovalEnabled } =
    useDocumentEditApprovalSetting()

  const updateMindmapContext = (enabled: boolean) => {
    setMindmapContextEnabled(enabled)
    setMindmapContextEnabledState(enabled)
  }

  return (
    <div className="space-y-6">
      <SectionCard title={t("settings.aiAgentBehavior")}>
        <FieldGroup>
          <ToggleRow
            id="mindmap-context"
            label={t("mindmap.aiChat.input.mindmapContextLabel")}
            hint={t("mindmap.aiChat.input.mindmapContextHint")}
            checked={mindmapContextEnabled}
            onCheckedChange={updateMindmapContext}
          />
          <ToggleRow
            id="edit-review"
            label={t("mindmap.aiChat.input.reviewToggleLabel")}
            hint={t("mindmap.aiChat.input.reviewToggleHint")}
            checked={editApprovalEnabled}
            onCheckedChange={setEditApprovalEnabled}
          />
        </FieldGroup>
      </SectionCard>

      <SectionCard
        title={t("mindmap.aiChat.input.tabTools")}
        description={t("mindmap.aiChat.toolToggles.sectionDescription")}
      >
        <FieldGroup>
          {LOCAL_AI_TOOLS.map(tool => (
            <Field key={tool.name} orientation="horizontal">
              <FieldContent>
                <FieldLabel>
                  {t(`mindmap.aiChat.toolToggles.${tool.name}.label` as const)}
                </FieldLabel>
                <FieldDescription>
                  {t(`mindmap.aiChat.toolToggles.${tool.name}.hint` as const)}
                </FieldDescription>
              </FieldContent>
              <span className="inline-flex items-center gap-1 text-xs text-success">
                <CheckCircle2 className="size-3.5" />
                {t("mindmap.aiChat.toolToggles.available")}
              </span>
            </Field>
          ))}
        </FieldGroup>
      </SectionCard>

      <SectionCard
        title={t("mindmap.aiChat.input.tabMemory")}
        description={t("mindmap.aiChat.memory.enableHint")}
      >
        <MemorySettingsTab />
      </SectionCard>
    </div>
  )
}

function ToggleRow({
  id,
  label,
  hint,
  checked,
  onCheckedChange,
}: {
  id: string
  label: string
  hint?: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <Field orientation="horizontal">
      <FieldContent>
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        {hint ? <FieldDescription>{hint}</FieldDescription> : null}
      </FieldContent>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </Field>
  )
}

export function SettingsSectionCard({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <SectionCard title={title} description={description}>
      {children}
    </SectionCard>
  )
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-sm">{title}</CardTitle>
        {description ? <CardDescription className="text-xs">{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}
