import type { Meta, StoryObj } from '@storybook/react'
import { Separator } from './separator'

const meta: Meta<typeof Separator> = {
  title: 'Display/Separator',
  component: Separator,
  tags: ['autodocs']
}

export default meta
type Story = StoryObj<typeof Separator>

export const Horizontal: Story = {
  render: () => (
    <div className="w-64">
      <div className="text-sm">上方内容</div>
      <Separator className="my-3" />
      <div className="text-sm">下方内容</div>
    </div>
  )
}

export const Vertical: Story = {
  render: () => (
    <div className="flex h-10 items-center gap-3 text-sm">
      <span>博客</span>
      <Separator orientation="vertical" />
      <span>文档</span>
      <Separator orientation="vertical" />
      <span>关于</span>
    </div>
  )
}
