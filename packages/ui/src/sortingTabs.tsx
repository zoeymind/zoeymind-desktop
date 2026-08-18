import { MotionTabs, type TabOption } from './motionTabs'

export type SortOption = TabOption

interface SortingTabsProps {
  options: SortOption[]
  defaultSort?: string
  onChange?: (sortKey: string) => void
  className?: string
}

export function SortingTabs({ options, defaultSort, onChange, className }: SortingTabsProps) {
  return (
    <MotionTabs
      options={options}
      defaultTab={defaultSort}
      onChange={onChange}
      className={className}
      showContent={false}
    />
  )
}
