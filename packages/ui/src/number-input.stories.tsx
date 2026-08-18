import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { NumberInput } from './number-input'

const meta: Meta<typeof NumberInput> = {
  title: 'Form/NumberInput',
  component: NumberInput,
  tags: ['autodocs']
}

export default meta
type Story = StoryObj<typeof NumberInput>

function Demo(props: {
  min?: number
  max?: number
  step?: number
  showControls?: boolean
  disabled?: boolean
}) {
  const [value, setValue] = useState<number | undefined>(10)
  return (
    <div className="w-40">
      <NumberInput value={value} onChange={setValue} {...props} />
    </div>
  )
}

export const Default: Story = { render: () => <Demo /> }
export const WithRange: Story = {
  render: () => <Demo min={0} max={100} step={5} />
}
export const NoControls: Story = {
  render: () => <Demo showControls={false} />
}
export const Disabled: Story = {
  render: () => <Demo disabled />
}
