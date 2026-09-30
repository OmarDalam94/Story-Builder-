import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { Check } from '@phosphor-icons/react'
import { SUMMARY_SWATCHES, normalizeHex } from './storySummary'
import styles from './StoryEditPanel.module.css'

const POPOVER_WIDTH = 232
const POPOVER_HEIGHT = 128

export function ColorPicker({
  label,
  value,
  variant,
  onChange,
}: {
  label: string
  value: string
  variant: 'swatch' | 'chip'
  onChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const [hexDraft, setHexDraft] = useState(value)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  const syncPosition = useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    const below = rect.bottom + 8
    setPosition({
      top:
        below + POPOVER_HEIGHT > window.innerHeight - 8
          ? Math.max(8, rect.top - 8 - POPOVER_HEIGHT)
          : below,
      left: Math.max(8, Math.min(rect.left, window.innerWidth - POPOVER_WIDTH - 8)),
    })
  }, [])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (triggerRef.current?.contains(target) || popoverRef.current?.contains(target)) return
      setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopImmediatePropagation()
      setOpen(false)
      triggerRef.current?.focus()
    }
    const onLayout = () => syncPosition()
    document.addEventListener('mousedown', onPointerDown)
    window.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('resize', onLayout)
    window.addEventListener('scroll', onLayout, true)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('resize', onLayout)
      window.removeEventListener('scroll', onLayout, true)
    }
  }, [open, syncPosition])

  const toggle = () => {
    if (open) {
      setOpen(false)
      return
    }
    setHexDraft(value)
    syncPosition()
    setOpen(true)
  }

  const commitHex = () => {
    const hex = normalizeHex(hexDraft)
    if (hex) onChange(hex)
    else setHexDraft(value)
  }

  const swatchStyle = { '--swatch': value } as CSSProperties

  return (
    <>
      {variant === 'swatch' ? (
        <div className={styles.colorSwatchRow}>
          <button
            ref={triggerRef}
            type="button"
            className={`${styles.colorSwatch}${open ? ` ${styles.colorSwatchOpen}` : ''}`}
            style={swatchStyle}
            aria-label={`${label}, ${value}`}
            aria-haspopup="dialog"
            aria-expanded={open}
            onClick={toggle}
          />
          <span className={styles.colorHex}>{value}</span>
        </div>
      ) : (
        <button
          ref={triggerRef}
          type="button"
          className={`${styles.colorChip}${open ? ` ${styles.colorChipOpen}` : ''}`}
          aria-label={`${label}, ${value}`}
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={toggle}
        >
          <span className={styles.colorChipDot} style={swatchStyle} aria-hidden />
          <span className={styles.colorChipLabel}>{label}</span>
          <span className={styles.colorHex}>{value}</span>
        </button>
      )}
      {open
        ? createPortal(
            <div
              ref={popoverRef}
              className={styles.colorPopover}
              role="dialog"
              aria-label={label}
              style={{ top: position.top, left: position.left, width: POPOVER_WIDTH }}
            >
              <div className={styles.colorPopoverGrid}>
                {SUMMARY_SWATCHES.map((swatch) => (
                  <button
                    key={swatch}
                    type="button"
                    className={styles.colorPopoverSwatch}
                    style={{ '--swatch': swatch } as CSSProperties}
                    aria-label={swatch}
                    aria-pressed={swatch === value}
                    onClick={() => {
                      onChange(swatch)
                      setHexDraft(swatch)
                    }}
                  >
                    {swatch === value ? <Check size={12} weight="bold" aria-hidden /> : null}
                  </button>
                ))}
              </div>
              <input
                className={`${styles.input} ${styles.colorPopoverInput}`}
                value={hexDraft}
                maxLength={7}
                spellCheck={false}
                aria-label={`${label} hex value`}
                onChange={(event) => {
                  setHexDraft(event.target.value)
                  const hex = normalizeHex(event.target.value)
                  if (hex && event.target.value.replace(/^#/, '').length === 6) onChange(hex)
                }}
                onBlur={commitHex}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return
                  event.preventDefault()
                  commitHex()
                  setOpen(false)
                }}
              />
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
