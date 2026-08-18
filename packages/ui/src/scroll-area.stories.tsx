import type { Meta, StoryObj } from '@storybook/react'
import { ScrollArea } from './scroll-area'

const meta: Meta<typeof ScrollArea> = {
  title: 'Layout/ScrollArea',
  component: ScrollArea,
  tags: ['autodocs']
}

export default meta
type Story = StoryObj<typeof ScrollArea>

export const Vertical: Story = {
  render: () => (
    <ScrollArea className="h-56 w-64 p-3">
      <div className="flex flex-col gap-2 text-sm">
        {Array.from({ length: 30 }, (_, i) => (
          <div key={i}>行 {i + 1}</div>
        ))}
      </div>
    </ScrollArea>
  )
}
