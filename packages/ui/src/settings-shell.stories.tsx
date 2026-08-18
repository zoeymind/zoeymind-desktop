import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { KeyIcon, SettingsIcon, UserIcon } from 'lucide-react'
import { SettingsShell } from './settings-shell'
import { Button } from './button'

const meta: Meta<typeof SettingsShell> = {
  title: 'Layout/SettingsShell',
  component: SettingsShell,
  tags: ['autodocs']
}

export default meta
type Story = StoryObj<typeof SettingsShell>

const ITEMS = [
  { id: 'profile', label: '个人资料', icon: UserIcon },
  { id: 'account', label: '账号设置', icon: SettingsIcon },
  { id: 'security', label: '安全', icon: KeyIcon }
]

function Demo() {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState('profile')
  return (
    <>
      <Button onClick={() => setOpen(true)}>打开设置</Button>
      <SettingsShell
        open={open}
        onOpenChange={setOpen}
        title="设置"
        description="管理你的账号与偏好"
        items={ITEMS}
        activeId={active}
        onActiveChange={setActive}
      >
        <div className="text-sm text-muted-foreground">当前分区: {active}</div>
      </SettingsShell>
    </>
  )
}

export const Default: Story = { render: () => <Demo /> }
