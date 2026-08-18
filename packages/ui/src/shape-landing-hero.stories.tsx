import type { Meta, StoryObj } from '@storybook/react'
import { HeroGeometric } from './shadcn-io/shape-landing-hero'

const meta: Meta<typeof HeroGeometric> = {
  title: 'Widgets/HeroGeometric',
  component: HeroGeometric,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' }
}

export default meta
type Story = StoryObj<typeof HeroGeometric>

export const Default: Story = {
  args: {
    badge: 'ZoeyMind',
    title1: '把思维',
    title2: '延伸到无限',
    description: '实时协作的思维导图，让团队像一个人一样思考。'
  }
}
