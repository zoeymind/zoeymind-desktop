import { Tooltip, TooltipTrigger } from "@zoeymind/ui"
import { useTranslation } from "@zoeymind/i18n"
import { EditorSidebarTooltipContent } from "../EditorSidebarTooltipContent"

interface TestCaseStatsProps {
  total: number
  p1: number
  p2: number
  p3: number
}

const SIZE = 16
const STROKE_WIDTH = 2.5
const RADIUS = (SIZE - STROKE_WIDTH) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export function TestCaseStats({ total, p1, p2, p3 }: TestCaseStatsProps) {
  const { t } = useTranslation()
  const priorities = [
    {
      label: "P1",
      count: p1,
      strokeClassName: "stroke-destructive",
      dotClassName: "bg-destructive",
    },
    { label: "P2", count: p2, strokeClassName: "stroke-yellow-500", dotClassName: "bg-yellow-500" },
    { label: "P3", count: p3, strokeClassName: "stroke-blue-500", dotClassName: "bg-blue-500" },
  ]
  let consumed = 0

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <div
            className="flex size-7 cursor-default items-center justify-center rounded-lg hover:bg-muted"
            aria-label={t("mindmap.canvasTool.testCaseStats", { count: total })}
          >
            <svg
              width={SIZE}
              height={SIZE}
              viewBox={`0 0 ${SIZE} ${SIZE}`}
              className="-rotate-90"
              aria-hidden="true"
            >
              <circle
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={RADIUS}
                fill="none"
                className="stroke-border"
                strokeWidth={STROKE_WIDTH}
              />
              {total > 0 &&
                priorities.map(priority => {
                  const length = (priority.count / total) * CIRCUMFERENCE
                  const offset = -consumed
                  consumed += length

                  return (
                    <circle
                      key={priority.label}
                      cx={SIZE / 2}
                      cy={SIZE / 2}
                      r={RADIUS}
                      fill="none"
                      className={priority.strokeClassName}
                      strokeWidth={STROKE_WIDTH}
                      strokeDasharray={`${length} ${CIRCUMFERENCE - length}`}
                      strokeDashoffset={offset}
                    />
                  )
                })}
            </svg>
          </div>
        }
      />
      <EditorSidebarTooltipContent className="flex w-40 flex-col items-stretch gap-2 py-2">
        <div className="flex items-center justify-between font-medium">
          <span>{t("mindmap.canvasTool.testCases")}</span>
          <span className="tabular-nums">{total}</span>
        </div>
        <div className="flex flex-col gap-1">
          {priorities.map(priority => (
            <div key={priority.label} className="flex items-center gap-2">
              <span className={`size-1.5 rounded-full ${priority.dotClassName}`} />
              <span>{priority.label}</span>
              <span className="ml-auto tabular-nums">
                {priority.count} · {total > 0 ? Math.round((priority.count / total) * 100) : 0}%
              </span>
            </div>
          ))}
        </div>
      </EditorSidebarTooltipContent>
    </Tooltip>
  )
}
