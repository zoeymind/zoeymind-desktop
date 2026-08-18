import type { Meta, StoryObj } from '@storybook/react'
import { FileTextIcon, HomeIcon, InboxIcon, SettingsIcon } from 'lucide-react'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut
} from './command'

const meta: Meta<typeof Command> = {
  title: 'Data/Command',
  component: Command,
  tags: ['autodocs']
}

export default meta
type Story = StoryObj<typeof Command>

export const Default: Story = {
  render: () => (
    <Command className="w-80">
      <CommandInput placeholder="搜索..." />
      <CommandList>
        <CommandEmpty>没有匹配结果。</CommandEmpty>
        <CommandGroup heading="导航">
          <CommandItem value="home">
            <HomeIcon />
            首页
            <CommandShortcut>⌘H</CommandShortcut>
          </CommandItem>
          <CommandItem value="inbox">
            <InboxIcon />
            收件
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="其他">
          <CommandItem value="docs">
            <FileTextIcon />
            文档
          </CommandItem>
          <CommandItem value="settings">
            <SettingsIcon />
            设置
            <CommandShortcut>⌘,</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  )
}
