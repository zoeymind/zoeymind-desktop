import type { Meta, StoryObj } from '@storybook/react'
import { HomeIcon, StarIcon, InboxIcon } from 'lucide-react'
import { MotionTabs } from './motionTabs'
import { SortingTabs } from './sortingTabs'

const meta: Meta<typeof MotionTabs> = {
  title: 'Navigation/MotionTabs',
  component: MotionTabs,
  tags: ['autodocs']
}

export default meta
type Story = StoryObj<typeof MotionTabs>

export const Default: Story = {
  render: () => (
    <MotionTabs
      options={[
        { key: 'home', label: '首页', icon: <HomeIcon className="size-4" /> },
        { key: 'star', label: '收藏', icon: <StarIcon className="size-4" /> },
        { key: 'inbox', label: '收件', icon: <InboxIcon className="size-4" /> }
      ]}
      defaultTab="home"
    />
  )
}

export const AsSortingTabs: Story = {
  render: () => (
    <SortingTabs
      options={[
        { key: 'recent', label: '最近' },
        { key: 'popular', label: '热门' },
        { key: 'oldest', label: '最早' }
      ]}
      defaultSort="recent"
    />
  )
}
