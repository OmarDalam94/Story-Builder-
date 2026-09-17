import { useEffect, useId, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ArrowCounterClockwise, Sparkle, X } from '@phosphor-icons/react'
import { useRevealScrollbarOnScroll } from '../useRevealScrollbarOnScroll'
import {
  AURORA_COLOR_VARIANTS,
  AURORA_SIZES,
  AURORA_THEMES,
  AURORA_TRAVEL,
  DEFAULT_FINDING_AURORA,
  type FindingAuroraSettings,
} from './findingAuroraSettings'
import styles from './FindingAuroraPanel.module.css'

export type FindingAuroraPanelProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  settings: FindingAuroraSettings
  onChange: (next: FindingAuroraSettings) => void
  onReplay: () => void
}

function patch<K extends keyof FindingAuroraSettings>(
  settings: FindingAuroraSettings,
  onChange: (next: FindingAuroraSettings) => void,
  key: K,
  value: FindingAuroraSettings[K],
) {
  onChange({ ...settings, [key]: value })
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { id: T; label: string }[]
  onChange: (id: T) => void
}) {
  return (
    <div className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <div className={styles.segmented} role="radiogroup" aria-label={label}>
        {options.map((opt) => {
          const active = opt.id === value
          return (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={active}
              className={`${styles.segBtn}${active ? ` ${styles.segBtnActive}` : ''}`}
              onClick={() => onChange(opt.id)}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  format: (n: number) => string
  onChange: (n: number) => void
}) {
  const id = useId()
  return (
    <div className={styles.sliderRow}>
      <label className={styles.sliderMeta} htmlFor={id}>
        <span>{label}</span>
        <span className={styles.sliderValue}>{format(value)}</span>
      </label>
      <input
        id={id}
        className={styles.slider}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  )
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <label className={styles.toggleRow}>
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>{title}</h3>
      <div className={styles.sectionBody}>{children}</div>
    </section>
  )
}

function fmt2(n: number) {
  return n.toFixed(2)
}
function fmtInt(n: number) {
  return String(Math.round(n))
}

export function FindingAuroraPanel({
  open,
  onOpenChange,
  settings,
  onChange,
  onReplay,
}: FindingAuroraPanelProps) {
  const scrollRef = useRevealScrollbarOnScroll()
  const set = <K extends keyof FindingAuroraSettings>(key: K, value: FindingAuroraSettings[K]) =>
    patch(settings, onChange, key, value)

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOpenChange(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onOpenChange])

  const lineHueMax = settings.size === 'line' ? 13 : 180

  return (
    <div className={styles.root}>
      <button
        type="button"
        className={`${styles.trigger}${open ? ` ${styles.triggerOpen}` : ''}`}
        aria-expanded={open}
        aria-controls="finding-aurora-panel"
        onClick={() => onOpenChange(!open)}
      >
        <span className={styles.kicker}>FX</span>
        <Sparkle size={14} weight="fill" aria-hidden />
        <span>Aurora</span>
      </button>
      {open
        ? createPortal(
            <aside
              id="finding-aurora-panel"
              className={styles.panel}
              aria-label="Finding aurora settings"
            >
              <header className={styles.panelHeader}>
                <div className={styles.panelTitleBlock}>
                  <p className={styles.panelKicker}>Finding notification</p>
                  <h2 className={styles.panelTitle}>Aurora</h2>
                </div>
                <div className={styles.panelActions}>
                  <button
                    type="button"
                    className={styles.iconBtn}
                    onClick={onReplay}
                    aria-label="Replay aurora"
                    title="Replay"
                  >
                    <ArrowCounterClockwise size={16} weight="bold" aria-hidden />
                  </button>
                  <button
                    type="button"
                    className={styles.iconBtn}
                    onClick={() => onChange({ ...DEFAULT_FINDING_AURORA })}
                    aria-label="Reset aurora settings"
                    title="Reset"
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    className={styles.iconBtn}
                    onClick={() => onOpenChange(false)}
                    aria-label="Close aurora settings"
                  >
                    <X size={16} weight="bold" aria-hidden />
                  </button>
                </div>
              </header>

              <div ref={scrollRef} className={styles.scroll}>
                <div className={styles.scrollInner}>
                  <Section title="Color">
                    <Segmented
                      label="Palette"
                      value={settings.colorVariant}
                      options={AURORA_COLOR_VARIANTS}
                      onChange={(id) => set('colorVariant', id)}
                    />
                    <Segmented
                      label="Theme"
                      value={settings.theme}
                      options={AURORA_THEMES}
                      onChange={(id) => set('theme', id)}
                    />
                    <SliderRow
                      label="Hue offset"
                      value={settings.hueBase}
                      min={0}
                      max={360}
                      step={1}
                      format={(n) => `${fmtInt(n)}°`}
                      onChange={(n) => set('hueBase', n)}
                    />
                    <SliderRow
                      label="Hue range"
                      value={Math.min(settings.hueRange, lineHueMax)}
                      min={0}
                      max={lineHueMax}
                      step={1}
                      format={(n) => `${fmtInt(n)}°`}
                      onChange={(n) => set('hueRange', n)}
                    />
                    <ToggleRow
                      label="Lock colors (no hue shift)"
                      checked={settings.staticColors}
                      onChange={(n) => set('staticColors', n)}
                    />
                  </Section>

                  <Section title="Motion">
                    <Segmented
                      label="Type"
                      value={settings.size}
                      options={AURORA_SIZES}
                      onChange={(id) => set('size', id)}
                    />
                    <Segmented
                      label="Direction"
                      value={settings.travel}
                      options={AURORA_TRAVEL}
                      onChange={(id) => set('travel', id)}
                    />
                    <SliderRow
                      label="Travel speed"
                      value={settings.duration}
                      min={0.4}
                      max={8}
                      step={0.05}
                      format={(n) => `${fmt2(n)}s`}
                      onChange={(n) => set('duration', n)}
                    />
                    <ToggleRow
                      label="Animation playing"
                      checked={settings.active}
                      onChange={(n) => set('active', n)}
                    />
                  </Section>

                  <Section title="Intensity">
                    <SliderRow
                      label="Strength"
                      value={settings.strength}
                      min={0}
                      max={1}
                      step={0.01}
                      format={fmt2}
                      onChange={(n) => set('strength', n)}
                    />
                    <SliderRow
                      label="Brightness"
                      value={settings.brightness}
                      min={0.2}
                      max={4}
                      step={0.05}
                      format={fmt2}
                      onChange={(n) => set('brightness', n)}
                    />
                    <SliderRow
                      label="Saturation"
                      value={settings.saturation}
                      min={0}
                      max={3}
                      step={0.05}
                      format={fmt2}
                      onChange={(n) => set('saturation', n)}
                    />
                    <SliderRow
                      label="Stroke opacity"
                      value={settings.strokeOpacity}
                      min={0}
                      max={2}
                      step={0.01}
                      format={fmt2}
                      onChange={(n) => set('strokeOpacity', n)}
                    />
                    <SliderRow
                      label="Inner glow"
                      value={settings.innerOpacity}
                      min={0}
                      max={2}
                      step={0.01}
                      format={fmt2}
                      onChange={(n) => set('innerOpacity', n)}
                    />
                    <SliderRow
                      label="Bloom opacity"
                      value={settings.bloomOpacity}
                      min={0}
                      max={2}
                      step={0.01}
                      format={fmt2}
                      onChange={(n) => set('bloomOpacity', n)}
                    />
                  </Section>

                  <Section title="Bloom shape">
                    <SliderRow
                      label="Track height"
                      value={settings.trackHeight}
                      min={24}
                      max={160}
                      step={1}
                      format={(n) => `${fmtInt(n)}px`}
                      onChange={(n) => set('trackHeight', n)}
                    />
                    <SliderRow
                      label="Path offset left"
                      value={settings.pathOffsetLeft ?? DEFAULT_FINDING_AURORA.pathOffsetLeft}
                      min={-80}
                      max={160}
                      step={1}
                      format={(n) => `${fmtInt(n)}px`}
                      onChange={(n) => set('pathOffsetLeft', n)}
                    />
                    <SliderRow
                      label="Path offset right"
                      value={settings.pathOffsetRight ?? DEFAULT_FINDING_AURORA.pathOffsetRight}
                      min={-80}
                      max={160}
                      step={1}
                      format={(n) => `${fmtInt(n)}px`}
                      onChange={(n) => set('pathOffsetRight', n)}
                    />
                    <SliderRow
                      label="Stroke scale X"
                      value={settings.afterScaleX}
                      min={0.4}
                      max={3}
                      step={0.05}
                      format={fmt2}
                      onChange={(n) => set('afterScaleX', n)}
                    />
                    <SliderRow
                      label="Stroke scale Y"
                      value={settings.afterScaleY}
                      min={0.4}
                      max={6}
                      step={0.05}
                      format={fmt2}
                      onChange={(n) => set('afterScaleY', n)}
                    />
                    <SliderRow
                      label="Inner scale X"
                      value={settings.beforeScaleX}
                      min={0.4}
                      max={3}
                      step={0.05}
                      format={fmt2}
                      onChange={(n) => set('beforeScaleX', n)}
                    />
                    <SliderRow
                      label="Inner scale Y"
                      value={settings.beforeScaleY}
                      min={0.4}
                      max={6}
                      step={0.05}
                      format={fmt2}
                      onChange={(n) => set('beforeScaleY', n)}
                    />
                    <SliderRow
                      label="Bloom scale X"
                      value={settings.bloomScaleX}
                      min={0.4}
                      max={4}
                      step={0.05}
                      format={fmt2}
                      onChange={(n) => set('bloomScaleX', n)}
                    />
                    <SliderRow
                      label="Bloom scale Y"
                      value={settings.bloomScaleY}
                      min={0.4}
                      max={8}
                      step={0.05}
                      format={fmt2}
                      onChange={(n) => set('bloomScaleY', n)}
                    />
                  </Section>

                  <Section title="Intro timing">
                    <ToggleRow
                      label="Show copy"
                      checked={settings.showCopy}
                      onChange={(n) => set('showCopy', n)}
                    />
                    <SliderRow
                      label="Copy delay"
                      value={settings.copyDelayMs}
                      min={0}
                      max={2000}
                      step={20}
                      format={(n) => `${fmtInt(n)}ms`}
                      onChange={(n) => set('copyDelayMs', n)}
                    />
                    <p className={styles.hint}>
                      Copy stays for one travel pass ({settings.duration.toFixed(2)}s), then
                      dismisses.
                    </p>
                    <SliderRow
                      label="Word stagger"
                      value={settings.wordStaggerMs}
                      min={0}
                      max={200}
                      step={2}
                      format={(n) => `${fmtInt(n)}ms`}
                      onChange={(n) => set('wordStaggerMs', n)}
                    />
                  </Section>
                </div>
              </div>
            </aside>,
            document.body,
          )
        : null}
    </div>
  )
}
