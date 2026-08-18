import type { Meta, StoryObj } from '@storybook/react'
import { InfoIcon } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip'
import { Button } from './button'

const meta: Meta<typeof Tooltip> = {
  title: 'Overlay/Tooltip',
  component: Tooltip,
  tags: ['autodocs']
}

export default meta
type Story = StoryObj<typeof Tooltip>

export const Default: Story = {
  render: () => (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button variant="outline" size="icon" aria-label="更多信息">
            <InfoIcon />
          </Button>
        }
      />
      <TooltipContent>只有创建者可以删除项目</TooltipContent>
    </Tooltip>
  )
}
