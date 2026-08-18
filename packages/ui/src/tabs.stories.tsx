import type { Meta, StoryObj } from '@storybook/react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs'

const meta: Meta<typeof Tabs> = {
  title: 'Navigation/Tabs',
  component: Tabs,
  tags: ['autodocs']
}

export default meta
type Story = StoryObj<typeof Tabs>

export const Default: Story = {
  render: () => (
    <Tabs defaultValue="overview" className="w-96">
      <TabsList>
        <TabsTrigger value="overview">概览</TabsTrigger>
        <TabsTrigger value="members">成员</TabsTrigger>
        <TabsTrigger value="settings">设置</TabsTrigger>
      </TabsList>
      <TabsContent value="overview">概览内容</TabsContent>
      <TabsContent value="members">成员列表</TabsContent>
      <TabsContent value="settings">设置面板</TabsContent>
    </Tabs>
  )
}

export const LineVariant: Story = {
  render: () => (
    <Tabs defaultValue="a" className="w-96">
      <TabsList variant="line">
        <TabsTrigger value="a">导图</TabsTrigger>
        <TabsTrigger value="b">画布</TabsTrigger>
        <TabsTrigger value="c">评论</TabsTrigger>
      </TabsList>
      <TabsContent value="a">导图内容</TabsContent>
      <TabsContent value="b">画布内容</TabsContent>
      <TabsContent value="c">评论内容</TabsContent>
    </Tabs>
  )
}
