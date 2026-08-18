import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import type { DateRange } from 'react-day-picker'
import { Calendar } from './calendar'

const meta: Meta<typeof Calendar> = {
  title: 'Data/Calendar',
  component: Calendar,
  tags: ['autodocs']
}

export default meta
type Story = StoryObj<typeof Calendar>

function SingleDemo() {
  const [date, setDate] = useState<Date | undefined>(new Date())
  return <Calendar mode="single" selected={date} onSelect={setDate} />
}

function RangeDemo() {
  const [range, setRange] = useState<DateRange | undefined>()
  return <Calendar mode="range" selected={range} onSelect={setRange} numberOfMonths={2} />
}

export const SingleDay: Story = { render: () => <SingleDemo /> }
export const RangeSelect: Story = { render: () => <RangeDemo /> }
