import type { Meta, StoryObj } from '@storybook/react'
import { ButtonGroup, ButtonGroupSeparator, ButtonGroupText } from './button-group'
import { Button } from './button'

const meta: Meta<typeof ButtonGroup> = {
  title: 'Layout/ButtonGroup',
  component: ButtonGroup,
  tags: ['autodocs'],
  argTypes: {
    orientation: { control: 'select', options: ['horizontal', 'vertical'] }
  }
}

export default meta
type Story = StoryObj<typeof ButtonGroup>

export const Default: Story = {
  render: () => (
    <ButtonGroup>
      <Button variant="outline">左</Button>
      <Button variant="outline">中</Button>
      <Button variant="outline">右</Button>
    </ButtonGroup>
  )
}

export const WithText: Story = {
  render: () => (
    <ButtonGroup>
      <ButtonGroupText>合作</ButtonGroupText>
      <ButtonGroupSeparator />
      <Button variant="outline">邀请</Button>
      <Button variant="outline">复制链接</Button>
    </ButtonGroup>
  )
}

export const Vertical: Story = {
  render: () => (
    <ButtonGroup orientation="vertical">
      <Button variant="outline">上</Button>
      <Button variant="outline">中</Button>
      <Button variant="outline">下</Button>
    </ButtonGroup>
  )
}
