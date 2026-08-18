import type { Meta, StoryObj } from '@storybook/react'
import { CircularProgress } from './circular-progress'

const meta: Meta<typeof CircularProgress> = {
  title: 'Display/CircularProgress',
  component: CircularProgress,
  tags: ['autodocs']
}

export default meta
type Story = StoryObj<typeof CircularProgress>

export const Default: Story = {
  render: () => <CircularProgress current={40} total={100} size={20} />
}

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-6">
      <CircularProgress current={30} total={100} size={14} />
      <CircularProgress current={60} total={100} size={20} />
      <CircularProgress current={85} total={100} size={28} />
    </div>
  )
}

export const RatioMode: Story = {
  render: () => <CircularProgress current={7} total={10} size={20} showPercentage={false} />
}

export const WithTooltip: Story = {
  render: () => <CircularProgress current={80} total={100} size={20} tooltip="上下文使用 80%" />
}
