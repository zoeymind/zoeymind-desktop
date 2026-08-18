import { useState, useEffect, useRef } from 'react'
import { motion } from 'motion/react'
import { cn } from './cn'

export type TabOption = {
  key: string
  label: string
  icon?: React.ReactNode
  content?: React.ReactNode
}

interface MotionTabsProps {
  options: TabOption[]
  defaultTab?: string
  onChange?: (tabKey: string) => void
  className?: string
  containerClassName?: string
  tabClassName?: string
  activeTabClassName?: string
  inactiveTabClassName?: string
  indicatorClassName?: string
  hoverIndicatorClassName?: string
  showContent?: boolean
}

export function MotionTabs({
  options,
  defaultTab,
  onChange,
  className,
  containerClassName,
  tabClassName,
  activeTabClassName,
  inactiveTabClassName,
  indicatorClassName,
  hoverIndicatorClassName,
  showContent = true
}: MotionTabsProps) {
  const [activeTab, setActiveTab] = useState<string>(defaultTab || options[0]?.key || '')
  const [hoveredTab, setHoveredTab] = useState<string | null>(null)
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map())

  useEffect(() => {
    if (defaultTab && defaultTab !== activeTab) {
      setActiveTab(defaultTab)
    }
  }, [defaultTab, activeTab])

  const handleTabChange = (tabKey: string) => {
    setActiveTab(tabKey)
    onChange?.(tabKey)
  }

  // 获取特定标签的尺寸和位置
  const getTabDimensions = (key: string) => {
    const el = tabRefs.current.get(key)
    if (!el) return { width: 0, x: 0 }

    return {
      width: el.offsetWidth,
      x: el.offsetLeft
    }
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div
        className={cn('flex items-center rounded-lg bg-black/5 p-4 relative', containerClassName)}
      >
        {options.map(option => {
          const isActive = activeTab === option.key

          return (
            <button
              type="button"
              key={option.key}
              ref={el => {
                if (el) tabRefs.current.set(option.key, el)
              }}
              className={cn(
                'relative z-10 flex items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-all',
                'hover:text-foreground focus-visible:outline-none',
                isActive
                  ? cn('text-foreground font-semibold', activeTabClassName)
                  : cn('text-muted-foreground', inactiveTabClassName),
                tabClassName
              )}
              onClick={() => handleTabChange(option.key)}
              onMouseEnter={() => setHoveredTab(option.key)}
              onMouseLeave={() => setHoveredTab(null)}
            >
              {option.icon}
              {option.label}
            </button>
          )
        })}

        {/* 活动指示器 */}
        {activeTab && (
          <motion.div
            className={cn(
              'absolute inset-0 z-4 rounded-md bg-white shadow-[0_2px_8px_hsla(var(--foreground)_/_0.06)] my-2',
              indicatorClassName
            )}
            initial={false}
            animate={{
              ...getTabDimensions(activeTab),
              width: getTabDimensions(activeTab).width || 0
            }}
            transition={{
              type: 'spring',
              stiffness: 500,
              damping: 30
            }}
          />
        )}

        {/* 悬停指示器 */}
        {hoveredTab && hoveredTab !== activeTab && (
          <motion.div
            className={cn(
              'absolute inset-0 z-0 rounded-md bg-white/60 my-2',
              hoverIndicatorClassName
            )}
            initial={{ opacity: 0 }}
            animate={{
              opacity: 1,
              ...getTabDimensions(hoveredTab),
              width: getTabDimensions(hoveredTab).width || 0,
              x: getTabDimensions(hoveredTab).x || 0
            }}
            transition={{
              type: 'spring',
              stiffness: 500,
              damping: 30
            }}
          />
        )}
      </div>

      {/* 内容区域 */}
      {showContent && (
        <div className="mt-4">{options.find(option => option.key === activeTab)?.content}</div>
      )}
    </div>
  )
}
