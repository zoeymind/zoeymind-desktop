import type { Meta, StoryObj } from '@storybook/react'
import { BoldIcon, ItalicIcon, UnderlineIcon } from 'lucide-react'
import { Toggle } from './toggle'

const meta: Meta<typeof Toggle> = {
  title: 'Form/Toggle',
  component: Toggle,
  tags: ['autodocs'],
  argTypes: {
    variant: { control: 'select', options: ['default', 'outline'] },
    size: { control: 'select', options: ['default', 'sm', 'lg'] }
  },
  args: { children: 'Bold' }
}

export default meta
type Story = StoryObj<typeof Toggle>

export const Default: Story = {}

export const Variants: Story = {
  render: () => (
    <div className="flex gap-3">
      <Toggle>Default</Toggle>
      <Toggle variant="outline">Outline</Toggle>
    </div>
  )
}

export const WithIcon: Story = {
  render: () => (
    <div className="flex gap-2">
      <Toggle aria-label="加粗">
        <BoldIcon />
      </Toggle>
      <Toggle aria-label="斜体">
        <ItalicIcon />
      </Toggle>
      <Toggle aria-label="下划线">
        <UnderlineIcon />
      </Toggle>
    </div>
  )
}
