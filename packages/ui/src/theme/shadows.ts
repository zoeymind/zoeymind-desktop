import { colorToHslTuple } from './color-converter'
import type { ThemeStyleProps } from './theme-presets'

/**
 * Default shadow primitives when a preset doesn't provide them.
 */
const DEFAULT_SHADOW_PRIMITIVES = {
  'shadow-color': 'hsl(0 0% 0%)',
  'shadow-opacity': '0.1',
  'shadow-blur': '3px',
  'shadow-spread': '0px',
  'shadow-offset-x': '0px',
  'shadow-offset-y': '1px'
}

/**
 * Compose shadow CSS variables from primitives.
 * Ported from tweakcn's getShadowMap logic.
 */
export function getShadowMap(styles: ThemeStyleProps): Record<string, string> {
  const shadowColor = styles['shadow-color'] ?? DEFAULT_SHADOW_PRIMITIVES['shadow-color']
  const shadowOpacity = parseFloat(
    styles['shadow-opacity'] ?? DEFAULT_SHADOW_PRIMITIVES['shadow-opacity']
  )
  const shadowBlur = styles['shadow-blur'] ?? DEFAULT_SHADOW_PRIMITIVES['shadow-blur']
  const shadowSpread = (
    styles['shadow-spread'] ?? DEFAULT_SHADOW_PRIMITIVES['shadow-spread']
  ).replace('px', '')
  const shadowOffsetX = styles['shadow-offset-x'] ?? DEFAULT_SHADOW_PRIMITIVES['shadow-offset-x']
  const shadowOffsetY = styles['shadow-offset-y'] ?? DEFAULT_SHADOW_PRIMITIVES['shadow-offset-y']

  const hslTuple = colorToHslTuple(shadowColor)

  // Compose colors with different opacity multipliers
  const color = (multiplier: number) => {
    const opacity = (shadowOpacity * multiplier).toFixed(2)
    return `hsl(${hslTuple} / ${opacity})`
  }

  // Secondary shadow (used in multi-layer shadows)
  const second = (fy: string, fb: string) => {
    const spreadPx = Math.max(0, parseFloat(shadowSpread) - 1)
    return `${shadowOffsetX} ${fy} ${fb} ${spreadPx}px ${color(1.0)}`
  }

  return {
    'shadow-2xs': `${shadowOffsetX} ${shadowOffsetY} ${shadowBlur} ${shadowSpread}px ${color(0.5)}`,
    'shadow-xs': `${shadowOffsetX} ${shadowOffsetY} ${shadowBlur} ${shadowSpread}px ${color(0.5)}`,
    'shadow-sm': `${shadowOffsetX} ${shadowOffsetY} ${shadowBlur} ${shadowSpread}px ${color(1.0)}, ${second('1px', '2px')}`,
    shadow: `${shadowOffsetX} ${shadowOffsetY} ${shadowBlur} ${shadowSpread}px ${color(1.0)}, ${second('1px', '2px')}`,
    'shadow-md': second('2px', '4px'),
    'shadow-lg': second('4px', '6px'),
    'shadow-xl': second('8px', '10px'),
    'shadow-2xl': `${shadowOffsetX} ${shadowOffsetY} ${shadowBlur} ${shadowSpread}px ${color(2.5)}`
  }
}
