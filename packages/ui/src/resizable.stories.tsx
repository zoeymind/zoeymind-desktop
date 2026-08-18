import type { Meta, StoryObj } from '@storybook/react'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from './resizable'

const meta: Meta = {
  title: 'Layout/Resizable',
  tags: ['autodocs'],
  parameters: { layout: 'padded' }
}

export default meta
type Story = StoryObj

export const Horizontal: Story = {
  render: () => (
    <div className="h-64 w-[600px]">
      <ResizablePanelGroup orientation="horizontal">
        <ResizablePanel defaultSize={30}>
          <div className="grid h-full place-items-center p-4 text-sm">左侧</div>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={70}>
          <div className="grid h-full place-items-center p-4 text-sm">主内容区</div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}

export const Vertical: Story = {
  render: () => (
    <div className="h-96 w-[600px]">
      <ResizablePanelGroup orientation="vertical">
        <ResizablePanel defaultSize={40}>
          <div className="grid h-full place-items-center p-4 text-sm">上方</div>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={60}>
          <div className="grid h-full place-items-center p-4 text-sm">下方</div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}
