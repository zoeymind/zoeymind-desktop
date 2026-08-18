import type { Meta, StoryObj } from '@storybook/react'
import { Label } from './label'
import { Input } from './input'

const meta: Meta<typeof Label> = {
  title: 'Form/Label',
  component: Label,
  tags: ['autodocs'],
  args: { children: '邮箱' }
}

export default meta
type Story = StoryObj<typeof Label>

export const Default: Story = {}

export const WithInput: Story = {
  render: () => (
    <div className="flex w-72 flex-col gap-2">
      <Label htmlFor="input-a">用户名</Label>
      <Input id="input-a" placeholder="zoeymind" />
    </div>
  )
}
