import type { Meta, StoryObj } from '@storybook/react'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue
} from './select'

const meta: Meta<typeof Select> = {
  title: 'Form/Select',
  component: Select,
  tags: ['autodocs']
}

export default meta
type Story = StoryObj<typeof Select>

export const Default: Story = {
  render: () => (
    <Select defaultValue="apple">
      <SelectTrigger className="w-48">
        <SelectValue>{value => (value ? String(value) : '选择水果')}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="apple">苹果</SelectItem>
        <SelectItem value="banana">香蕉</SelectItem>
        <SelectItem value="orange">橙子</SelectItem>
      </SelectContent>
    </Select>
  )
}

export const WithGroups: Story = {
  render: () => (
    <Select>
      <SelectTrigger className="w-56">
        <SelectValue>{value => (value ? String(value) : '选择时区')}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>亚洲</SelectLabel>
          <SelectItem value="cn">中国 (UTC+8)</SelectItem>
          <SelectItem value="jp">日本 (UTC+9)</SelectItem>
        </SelectGroup>
        <SelectSeparator />
        <SelectGroup>
          <SelectLabel>欧美</SelectLabel>
          <SelectItem value="us">美国 (UTC-5)</SelectItem>
          <SelectItem value="uk">英国 (UTC+0)</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

export const Disabled: Story = {
  render: () => (
    <Select disabled>
      <SelectTrigger className="w-48">
        <SelectValue>{value => (value ? String(value) : '只读')}</SelectValue>
      </SelectTrigger>
      <SelectContent />
    </Select>
  )
}
