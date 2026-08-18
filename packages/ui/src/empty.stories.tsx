import type { Meta, StoryObj } from '@storybook/react'
import { InboxIcon, FileTextIcon } from 'lucide-react'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from './empty'
import { Button } from './button'

const meta: Meta<typeof Empty> = {
  title: 'Display/Empty',
  component: Empty,
  tags: ['autodocs'],
  parameters: { layout: 'padded' }
}

export default meta
type Story = StoryObj<typeof Empty>

export const Default: Story = {
  render: () => (
    <Empty className="w-96">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <InboxIcon />
        </EmptyMedia>
        <EmptyTitle>暂无消息</EmptyTitle>
        <EmptyDescription>你没有收到新的通知，稍后再来看看。</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}

export const WithAction: Story = {
  render: () => (
    <Empty className="w-96">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FileTextIcon />
        </EmptyMedia>
        <EmptyTitle>还没有项目</EmptyTitle>
        <EmptyDescription>创建第一个思维导图，开始你的协作。</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button size="sm">创建项目</Button>
      </EmptyContent>
    </Empty>
  )
}
