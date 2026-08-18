import { useTranslation } from '@zoeymind/i18n'
import { FC } from 'react'
import { ThemeMenu } from '@/shared/app-shared'
import { PanelLayout } from './PanelLayout'

interface ThemePanelProps {
  isActive: boolean
}

export const ThemePanel: FC<ThemePanelProps> = ({ isActive }) => {
  const { t } = useTranslation()

  if (!isActive) return null

  return (
    <PanelLayout title={t('common.themePreset')} isActive={isActive} className="p-3">
      <ThemeMenu variant="inline" />
    </PanelLayout>
  )
}
