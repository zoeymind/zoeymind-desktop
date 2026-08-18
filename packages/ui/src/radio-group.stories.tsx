import type { Meta, StoryObj } from '@storybook/react'
import { RadioGroup, RadioGroupItem } from './radio-group'
import { Label } from './label'

const meta: Meta<typeof RadioGroup> = {
  title: 'Form/RadioGroup',
  component: RadioGroup,
  tags: ['autodocs']
}

export default meta
type Story = StoryObj<typeof RadioGroup>

export const Default: Story = {
  render: () => (
    <RadioGroup defaultValue="daily" className="w-64">
      <Label className="gap-2">
        <RadioGroupItem value="daily" />
        每日
      </Label>
      <Label className="gap-2">
        <RadioGroupItem value="weekly" />
        每周
      </Label>
      <Label className="gap-2">
        <RadioGroupItem value="monthly" />
        每月
      </Label>
    </RadioGroup>
  )
}

export const Disabled: Story = {
  render: () => (
    <RadioGroup defaultValue="a" disabled className="w-64">
      <Label className="gap-2">
        <RadioGroupItem value="a" />
        选项 A
      </Label>
      <Label className="gap-2">
        <RadioGroupItem value="b" />
        选项 B
      </Label>
    </RadioGroup>
  )
}
