'use client'

import * as React from 'react'
import { Minus, Plus } from 'lucide-react'
import { Button } from './button'
import { Input } from './input'
import { cn } from './cn'

export interface NumberInputProps {
  value: number | undefined | ''
  onChange: (value: number | undefined) => void
  min?: number
  max?: number
  step?: number
  placeholder?: string
  disabled?: boolean
  className?: string
  /** 输入框的高度类名，默认 h-9 */
  inputClassName?: string
  /** 是否显示增减按钮，默认 true */
  showControls?: boolean
}

const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  (
    {
      value,
      onChange,
      min,
      max,
      step = 1,
      placeholder = '0',
      disabled = false,
      className,
      inputClassName,
      showControls = true
    },
    ref
  ) => {
    const handleIncrement = () => {
      const currentValue = typeof value === 'number' ? value : 0
      const newValue = currentValue + step
      if (max !== undefined && newValue > max) return
      onChange(newValue)
    }

    const handleDecrement = () => {
      const currentValue = typeof value === 'number' ? value : 0
      const newValue = currentValue - step
      if (min !== undefined && newValue < min) return
      onChange(newValue)
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value
      if (inputValue === '') {
        onChange(undefined)
        return
      }
      const numValue = Number(inputValue)
      if (isNaN(numValue)) return
      // 不在输入时限制范围，让用户可以自由输入
      onChange(numValue)
    }

    const handleBlur = () => {
      // 在失焦时限制范围
      if (typeof value !== 'number') return
      let clampedValue = value
      if (min !== undefined && value < min) clampedValue = min
      if (max !== undefined && value > max) clampedValue = max
      if (clampedValue !== value) {
        onChange(clampedValue)
      }
    }

    if (!showControls) {
      return (
        <Input
          ref={ref}
          type="number"
          value={value ?? ''}
          onChange={handleInputChange}
          onBlur={handleBlur}
          min={min}
          max={max}
          step={step}
          placeholder={placeholder}
          disabled={disabled}
          className={cn('text-center', inputClassName, className)}
        />
      )
    }

    return (
      <div className={cn('flex items-center gap-1', className)}>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={handleDecrement}
          disabled={
            disabled || (min !== undefined && (typeof value === 'number' ? value : 0) <= min)
          }
          className="size-7 flex-shrink-0"
        >
          <Minus className="size-3" />
        </Button>
        <Input
          ref={ref}
          type="number"
          value={value ?? ''}
          onChange={handleInputChange}
          onBlur={handleBlur}
          min={min}
          max={max}
          step={step}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            'text-center h-7 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none',
            inputClassName
          )}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={handleIncrement}
          disabled={
            disabled || (max !== undefined && (typeof value === 'number' ? value : 0) >= max)
          }
          className="size-7 flex-shrink-0"
        >
          <Plus className="size-3" />
        </Button>
      </div>
    )
  }
)

NumberInput.displayName = 'NumberInput'

export { NumberInput }
