import type { Meta, StoryObj } from '@storybook/react'
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger
} from './popover'
import { Button } from './button'
import { Input } from './input'
import { Label } from './label'

const meta: Meta<typeof Popover> = {
  title: 'Overlay/Popover',
  component: Popover,
  tags: ['autodocs']
}

export default meta
type Story = StoryObj<typeof Popover>

export const Default: Story = {
  render: () => (
    <Popover>
      <PopoverTrigger nativeButton render={<Button variant="outline">修改用户名</Button>} />
      <PopoverContent>
        <PopoverHeader>
          <PopoverTitle>用户名</PopoverTitle>
          <PopoverDescription>公开可见，不区分大小写。</PopoverDescription>
        </PopoverHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="username">用户名</Label>
          <Input id="username" defaultValue="zoeymind" />
        </div>
        <Button size="sm">保存</Button>
      </PopoverContent>
    </Popover>
  )
}
