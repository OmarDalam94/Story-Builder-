import type { CSSProperties } from 'react'
import type { BorderBeamColorVariant, BorderBeamSize, BorderBeamTheme } from 'border-beam'

export type FindingAuroraTravel = 'forward' | 'reverse' | 'alternate'

export type FindingAuroraSettings = {
  size: BorderBeamSize
  colorVariant: BorderBeamColorVariant
  theme: BorderBeamTheme
  staticColors: boolean
  active: boolean
  duration: number
  brightness: number
  saturation: number
  hueRange: number
  hueBase: number
  strength: number
  strokeOpacity: number
  innerOpacity: number
  bloomOpacity: number
  travel: FindingAuroraTravel
  trackHeight: number
  pathOffsetLeft: number
  pathOffsetRight: number
  afterScaleX: number
  afterScaleY: number
  beforeScaleX: number
  beforeScaleY: number
  bloomScaleX: number
  bloomScaleY: number
  showCopy: boolean
  copyDelayMs: number
  wordStaggerMs: number
}

/** Tuned finding-notification aurora (Ocean line-beam, taller bloom). */
export const DEFAULT_FINDING_AURORA: FindingAuroraSettings = {
  size: 'line',
  colorVariant: 'ocean',
  theme: 'dark',
  staticColors: false,
  active: true,
  duration: 2.95,
  brightness: 2.55,
  saturation: 3,
  hueRange: 13,
  hueBase: 0,
  strength: 1,
  strokeOpacity: 2,
  innerOpacity: 1.01,
  bloomOpacity: 2,
  travel: 'forward',
  trackHeight: 83,
  pathOffsetLeft: 52,
  pathOffsetRight: 52,
  afterScaleX: 1.35,
  afterScaleY: 2.8,
  beforeScaleX: 1.5,
  beforeScaleY: 6,
  bloomScaleX: 1.7,
  bloomScaleY: 6.1,
  showCopy: true,
  copyDelayMs: 200,
  wordStaggerMs: 48,
}

export const AURORA_COLOR_VARIANTS: { id: BorderBeamColorVariant; label: string }[] = [
  { id: 'colorful', label: 'Colorful' },
  { id: 'ocean', label: 'Ocean' },
  { id: 'sunset', label: 'Sunset' },
  { id: 'mono', label: 'Mono' },
]

export const AURORA_THEMES: { id: BorderBeamTheme; label: string }[] = [
  { id: 'dark', label: 'Dark' },
  { id: 'light', label: 'Light' },
  { id: 'auto', label: 'Auto' },
]

export const AURORA_SIZES: { id: BorderBeamSize; label: string }[] = [
  { id: 'line', label: 'Line' },
  { id: 'sm', label: 'Small' },
  { id: 'md', label: 'Border' },
  { id: 'pulse-inner', label: 'Pulse in' },
  { id: 'pulse-outside', label: 'Pulse out' },
]

export const AURORA_TRAVEL: { id: FindingAuroraTravel; label: string }[] = [
  { id: 'forward', label: 'L → R' },
  { id: 'reverse', label: 'R → L' },
  { id: 'alternate', label: 'Bounce' },
]

export function findingAuroraCssVars(settings: FindingAuroraSettings): CSSProperties {
  const d = DEFAULT_FINDING_AURORA
  return {
    '--aurora-track-h': `${settings.trackHeight}px`,
    '--aurora-after-x': String(settings.afterScaleX),
    '--aurora-after-y': String(settings.afterScaleY),
    '--aurora-before-x': String(settings.beforeScaleX),
    '--aurora-before-y': String(settings.beforeScaleY),
    '--aurora-bloom-x': String(settings.bloomScaleX),
    '--aurora-bloom-y': String(settings.bloomScaleY),
    '--aurora-path-left': `${settings.pathOffsetLeft ?? d.pathOffsetLeft}px`,
    '--aurora-path-right': `${settings.pathOffsetRight ?? d.pathOffsetRight}px`,
    '--beam-stroke-opacity': String(settings.strokeOpacity),
    '--beam-inner-opacity': String(settings.innerOpacity),
    '--beam-bloom-opacity': String(settings.bloomOpacity),
    '--beam-hue-base': `${settings.hueBase}deg`,
  } as CSSProperties
}
