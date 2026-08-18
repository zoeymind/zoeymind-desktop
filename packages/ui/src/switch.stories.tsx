import type { Meta, StoryObj } from '@storybook/react'
import { Switch } from './switch'
import { Label } from './label'

const meta: Meta<typeof Switch> = {
  title: 'Form/Switch',
  component: Switch,
  tags: ['autodocs'],
  argTypes: {
    size: { control: 'select', options: ['default', 'sm'] }
  }
}

export default meta
type Story = StoryObj<typeof Switch>

export const Default: Story = {}

export const WithLabel: Story = {
  render: () => (
    <Label className="gap-3">
      <Switch defaultChecked />
      开启通知
    </Label>
  )
}

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-6">
      <Switch size="sm" defaultChecked />
      <Switch size="default" defaultChecked />
    </div>
  )
}

export const Loading: Story = {
  render: () => <Switch isLoading defaultChecked />
}

export const Disabled: Story = {
  args: { disabled: true, defaultChecked: true }
}
