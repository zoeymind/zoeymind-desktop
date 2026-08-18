import * as culori from 'culori'

/**
 * Convert any color value (hex, oklch, hsl, etc.) to HSL format string.
 * Used for setting CSS variable values on the root element.
 */
export function colorToHsl(value: string): string {
  const parsed = culori.parse(value)
  if (!parsed) return value

  const hsl = culori.converter('hsl')(parsed)
  if (!hsl) return value

  const h = hsl.h ?? 0
  const s = (hsl.s ?? 0) * 100
  const l = (hsl.l ?? 0) * 100
  const alpha = hsl.alpha

  const formatNumber = (num: number) => {
    return num % 1 === 0 ? num.toString() : num.toFixed(4)
  }
  const alphaSuffix = alpha === undefined || alpha >= 1 ? '' : ` / ${formatNumber(alpha)}`

  return `hsl(${formatNumber(h)} ${formatNumber(s)}% ${formatNumber(l)}%${alphaSuffix})`
}

/**
 * Convert color to HSL tuple format (h s% l%) for shadow color composition.
 * Used in getShadowMap when building shadow-color values.
 */
export function colorToHslTuple(value: string): string {
  const parsed = culori.parse(value)
  if (!parsed) return value

  const hsl = culori.converter('hsl')(parsed)
  if (!hsl) return value

  const h = hsl.h ?? 0
  const s = (hsl.s ?? 0) * 100
  const l = (hsl.l ?? 0) * 100

  const formatNumber = (num: number) => {
    return num % 1 === 0 ? num.toString() : num.toFixed(4)
  }

  return `${formatNumber(h)} ${formatNumber(s)}% ${formatNumber(l)}%`
}
