import type { Meta, StoryObj } from '@storybook/react'
import { CheckIcon } from 'lucide-react'
import { Badge } from './badge'

const meta: Meta<typeof Badge> = {
  title: 'Primitives/Badge',
  component: Badge,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: [
        'default',
        'secondary',
        'destructive',
        'success',
        'warning',
        'outline',
        'ghost',
        'link'
      ]
    }
  },
  args: { children: 'Badge' }
}

export default meta
type Story = StoryObj<typeof Badge>

export const Default: Story = {}

export const Variants: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <Badge>Default</Badge>
      <Badge variant="secondary">Secondary</Badge>
      <Badge variant="destructive">Destructive</Badge>
      <Badge variant="success">Success</Badge>
      <Badge variant="warning">Warning</Badge>
      <Badge variant="outline">Outline</Badge>
      <Badge variant="ghost">Ghost</Badge>
    </div>
  )
}

export const WithIcon: Story = {
  render: () => (
    <Badge variant="success">
      <CheckIcon data-icon="inline-start" />
      Verified
    </Badge>
  )
}
