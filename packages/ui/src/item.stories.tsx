import type { Meta, StoryObj } from '@storybook/react'
import { FolderIcon, ChevronRightIcon } from 'lucide-react'
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from './item'
import { Button } from './button'

const meta: Meta<typeof Item> = {
  title: 'Display/Item',
  component: Item,
  tags: ['autodocs']
}

export default meta
type Story = StoryObj<typeof Item>

export const Default: Story = {
  render: () => (
    <Item className="w-96 gap-3 p-3">
      <ItemMedia>
        <div className="grid size-8 place-items-center rounded-lg bg-muted">
          <FolderIcon className="size-4" />
        </div>
      </ItemMedia>
      <ItemContent>
        <ItemTitle>市场调研</ItemTitle>
        <ItemDescription>12 个成员 · 更新于 2 小时前</ItemDescription>
      </ItemContent>
      <ItemActions>
        <Button variant="ghost" size="icon-sm">
          <ChevronRightIcon />
        </Button>
      </ItemActions>
    </Item>
  )
}
