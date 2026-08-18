import { FC } from 'react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@zoeymind/ui'
import { MINDMAP_ROLE_LABELS, canWriteMindmap, type MindmapRole } from '@zoeymind/shared'
import { useTranslation } from '@zoeymind/i18n'

interface PermissionIndicatorProps {
  role: MindmapRole
}

export const PermissionIndicator: FC<PermissionIndicatorProps> = ({ role }) => {
  const { t } = useTranslation()
  const writable = canWriteMindmap(role)
  const label = MINDMAP_ROLE_LABELS[role] ?? role

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={
            <span
              className={`flex items-center gap-1 ${writable ? 'text-success' : 'text-warning'}`}
            >
              {label}
            </span>
          }
        />
        <TooltipContent>
          <p>
            {writable
              ? t('mindmap.statusBar.editPermissionTooltip')
              : t('mindmap.statusBar.viewPermissionTooltip')}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
