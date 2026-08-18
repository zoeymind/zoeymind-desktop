import type { Meta, StoryObj } from '@storybook/react'
import { Toaster, toast } from './toaster'
import { Button } from './button'

const meta: Meta = {
  title: 'Display/Toaster',
  parameters: { layout: 'centered' },
  tags: ['autodocs']
}

export default meta

export const Playground: StoryObj = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" onClick={() => toast('已保存')}>
        默认
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => toast({ description: '操作成功', variant: 'success' })}
      >
        成功
      </Button>
      <Button
        size="sm"
        variant="destructive"
        onClick={() => toast({ description: '操作失败', variant: 'destructive' })}
      >
        错误
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => toast({ description: '注意', variant: 'warning' })}
      >
        警告
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => toast({ description: '提示信息', variant: 'info' })}
      >
        信息
      </Button>
      <Toaster />
    </div>
  )
}
