import type { Meta, StoryObj } from '@storybook/react'
import { Progress } from './progress'

const meta: Meta<typeof Progress> = {
  title: 'Display/Progress',
  component: Progress,
  tags: ['autodocs'],
  argTypes: {
    value: { control: { type: 'range', min: 0, max: 100, step: 5 } }
  },
  args: { value: 60 }
}

export default meta
type Story = StoryObj<typeof Progress>

export const Default: Story = {
  render: args => (
    <div className="w-72">
      <Progress {...args} />
    </div>
  )
}

export const Stages: Story = {
  render: () => (
    <div className="flex w-72 flex-col gap-4">
      <Progress value={20} />
      <Progress value={50} />
      <Progress value={80} />
      <Progress value={100} />
    </div>
  )
}
