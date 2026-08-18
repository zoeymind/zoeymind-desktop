import type { Meta, StoryObj } from '@storybook/react'
import { Slider } from './slider'

const meta: Meta<typeof Slider> = {
  title: 'Form/Slider',
  component: Slider,
  tags: ['autodocs']
}

export default meta
type Story = StoryObj<typeof Slider>

export const Default: Story = {
  render: () => <Slider defaultValue={[40]} className="w-64" />
}

export const Range: Story = {
  render: () => <Slider defaultValue={[20, 80]} className="w-64" />
}

export const Steps: Story = {
  render: () => <Slider defaultValue={[50]} step={10} className="w-64" />
}

export const Disabled: Story = {
  render: () => <Slider defaultValue={[30]} disabled className="w-64" />
}
