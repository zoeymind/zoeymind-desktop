import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { TagsInput } from './tags-input'

const meta: Meta<typeof TagsInput> = {
  title: 'Form/TagsInput',
  component: TagsInput,
  tags: ['autodocs']
}

export default meta
type Story = StoryObj<typeof TagsInput>

function Demo(props: { placeholder?: string; disabled?: boolean }) {
  const [tags, setTags] = useState<string[]>(['前端', '设计系统'])
  return (
    <div className="w-80">
      <TagsInput value={tags} onChange={setTags} {...props} />
    </div>
  )
}

export const Default: Story = { render: () => <Demo placeholder="回车或逗号添加标签" /> }
export const Disabled: Story = { render: () => <Demo disabled /> }
