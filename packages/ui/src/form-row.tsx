import { cn } from '#lib/utils'

/**
 \* FormRowGroup + FormRow — 左右排布的表单行（label 左、控件右）。
 *
 * 左标签列宽度 = 所有行里最宽的标签，但封顶不超过 `maxLabel`（默认 200px）；
 * 用 CSS Subgrid 让每行共享同一套列，标签列自动对齐。行间可选虚线分隔。
 *
 * 用法：
 *   <FormRowGroup>
 *     <FormRow label="标题" hint="一句话描述" required><Input/></FormRow>
 *     <FormRow label="严重度"><Select/></FormRow>
 *   </FormRowGroup>
 */

function FormRowGroup({
  className,
  maxLabel = '200px',
  divided = true,
  style,
  ...props
}: React.ComponentProps<'div'> & {
  /** 标签列宽度上限；列宽在 max-content 与此值之间自适应。 */
  maxLabel?: string
  /** 行间虚线分隔，默认开。 */
  divided?: boolean
}) {
  return (
    <div
      data-slot="form-row-group"
      className={cn('group/form grid', className)}
      style={{ gridTemplateColumns: `fit-content(${maxLabel}) 1fr`, ...style }}
      {...props}
    />
  )
}

function FormRow({
  label,
  hint,
  required,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<'div'>, 'children'> & {
  label: React.ReactNode
  hint?: React.ReactNode
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div
      data-slot="form-row"
      className={cn(
        'col-span-full grid grid-cols-subgrid items-start gap-x-6 py-2',
        'group-data-[divided]/form:border-b group-data-[divided]/form:border-dashed group-data-[divided]/form:border-border group-data-[divided]/form:last:border-b-0',
        className
      )}
      {...props}
    >
      <div className="pt-2">
        <div className="flex items-center gap-0.5 text-sm font-medium leading-snug">
          {label}
          {required && <span className="text-destructive">*</span>}
        </div>
        {hint && (
          <p className="mt-0.5 text-xs leading-normal text-muted-foreground text-balance">{hint}</p>
        )}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

export { FormRowGroup, FormRow }
