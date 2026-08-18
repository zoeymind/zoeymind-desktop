import { useMemo } from 'react'
import { CalendarDays, Clock, Star, ArrowUpDown } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@zoeymind/ui'
import { useTranslation } from '@zoeymind/i18n'

interface ProjectSortProps {
  onSortChange?: (sortKey: string) => void
  defaultSort?: string
  className?: string
  sortType: string
}

export function ProjectSort({
  onSortChange,
  defaultSort = 'recent',
  className,
  sortType
}: ProjectSortProps) {
  const { t } = useTranslation()

  const sortOptions = useMemo(
    () =>
      [
        { key: 'recent', label: t('projects.tabs.sortRecent'), icon: Clock },
        { key: 'created', label: t('projects.tabs.sortCreated'), icon: CalendarDays },
        { key: 'name', label: t('projects.tabs.sortName'), icon: ArrowUpDown },
        { key: 'starred', label: t('projects.tabs.sortStarred'), icon: Star }
      ] as const,
    [t]
  )

  const currentSort = sortType || defaultSort
  const selectedOption = sortOptions.find(opt => opt.key === currentSort) || sortOptions[0]
  const Icon = selectedOption.icon

  return (
    <div className={className}>
      <Select value={currentSort} onValueChange={v => v != null && onSortChange?.(v as string)}>
        <SelectTrigger className="w-[140px] border-none bg-transparent shadow-none hover:bg-accent focus:ring-1 data-[state=open]:bg-accent">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Icon className="size-4 shrink-0" />
            <span className="truncate text-sm">{selectedOption.label}</span>
          </div>
        </SelectTrigger>
        <SelectContent align="end" sideOffset={4}>
          {sortOptions.map(option => {
            const OptionIcon = option.icon
            return (
              <SelectItem key={option.key} value={option.key}>
                <div className="flex items-center gap-2">
                  <OptionIcon className="size-4 shrink-0" />
                  <span>{option.label}</span>
                </div>
              </SelectItem>
            )
          })}
        </SelectContent>
      </Select>
    </div>
  )
}
