import type { Meta, StoryObj } from '@storybook/react'
import { FileTextIcon, HomeIcon, InboxIcon, SettingsIcon } from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger
} from './sidebar'

const meta: Meta<typeof Sidebar> = {
  title: 'Layout/Sidebar',
  component: Sidebar,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' }
}

export default meta
type Story = StoryObj<typeof Sidebar>

const NAV = [
  { icon: HomeIcon, label: '首页' },
  { icon: InboxIcon, label: '收件' },
  { icon: FileTextIcon, label: '文档' },
  { icon: SettingsIcon, label: '设置' }
]

export const Default: Story = {
  render: () => (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader className="px-4 py-3 text-sm font-medium">ZoeyMind</SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>工作台</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {NAV.map(item => (
                  <SidebarMenuItem key={item.label}>
                    <SidebarMenuButton>
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-12 items-center gap-2 border-b px-3">
          <SidebarTrigger />
          <span className="text-sm text-muted-foreground">主内容区</span>
        </header>
        <div className="p-6 text-sm text-muted-foreground">你的内容会渲染在这里。</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
