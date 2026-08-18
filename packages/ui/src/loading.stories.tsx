import type { Meta, StoryObj } from '@storybook/react'
import { Loading } from './Loading'

const meta: Meta<typeof Loading> = {
  title: 'Widgets/Loading',
  component: Loading,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  argTypes: {
    progress: { control: { type: 'range', min: 0, max: 100, step: 5 } }
  }
}

export default meta
type Story = StoryObj<typeof Loading>

export const Simple: Story = {
  args: { show: true, tip: '加载中...' },
  render: args => (
    <div className="relative h-96 bg-background">
      <Loading {...args} />
    </div>
  )
}

export const WithProgress: Story = {
  args: { show: true, tip: '正在准备...', progress: 42 },
  render: args => (
    <div className="relative h-96 bg-background">
      <Loading {...args} />
    </div>
  )
}
