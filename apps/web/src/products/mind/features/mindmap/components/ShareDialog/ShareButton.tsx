import { useState } from 'react'
import { Share2 } from 'lucide-react'
import { ShareDialog } from './ShareDialog'
import { FloatingToolbarButton } from '@zoeymind/ui'
import { useTranslation } from '@zoeymind/i18n'

interface ShareButtonProps {
  workspaceId: string
  projectTitle: string
  cloudMode?: boolean
}

export function ShareButton({ workspaceId, projectTitle, cloudMode = true }: ShareButtonProps) {
  const { t } = useTranslation()
  const [showShareDialog, setShowShareDialog] = useState(false)

  // 只在云模式下显示分享按钮
  if (!cloudMode || !workspaceId) {
    return null
  }

  return (
    <>
      <FloatingToolbarButton
        onClick={() => setShowShareDialog(true)}
        title={t('mindmap.shareDialog.buttonTooltip')}
      >
        <Share2 className="size-5" />
      </FloatingToolbarButton>

      <ShareDialog
        open={showShareDialog}
        onOpenChange={setShowShareDialog}
        workspaceId={workspaceId}
        projectTitle={projectTitle}
      />
    </>
  )
}
