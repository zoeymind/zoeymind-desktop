import type { Meta, StoryObj } from '@storybook/react'
import { ChevronDownIcon } from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './collapsible'
import { Button } from './button'

const meta: Meta<typeof Collapsible> = {
  title: 'Layout/Collapsible',
  component: Collapsible,
  tags: ['autodocs']
}

export default meta
type Story = StoryObj<typeof Collapsible>

export const Default: Story = {
  render: () => (
    <Collapsible className="w-72">
      <CollapsibleTrigger
        render={
          <Button variant="outline" className="w-full justify-between">
            展开详情
            <ChevronDownIcon />
          </Button>
        }
      />
      <CollapsibleContent className="mt-2 px-3 py-2 text-sm text-muted-foreground">
        这里是折叠展开的内容，可以放任意组件。
      </CollapsibleContent>
    </Collapsible>
  )
}
