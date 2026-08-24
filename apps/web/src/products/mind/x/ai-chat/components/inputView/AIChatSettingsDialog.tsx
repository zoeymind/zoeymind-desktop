/**
 * AIChatSettingsDialog — AI 聊天的设置面板.
 *
 * 布局参考 qms ProjectSettingsContent / admin SettingsLayout 的"左侧导航 + 右侧 Card 内容"
 * 模式. 跟其它产品里设置交互对齐.
 *
 * sections:
 *   - general 通用 (用例审查 + 思维导图上下文)
 *   - memory  长期记忆 (跨对话语义召回)
 *   - mcp     MCP 服务器
 */

import { useState, type ReactNode } from "react"
import { useTranslation } from "@zoeymind/i18n"
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
  SettingsShell,
  Switch,
} from "@zoeymind/ui"
import { CheckCircle2, Settings, Sparkles, Server, Wrench } from "lucide-react"
import { LOCAL_AI_TOOLS } from "../../local-tools"
import { MemorySettingsTab } from "./MemorySettingsTab"
import { MCPTab } from "../../settings/MCPTab"
import { useDocumentEditApprovalSetting } from "../../hooks/useDocumentEditApprovalSetting"

export interface AIChatSettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mindmapContextEnabled: boolean
  onMindmapContextEnabledChange: (enabled: boolean) => void
}

type SectionId = "general" | "tools" | "memory" | "mcp"

interface Section {
  id: SectionId
  labelKey: string
  icon: typeof Settings
}

export function AIChatSettingsDialog({
  open,
  onOpenChange,
  mindmapContextEnabled,
  onMindmapContextEnabledChange,
}: AIChatSettingsDialogProps) {
  const { t } = useTranslation()
  const [activeSection, setActiveSection] = useState<SectionId>("general")

  const sections: Section[] = [
    { id: "general", labelKey: "mindmap.aiChat.input.tabGeneral", icon: Settings },
    { id: "tools", labelKey: "mindmap.aiChat.input.tabTools", icon: Wrench },
    { id: "memory", labelKey: "mindmap.aiChat.input.tabMemory", icon: Sparkles },
    { id: "mcp", labelKey: "mindmap.aiChat.input.tabMcp", icon: Server },
  ]

  return (
    <SettingsShell
      open={open}
      onOpenChange={onOpenChange}
      title={t("common.settings")}
      items={sections.map(s => ({ id: s.id, label: t(s.labelKey), icon: s.icon }))}
      activeId={activeSection}
      onActiveChange={id => setActiveSection(id as SectionId)}
    >
      {activeSection === "general" && (
        <GeneralSection
          mindmapContextEnabled={mindmapContextEnabled}
          onMindmapContextEnabledChange={onMindmapContextEnabledChange}
        />
      )}

      {activeSection === "tools" && <ToolsSection />}

      {activeSection === "memory" && (
        <SectionCard
          title={t("mindmap.aiChat.input.tabMemory")}
          description={t("mindmap.aiChat.memory.enableHint")}
        >
          <MemorySettingsTab />
        </SectionCard>
      )}

      {activeSection === "mcp" && (
        <SectionCard
          title={t("mindmap.aiChat.input.tabMcp")}
          description={t("mindmap.aiChat.mcp.sectionDescription", { defaultValue: "" })}
        >
          <MCPTab />
        </SectionCard>
      )}
    </SettingsShell>
  )
}

/** 统一的 Card 包装, 跟 qms 设置页风格对齐 */
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
        {description && <CardDescription className="text-xs">{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

interface GeneralSectionProps {
  mindmapContextEnabled: boolean
  onMindmapContextEnabledChange: (enabled: boolean) => void
}

function GeneralSection({
  mindmapContextEnabled,
  onMindmapContextEnabledChange,
}: GeneralSectionProps) {
  const { t } = useTranslation()
  const { enabled: editApprovalEnabled, setEnabled: setEditApprovalEnabled } =
    useDocumentEditApprovalSetting()

  return (
    <SectionCard title={t("mindmap.aiChat.input.tabGeneral")}>
      <FieldGroup>
        {/* 思维导图数据感知开关 */}
        <ToggleRow
          id="mindmap-context"
          label={t("mindmap.aiChat.input.mindmapContextLabel")}
          hint={t("mindmap.aiChat.input.mindmapContextHint")}
          checked={mindmapContextEnabled}
          onCheckedChange={onMindmapContextEnabledChange}
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
  )
}

interface ToggleRowProps {
  id: string
  label: string
  hint?: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}

function ToggleRow({ id, label, hint, checked, onCheckedChange }: ToggleRowProps) {
  return (
    <Field orientation="horizontal">
      <FieldContent>
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        {hint && <FieldDescription>{hint}</FieldDescription>}
      </FieldContent>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </Field>
  )
}

/** Desktop only exposes tools with complete local executors. */
function ToolsSection() {
  const { t } = useTranslation()

  return (
    <SectionCard
      title={t("mindmap.aiChat.input.tabTools")}
      description={t("mindmap.aiChat.toolToggles.sectionDescription")}
    >
      <FieldGroup>
        {LOCAL_AI_TOOLS.map(tool => (
          <Field key={tool.name} orientation="horizontal">
            <FieldContent>
              <FieldLabel>{t(`mindmap.aiChat.toolToggles.${tool.name}.label` as const)}</FieldLabel>
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
  )
}
