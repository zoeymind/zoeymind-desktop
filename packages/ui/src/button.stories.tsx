import type { Meta, StoryObj } from '@storybook/react'
import { CheckIcon, Loader2Icon, TrashIcon } from 'lucide-react'
import { Button } from './button'

const meta: Meta<typeof Button> = {
  title: 'Primitives/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'outline', 'secondary', 'ghost', 'destructive', 'link']
    },
    size: {
      control: 'select',
      options: ['default', 'xs', 'sm', 'lg', 'icon', 'icon-xs', 'icon-sm', 'icon-lg']
    },
    disabled: { control: 'boolean' }
  },
  args: {
    children: 'Button',
    variant: 'default',
    size: 'default'
  }
}

export default meta
type Story = StoryObj<typeof Button>

export const Default: Story = {}

export const Variants: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button>Default</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="destructive">Destructive</Button>
      <Button variant="link">Link</Button>
    </div>
  )
}

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button size="xs">xs</Button>
      <Button size="sm">sm</Button>
      <Button size="default">default</Button>
      <Button size="lg">lg</Button>
    </div>
  )
}

export const WithIcon: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button>
        <CheckIcon data-icon="inline-start" />
        Confirm
      </Button>
      <Button variant="destructive">
        <TrashIcon data-icon="inline-start" />
        Delete
      </Button>
      <Button size="icon" variant="outline" aria-label="check">
        <CheckIcon />
      </Button>
    </div>
  )
}

export const Loading: Story = {
  render: () => (
    <Button disabled>
      <Loader2Icon data-icon="inline-start" className="animate-spin" />
      Saving
    </Button>
  )
}

export const Disabled: Story = {
  args: { disabled: true, children: 'Disabled' }
}
