import { colorToHsl } from './color-converter'
import { getShadowMap } from './shadows'
import type { ThemePreset, ThemeStyleProps } from './theme-presets'

/**
 * All CSS variable keys that the theme system manages.
 * When clearing or applying a preset, we touch exactly these keys.
 */
export const MANAGED_KEYS = [
  // Color tokens
  'background',
  'foreground',
  'card',
  'card-foreground',
  'popover',
  'popover-foreground',
  'primary',
  'primary-foreground',
  'secondary',
  'secondary-foreground',
  'muted',
  'muted-foreground',
  'accent',
  'accent-foreground',
  'destructive',
  'destructive-foreground',
  'border',
  'input',
  'ring',
  'chart-1',
  'chart-2',
  'chart-3',
  'chart-4',
  'chart-5',
  'sidebar',
  'sidebar-foreground',
  'sidebar-primary',
  'sidebar-primary-foreground',
  'sidebar-accent',
  'sidebar-accent-foreground',
  'sidebar-border',
  'sidebar-ring',
  // Non-color tokens
  'radius',
  'spacing',
  'letter-spacing',
  'font-sans',
  'font-serif',
  'font-mono',
  // Shadow output keys
  'shadow-2xs',
  'shadow-xs',
  'shadow-sm',
  'shadow',
  'shadow-md',
  'shadow-lg',
  'shadow-xl',
  'shadow-2xl'
] as const

/**
 * Color tokens that must be converted from raw values to HSL format.
 */
const COLOR_TOKENS: Record<string, true> = {
  background: true,
  foreground: true,
  card: true,
  'card-foreground': true,
  popover: true,
  'popover-foreground': true,
  primary: true,
  'primary-foreground': true,
  secondary: true,
  'secondary-foreground': true,
  muted: true,
  'muted-foreground': true,
  accent: true,
  'accent-foreground': true,
  destructive: true,
  'destructive-foreground': true,
  border: true,
  input: true,
  ring: true,
  'chart-1': true,
  'chart-2': true,
  'chart-3': true,
  'chart-4': true,
  'chart-5': true,
  sidebar: true,
  'sidebar-foreground': true,
  'sidebar-primary': true,
  'sidebar-primary-foreground': true,
  'sidebar-accent': true,
  'sidebar-accent-foreground': true,
  'sidebar-border': true,
  'sidebar-ring': true
}

/**
 * Apply a theme preset to the document root.
 * Converts color values via culori to HSL, sets non-color tokens verbatim,
 * and composes shadow variables from primitives.
 */
export function applyThemePreset(
  preset: ThemePreset,
  mode: 'light' | 'dark',
  root: HTMLElement
): void {
  const styles = mode === 'light' ? preset.styles.light : preset.styles.dark

  // Always clear managed keys first
  clearManagedKeys(root)

  // Set color tokens (converted to HSL)
  for (const [key, value] of Object.entries(styles)) {
    if (COLOR_TOKENS[key]) {
      const hslValue = colorToHsl(value)
      root.style.setProperty(`--${key}`, hslValue)
    }
  }

  // Set non-color tokens verbatim
  const nonColorTokens = [
    'radius',
    'spacing',
    'letter-spacing',
    'font-sans',
    'font-serif',
    'font-mono'
  ]
  for (const key of nonColorTokens) {
    if (key in styles) {
      const rawValue = styles[key as keyof ThemeStyleProps]
      if (rawValue) {
        root.style.setProperty(`--${key}`, rawValue)
      }
    }
  }

  // Compose and set shadow variables
  const shadowMap = getShadowMap(styles)
  for (const [key, value] of Object.entries(shadowMap)) {
    root.style.setProperty(`--${key}`, value)
  }
}

/**
 * Clear all managed CSS variables from the root element.
 * Allows the base :root/.dark values to show through.
 */
export function clearManagedKeys(root: HTMLElement): void {
  for (const key of MANAGED_KEYS) {
    root.style.removeProperty(`--${key}`)
  }
}

/**
 * Convenience wrapper: clear theme if Default, else apply.
 */
export function applyThemeOrClear(
  preset: ThemePreset | undefined,
  mode: 'light' | 'dark',
  root: HTMLElement
): void {
  if (!preset || preset.id === '') {
    clearManagedKeys(root)
  } else {
    applyThemePreset(preset, mode, root)
  }
}
