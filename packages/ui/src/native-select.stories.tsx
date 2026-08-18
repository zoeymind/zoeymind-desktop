import type { Meta, StoryObj } from '@storybook/react'
import { NativeSelect } from './native-select'

const meta: Meta<typeof NativeSelect> = {
  title: 'Form/NativeSelect',
  component: NativeSelect,
  tags: ['autodocs'],
  argTypes: {
    size: { control: 'select', options: ['default', 'sm'] }
  }
}

export default meta
type Story = StoryObj<typeof NativeSelect>

export const Default: Story = {
  render: args => (
    <NativeSelect {...args} defaultValue="apple">
      <option value="apple">苹果</option>
      <option value="banana">香蕉</option>
      <option value="orange">橙子</option>
    </NativeSelect>
  )
}

export const Small: Story = {
  args: { size: 'sm' },
  render: args => (
    <NativeSelect {...args} defaultValue="cn">
      <option value="cn">中文</option>
      <option value="en">English</option>
    </NativeSelect>
  )
}
