import type { Meta, StoryObj } from '@storybook/react'
import { SearchIcon, XIcon } from 'lucide-react'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText
} from './input-group'

const meta: Meta<typeof InputGroup> = {
  title: 'Layout/InputGroup',
  component: InputGroup,
  tags: ['autodocs']
}

export default meta
type Story = StoryObj<typeof InputGroup>

export const WithSearchIcon: Story = {
  render: () => (
    <InputGroup className="w-80">
      <InputGroupAddon>
        <SearchIcon />
      </InputGroupAddon>
      <InputGroupInput placeholder="搜索导图..." />
    </InputGroup>
  )
}

export const WithClearButton: Story = {
  render: () => (
    <InputGroup className="w-80">
      <InputGroupInput defaultValue="草稿" />
      <InputGroupAddon align="inline-end">
        <InputGroupButton size="icon-xs" aria-label="清空">
          <XIcon />
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  )
}

export const WithPrefixText: Story = {
  render: () => (
    <InputGroup className="w-80">
      <InputGroupAddon>
        <InputGroupText>https://</InputGroupText>
      </InputGroupAddon>
      <InputGroupInput placeholder="zoey.dev" />
    </InputGroup>
  )
}
