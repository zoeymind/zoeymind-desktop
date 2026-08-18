import type { Meta, StoryObj } from '@storybook/react'
import { Textarea } from './textarea'
import { Label } from './label'

const meta: Meta<typeof Textarea> = {
  title: 'Form/Textarea',
  component: Textarea,
  tags: ['autodocs'],
  args: { placeholder: '写点什么...', rows: 4 }
}

export default meta
type Story = StoryObj<typeof Textarea>

export const Default: Story = {}

export const WithLabel: Story = {
  render: () => (
    <div className="flex w-80 flex-col gap-2">
      <Label htmlFor="msg">留言</Label>
      <Textarea id="msg" placeholder="说一下你需要访问的原因..." rows={4} />
    </div>
  )
}

export const Invalid: Story = {
  args: { 'aria-invalid': true, defaultValue: '内容过长' }
}

export const Disabled: Story = {
  args: { disabled: true, defaultValue: '只读内容' }
}
