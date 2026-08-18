import { type FC } from 'react'

interface TestCaseStatsProps {
  total: number
  p1: number
  p2: number
  p3: number
}

export const TestCaseStats: FC<TestCaseStatsProps> = ({ total, p1, p2, p3 }) => {
  if (total === 0) {
    return null
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1">
        <span className="inline-block size-1.5 rounded-full bg-foreground"></span>
        <span>{total}</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="inline-block size-1.5 rounded-full bg-destructive"></span>
        <span>{p1}</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="inline-block size-1.5 rounded-full bg-warning"></span>
        <span>{p2}</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="inline-block size-1.5 rounded-full bg-success"></span>
        <span>{p3}</span>
      </div>
    </div>
  )
}
