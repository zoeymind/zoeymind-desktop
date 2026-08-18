import type { Meta, StoryObj } from '@storybook/react'
import { Checkbox } from './checkbox'
import { Label } from './label'

const meta: Meta<typeof Checkbox> = {
  title: 'Form/Checkbox',
  component: Checkbox,
  tags: ['autodocs']
}

export default meta
type Story = StoryObj<typeof Checkbox>

export const Default: Story = {}

export const WithLabel: Story = {
  render: () => (
    <Label className="gap-2">
      <Checkbox defaultChecked />
      同意用户协议
    </Label>
  )
}

export const States: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <Label className="gap-2">
        <Checkbox />
        未选中
      </Label>
      <Label className="gap-2">
        <Checkbox defaultChecked />
        已选中
      </Label>
      <Label className="gap-2">
        <Checkbox disabled />
        禁用
      </Label>
      <Label className="gap-2">
        <Checkbox disabled defaultChecked />
        禁用 + 已选
      </Label>
      <Label className="gap-2">
        <Checkbox aria-invalid />
        错误态
      </Label>
    </div>
  )
}
