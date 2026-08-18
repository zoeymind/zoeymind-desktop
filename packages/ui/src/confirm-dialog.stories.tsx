import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { ConfirmDialog } from './confirm-dialog'
import { Button } from './button'

const meta: Meta<typeof ConfirmDialog> = {
  title: 'Overlay/ConfirmDialog',
  component: ConfirmDialog,
  tags: ['autodocs']
}

export default meta
type Story = StoryObj<typeof ConfirmDialog>

function Demo(props: { variant?: 'default' | 'destructive' }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant={props.variant} onClick={() => setOpen(true)}>
        触发确认
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="确认操作"
        description="确定要执行这一操作吗？此步骤会立即生效。"
        variant={props.variant}
        onConfirm={() => {
          // demo only
        }}
      />
    </>
  )
}

export const Default: Story = { render: () => <Demo /> }
export const Destructive: Story = { render: () => <Demo variant="destructive" /> }
