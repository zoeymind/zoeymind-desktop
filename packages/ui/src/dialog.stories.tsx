import type { Meta, StoryObj } from '@storybook/react'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from './dialog'
import { Button } from './button'
import { Input } from './input'
import { Label } from './label'
import { Textarea } from './textarea'
import { FormRowGroup, FormRow } from './form-row'

const meta: Meta<typeof Dialog> = {
  title: 'Overlay/Dialog',
  component: Dialog,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Dialog 用于需要输入的编辑/创建。宽度用 `size` prop 分级（sm/md/lg/xl/2xl），不要手写 `sm:max-w-*` 覆盖。一句话确认用 ConfirmDialog / AlertDialog；侧栏详情用 Sheet；移动端用 Drawer。'
      }
    }
  }
}

export default meta
type Story = StoryObj<typeof Dialog>

/** 默认 size=sm：重命名 / 单字段小表单 */
export const 小表单_重命名: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger render={<Button variant="outline">重命名</Button>} />
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>重命名项目</DialogTitle>
          <DialogDescription>输入新的项目名称，其他成员会立即看到。</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">项目名</Label>
          <Input id="name" defaultValue="市场调研" />
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline">取消</Button>} />
          <Button>保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** size=lg：中等表单，几个字段 */
export const 中表单: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger render={<Button variant="outline">新建成员</Button>} />
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>邀请成员</DialogTitle>
          <DialogDescription>填写成员信息并分配角色。</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <Label>姓名</Label>
            <Input placeholder="张三" />
          </div>
          <div className="flex flex-col gap-2">
            <Label>邮箱</Label>
            <Input placeholder="zhangsan@example.com" />
          </div>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline">取消</Button>} />
          <Button>邀请</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** size=xl：复杂多字段表单（提 bug / 创建工单），左右排布 horizontal Field */
export const 复杂表单_面板级: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger render={<Button>提交缺陷</Button>} />
      <DialogContent size="xl" className="gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>提交缺陷</DialogTitle>
          <DialogDescription>记录一个测试发现的软件问题</DialogDescription>
        </DialogHeader>
        <div className="max-h-[65vh] overflow-y-auto px-6">
          <FormRowGroup>
            <FormRow label="标题" hint="一句话描述这个问题" required>
              <Input placeholder="如：登录页勾选记住我无效" />
            </FormRow>
            <FormRow label="描述" hint="问题现象的详细说明">
              <Textarea rows={3} placeholder="详细说明问题现象" />
            </FormRow>
            <FormRow label="复现步骤" hint="逐步操作 + 预期与实际结果">
              <Textarea rows={4} placeholder={'1. \n2. \n3. \n预期：\n实际：'} />
            </FormRow>
          </FormRowGroup>
        </div>
        <DialogFooter className="m-0 rounded-none border-t bg-muted/30 px-6 py-4">
          <DialogClose render={<Button variant="outline">取消</Button>} />
          <Button>提交</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** 所有 size 对比 */
export const 尺寸对比: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      {(['sm', 'md', 'lg', 'xl', '2xl'] as const).map(size => (
        <Dialog key={size}>
          <DialogTrigger render={<Button variant="outline">size={size}</Button>} />
          <DialogContent size={size}>
            <DialogHeader>
              <DialogTitle>size = {size}</DialogTitle>
              <DialogDescription>
                {size === 'sm' && '重命名 / 单字段小表单（默认）'}
                {size === 'md' && '略宽的小表单'}
                {size === 'lg' && '中等表单，几个字段'}
                {size === 'xl' && '复杂多字段表单（提 bug、创建工单）'}
                {size === '2xl' && '超大表单 / 双栏内容'}
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
              内容区
            </div>
            <DialogFooter>
              <DialogClose render={<Button variant="outline">关闭</Button>} />
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ))}
    </div>
  )
}
