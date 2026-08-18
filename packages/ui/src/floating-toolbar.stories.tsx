import type { Meta, StoryObj } from '@storybook/react'
import { BoldIcon, ItalicIcon, LinkIcon, UnderlineIcon } from 'lucide-react'
import {
  FloatingToolbar,
  FloatingToolbarButton,
  FloatingToolbarGroup,
  FloatingToolbarSeparator
} from './floating-toolbar'

const meta: Meta<typeof FloatingToolbar> = {
  title: 'Widgets/FloatingToolbar',
  component: FloatingToolbar,
  tags: ['autodocs'],
  parameters: { layout: 'centered' }
}

export default meta
type Story = StoryObj<typeof FloatingToolbar>

export const Default: Story = {
  render: () => (
    <div className="relative grid h-64 w-96 place-items-center bg-muted/30 text-sm text-muted-foreground">
      画布区域
      <FloatingToolbar position="custom" className="!static">
        <FloatingToolbarGroup>
          <FloatingToolbarButton active>
            <BoldIcon className="size-4" />
          </FloatingToolbarButton>
          <FloatingToolbarButton>
            <ItalicIcon className="size-4" />
          </FloatingToolbarButton>
          <FloatingToolbarButton>
            <UnderlineIcon className="size-4" />
          </FloatingToolbarButton>
          <FloatingToolbarSeparator />
          <FloatingToolbarButton>
            <LinkIcon className="size-4" />
          </FloatingToolbarButton>
        </FloatingToolbarGroup>
      </FloatingToolbar>
    </div>
  )
}
