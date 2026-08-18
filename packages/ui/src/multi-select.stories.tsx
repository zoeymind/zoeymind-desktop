import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { MultiSelect } from './multi-select'

const meta: Meta<typeof MultiSelect> = {
  title: 'Form/MultiSelect',
  component: MultiSelect,
  tags: ['autodocs']
}

export default meta
type Story = StoryObj<typeof MultiSelect>

const OPTIONS = [
  { label: 'React', value: 'react' },
  { label: 'Vue', value: 'vue' },
  { label: 'Svelte', value: 'svelte' },
  { label: 'Solid', value: 'solid' },
  { label: 'Angular', value: 'angular' }
]

function Demo() {
  const [selected, setSelected] = useState<string[]>(['react'])
  return (
    <div className="w-64">
      <MultiSelect options={OPTIONS} selected={selected} onChange={setSelected} />
    </div>
  )
}

export const Default: Story = { render: () => <Demo /> }
