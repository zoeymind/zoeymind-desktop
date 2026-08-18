import type { Meta, StoryObj } from '@storybook/react'
import { Input } from './input'
import { Label } from './label'

const meta: Meta<typeof Input> = {
  title: 'Primitives/Input',
  component: Input,
  tags: ['autodocs'],
  args: { placeholder: '请输入...' }
}

export default meta
type Story = StoryObj<typeof Input>

export const Default: Story = {}

export const WithLabel: Story = {
  render: () => (
    <div className="flex w-72 flex-col gap-2">
      <Label htmlFor="email">邮箱</Label>
      <Input id="email" type="email" placeholder="you@zoey.dev" />
    </div>
  )
}

export const Invalid: Story = {
  args: { 'aria-invalid': true, defaultValue: 'not-an-email' }
}

export const Disabled: Story = {
  args: { disabled: true, defaultValue: 'readonly' }
}
