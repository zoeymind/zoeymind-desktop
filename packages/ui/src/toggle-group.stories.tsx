import type { Meta, StoryObj } from '@storybook/react'
import {
  AlignCenterIcon,
  AlignLeftIcon,
  AlignRightIcon,
  BoldIcon,
  ItalicIcon,
  UnderlineIcon
} from 'lucide-react'
import { ToggleGroup, ToggleGroupItem } from './toggle-group'

const meta: Meta<typeof ToggleGroup> = {
  title: 'Form/ToggleGroup',
  component: ToggleGroup,
  tags: ['autodocs']
}

export default meta
type Story = StoryObj<typeof ToggleGroup>

export const Single: Story = {
  render: () => (
    <ToggleGroup type="single" defaultValue="left">
      <ToggleGroupItem value="left" aria-label="左对齐">
        <AlignLeftIcon />
      </ToggleGroupItem>
      <ToggleGroupItem value="center" aria-label="居中">
        <AlignCenterIcon />
      </ToggleGroupItem>
      <ToggleGroupItem value="right" aria-label="右对齐">
        <AlignRightIcon />
      </ToggleGroupItem>
    </ToggleGroup>
  )
}

export const Multiple: Story = {
  render: () => (
    <ToggleGroup type="multiple" defaultValue={['bold']}>
      <ToggleGroupItem value="bold" aria-label="加粗">
        <BoldIcon />
      </ToggleGroupItem>
      <ToggleGroupItem value="italic" aria-label="斜体">
        <ItalicIcon />
      </ToggleGroupItem>
      <ToggleGroupItem value="underline" aria-label="下划线">
        <UnderlineIcon />
      </ToggleGroupItem>
    </ToggleGroup>
  )
}

export const Attached: Story = {
  render: () => (
    <ToggleGroup type="single" defaultValue="left" spacing={0} variant="outline">
      <ToggleGroupItem value="left" aria-label="左对齐">
        <AlignLeftIcon />
      </ToggleGroupItem>
      <ToggleGroupItem value="center" aria-label="居中">
        <AlignCenterIcon />
      </ToggleGroupItem>
      <ToggleGroupItem value="right" aria-label="右对齐">
        <AlignRightIcon />
      </ToggleGroupItem>
    </ToggleGroup>
  )
}
