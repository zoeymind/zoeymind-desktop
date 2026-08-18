import type { Meta, StoryObj } from '@storybook/react'
import { Button } from './button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from './card'

const meta: Meta<typeof Card> = {
  title: 'Primitives/Card',
  component: Card,
  tags: ['autodocs'],
  parameters: { layout: 'padded' }
}

export default meta
type Story = StoryObj<typeof Card>

export const Basic: Story = {
  render: () => (
    <Card className="w-96">
      <CardHeader>
        <CardTitle>创建新项目</CardTitle>
        <CardDescription>为你的团队开始一个思维导图工作空间。</CardDescription>
        <CardAction>
          <Button variant="ghost" size="sm">
            取消
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">项目会同步给成员，支持实时协作、评论、快照回滚。</p>
      </CardContent>
      <CardFooter>
        <Button size="sm">创建</Button>
      </CardFooter>
    </Card>
  )
}
