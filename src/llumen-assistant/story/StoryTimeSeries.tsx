/**
 * Per-slide time series (Figma 5334:9193): granularity slider (step dots), speed +
 * play controls, scrubber, frame timestamp, and the date-range menu.
 */
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { CaretLeft, CaretRight, Check, FunnelSimple, Minus, Pause, Play, Plus } from '@phosphor-icons/react'
import {
  MAX_PLAYBACK_SPEED,
  MIN_PLAYBACK_SPEED,
  PLAYBACK_SPEEDS,
  TIMELINE_GRANULARITIES,
  TIMELINE_RANGES,
  describeTimelineRange,
  formatFrameDate,
  formatPlaybackSpeed,
  granularityForRange,
  timelineFrameDate,
  type TimelineGranularity,
  type TimelineRange,
} from './storyTimeline'
import styles from './StoryTimeSeries.module.css'

const THUMB_WIDTH = 31
const DOT_SIZE = 4
const SPEED_STEP = 0.05
const DRAG_PREVIEW_PX = 3

type Menu = 'speed' | 'dates' | 'granularity'
type ThumbMotion = 'play' | 'jump' | 'none'

export type StoryTimeSeriesProps = {
  range: TimelineRange
  granularity: TimelineGranularity
  frameCount: number
  frame: number
  playing: boolean
  speed: number
  stepMs: number
  onFrameChange: (frame: number) => void
  onPlayingChange: (playing: boolean) => void
  onSpeedChange: (speed: number) => void
  onGranularityChange: (granularityId: string) => void
  onRangeChange: (rangeId: string) => void
}

function clampSpeed(speed: number) {
  const snapped = Math.round(speed / SPEED_STEP) * SPEED_STEP
  return Math.max(MIN_PLAYBACK_SPEED, Math.min(MAX_PLAYBACK_SPEED, Math.round(snapped * 100) / 100))
}

export function StoryTimeSeries({
  range,
  granularity,
  frameCount,
  frame,
  playing,
  speed,
  stepMs,
  onFrameChange,
  onPlayingChange,
  onSpeedChange,
  onGranularityChange,
  onRangeChange,
}: StoryTimeSeriesProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const dotsRef = useRef<HTMLDivElement>(null)
  const speedBtnRef = useRef<HTMLButtonElement>(null)
  const datesBtnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const resumeAfterScrubRef = useRef(false)
  const scrubPointerRef = useRef<number | null>(null)
  const dotsDragRef = useRef<{ pointerId: number; startX: number; previewing: boolean } | null>(null)
  const [menu, setMenu] = useState<Menu | null>(null)
  const [menuPos, setMenuPos] = useState<{ bottom: number; left?: number; right?: number }>({ bottom: 0 })
  const [scrubbing, setScrubbing] = useState(false)
  const [shownFrame, setShownFrame] = useState(frame)
  const [thumbMotion, setThumbMotion] = useState<ThumbMotion>('jump')

  if (shownFrame !== frame) {
    setShownFrame(frame)
    setThumbMotion(scrubbing ? 'none' : playing ? (frame === shownFrame + 1 ? 'play' : 'none') : 'jump')
  }

  const lastFrame = frameCount - 1
  const progress = lastFrame > 0 ? frame / lastFrame : 0
  const dateText = formatFrameDate(timelineFrameDate(granularity, frameCount, frame))
  const granularityIndex = TIMELINE_GRANULARITIES.indexOf(granularity)

  useEffect(() => {
    if (!menu) return
    const onPointerDown = (event: globalThis.PointerEvent) => {
      const target = event.target as Node
      if (menuRef.current?.contains(target)) return
      const triggers = [speedBtnRef, datesBtnRef, dotsRef]
      if (triggers.some((ref) => ref.current?.contains(target))) return
      setMenu(null)
    }
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setMenu(null)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [menu])

  const openMenu = (next: Menu) => {
    const rect = cardRef.current?.getBoundingClientRect()
    if (!rect) return
    const bottom = window.innerHeight - rect.top + 8
    setMenuPos(next === 'granularity' ? { bottom, left: rect.left } : { bottom, right: window.innerWidth - rect.right })
    setMenu(next)
  }

  const toggleMenu = (next: Menu) => {
    if (menu === next) setMenu(null)
    else openMenu(next)
  }

  const granularityAt = (clientX: number) => {
    const rect = dotsRef.current?.getBoundingClientRect()
    const last = TIMELINE_GRANULARITIES.length - 1
    if (!rect) return granularityIndex
    const ratio = (clientX - rect.left - DOT_SIZE / 2) / (rect.width - DOT_SIZE)
    return Math.round(Math.max(0, Math.min(1, ratio)) * last)
  }

  const selectGranularity = (index: number) => {
    const next = TIMELINE_GRANULARITIES[index]
    if (next && next.id !== granularity.id) onGranularityChange(next.id)
  }

  const onDotsDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    dotsDragRef.current = { pointerId: event.pointerId, startX: event.clientX, previewing: false }
    selectGranularity(granularityAt(event.clientX))
  }

  const onDotsMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dotsDragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    if (!drag.previewing && Math.abs(event.clientX - drag.startX) > DRAG_PREVIEW_PX) {
      drag.previewing = menu !== 'granularity'
      if (drag.previewing) openMenu('granularity')
    }
    selectGranularity(granularityAt(event.clientX))
  }

  const onDotsUp = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dotsDragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    dotsDragRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    if (drag.previewing) setMenu(null)
  }

  const onDotsKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const last = TIMELINE_GRANULARITIES.length - 1
    const next =
      event.key === 'ArrowLeft' || event.key === 'ArrowDown'
        ? Math.max(0, granularityIndex - 1)
        : event.key === 'ArrowRight' || event.key === 'ArrowUp'
          ? Math.min(last, granularityIndex + 1)
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? last
              : null
    if (next === null) return
    event.preventDefault()
    selectGranularity(next)
  }

  const frameAt = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect || lastFrame === 0) return 0
    const ratio = (clientX - rect.left - THUMB_WIDTH / 2) / (rect.width - THUMB_WIDTH)
    return Math.round(Math.max(0, Math.min(1, ratio)) * lastFrame)
  }

  const onScrubStart = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    scrubPointerRef.current = event.pointerId
    resumeAfterScrubRef.current = playing
    if (playing) onPlayingChange(false)
    setScrubbing(true)
    onFrameChange(frameAt(event.clientX))
  }

  const onScrubMove = (event: PointerEvent<HTMLDivElement>) => {
    if (scrubPointerRef.current !== event.pointerId) return
    const next = frameAt(event.clientX)
    if (next !== frame) onFrameChange(next)
  }

  const onScrubEnd = (event: PointerEvent<HTMLDivElement>) => {
    if (scrubPointerRef.current !== event.pointerId) return
    scrubPointerRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    setScrubbing(false)
    if (resumeAfterScrubRef.current) onPlayingChange(true)
  }

  const onScrubKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const next =
      event.key === 'ArrowLeft' || event.key === 'ArrowDown'
        ? Math.max(0, frame - 1)
        : event.key === 'ArrowRight' || event.key === 'ArrowUp'
          ? Math.min(lastFrame, frame + 1)
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? lastFrame
              : null
    if (next === null) return
    event.preventDefault()
    onFrameChange(next)
  }

  const thumbTransition =
    thumbMotion === 'play' ? `${stepMs}ms linear` : thumbMotion === 'jump' ? '220ms ease' : '0ms'

  return (
    <div ref={cardRef} className={styles.card} aria-label="Slide time series">
      <div className={styles.topRow}>
        <div className={styles.stepGroup}>
          <div
            ref={dotsRef}
            className={styles.granularitySlider}
            role="slider"
            tabIndex={0}
            aria-label="Time step granularity"
            aria-valuemin={0}
            aria-valuemax={TIMELINE_GRANULARITIES.length - 1}
            aria-valuenow={granularityIndex}
            aria-valuetext={granularity.label}
            onPointerDown={onDotsDown}
            onPointerMove={onDotsMove}
            onPointerUp={onDotsUp}
            onPointerCancel={onDotsUp}
            onKeyDown={onDotsKey}
          >
            {TIMELINE_GRANULARITIES.map((item, index) => (
              <i key={item.id} className={index === granularityIndex ? styles.dotActive : undefined} />
            ))}
          </div>
          <span className={styles.unit}>{granularity.label}</span>
        </div>
        <div className={styles.controls}>
          <button
            ref={speedBtnRef}
            type="button"
            className={`${styles.speedBtn}${menu === 'speed' ? ` ${styles.controlOpen}` : ''}`}
            aria-label={`Playback speed ${formatPlaybackSpeed(speed)}`}
            aria-haspopup="dialog"
            aria-expanded={menu === 'speed'}
            onClick={() => toggleMenu('speed')}
          >
            {formatPlaybackSpeed(speed)}
          </button>
          <button
            type="button"
            className={styles.playBtn}
            aria-label={playing ? 'Pause time series' : 'Play time series'}
            aria-pressed={playing}
            onClick={() => onPlayingChange(!playing)}
          >
            {playing ? (
              <Pause size={16} weight="regular" aria-hidden />
            ) : (
              <Play size={16} weight="regular" aria-hidden />
            )}
          </button>
        </div>
      </div>

      <div
        ref={trackRef}
        className={`${styles.scrubber}${scrubbing ? ` ${styles.scrubbing}` : ''}`}
        role="slider"
        tabIndex={0}
        aria-label="Time series frame"
        aria-valuemin={0}
        aria-valuemax={lastFrame}
        aria-valuenow={frame}
        aria-valuetext={dateText}
        style={{ '--progress': progress, '--thumb-transition': thumbTransition } as CSSProperties}
        onPointerDown={onScrubStart}
        onPointerMove={onScrubMove}
        onPointerUp={onScrubEnd}
        onPointerCancel={onScrubEnd}
        onKeyDown={onScrubKey}
      >
        <span className={styles.track} aria-hidden>
          <span className={styles.trackFill} />
        </span>
        <span className={styles.thumb} aria-hidden>
          <CaretLeft size={12} weight="bold" />
          <CaretRight size={12} weight="bold" />
        </span>
      </div>

      <div className={styles.dateRow}>
        <span className={styles.date}>{dateText}</span>
        <button
          ref={datesBtnRef}
          type="button"
          className={`${styles.funnelBtn}${menu === 'dates' ? ` ${styles.controlOpen}` : ''}`}
          aria-label="Date range"
          aria-haspopup="dialog"
          aria-expanded={menu === 'dates'}
          onClick={() => toggleMenu('dates')}
        >
          <FunnelSimple size={16} weight="regular" aria-hidden />
        </button>
      </div>

      {menu
        ? createPortal(
            <div
              ref={menuRef}
              role={menu === 'granularity' ? 'listbox' : 'dialog'}
              aria-label={
                menu === 'speed' ? 'Playback speed' : menu === 'dates' ? 'Date range' : 'Time step granularity'
              }
              className={`${styles.menu} ${
                menu === 'speed' ? styles.speedMenu : menu === 'dates' ? styles.datesMenu : styles.granularityMenu
              }`}
              style={{ bottom: menuPos.bottom, left: menuPos.left, right: menuPos.right }}
            >
              {menu === 'granularity' ? (
                TIMELINE_GRANULARITIES.map((option) => {
                  const selected = option.id === granularity.id
                  return (
                    <button
                      key={option.id}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      className={`${styles.granularityItem}${selected ? ` ${styles.granularityItemActive}` : ''}`}
                      onClick={() => {
                        if (!selected) onGranularityChange(option.id)
                        setMenu(null)
                      }}
                    >
                      <span className={styles.granularityCheck} aria-hidden>
                        {selected ? <Check size={14} weight="bold" /> : null}
                      </span>
                      {option.label}
                    </button>
                  )
                })
              ) : menu === 'speed' ? (
                <>
                  <p className={styles.menuTitle}>Playback speed</p>
                  <p className={styles.speedValue}>{speed.toFixed(2)}x</p>
                  <div className={styles.speedSliderRow}>
                    <button
                      type="button"
                      className={styles.stepBtn}
                      aria-label="Slower"
                      disabled={speed <= MIN_PLAYBACK_SPEED}
                      onClick={() => onSpeedChange(clampSpeed(speed - SPEED_STEP))}
                    >
                      <Minus size={14} weight="bold" aria-hidden />
                    </button>
                    <input
                      className={styles.speedSlider}
                      type="range"
                      min={MIN_PLAYBACK_SPEED}
                      max={MAX_PLAYBACK_SPEED}
                      step={SPEED_STEP}
                      value={speed}
                      aria-label="Playback speed"
                      style={
                        {
                          '--fill': (speed - MIN_PLAYBACK_SPEED) / (MAX_PLAYBACK_SPEED - MIN_PLAYBACK_SPEED),
                        } as CSSProperties
                      }
                      onChange={(event) => onSpeedChange(clampSpeed(Number(event.target.value)))}
                    />
                    <button
                      type="button"
                      className={styles.stepBtn}
                      aria-label="Faster"
                      disabled={speed >= MAX_PLAYBACK_SPEED}
                      onClick={() => onSpeedChange(clampSpeed(speed + SPEED_STEP))}
                    >
                      <Plus size={14} weight="bold" aria-hidden />
                    </button>
                  </div>
                  <div className={styles.speedChips}>
                    {PLAYBACK_SPEEDS.map((option) => (
                      <button
                        key={option}
                        type="button"
                        className={`${styles.speedChip}${option === speed ? ` ${styles.speedChipActive}` : ''}`}
                        aria-pressed={option === speed}
                        onClick={() => onSpeedChange(option)}
                      >
                        {option === 1 ? 'Normal' : option}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <p className={styles.menuTitle}>Date range</p>
                  <div className={styles.setupList}>
                    {TIMELINE_RANGES.map((option) => {
                      const selected = option.id === range.id
                      const stepFor = selected ? granularity : granularityForRange(option, granularity.id)
                      return (
                        <button
                          key={option.id}
                          type="button"
                          className={`${styles.setupItem}${selected ? ` ${styles.setupItemActive}` : ''}`}
                          aria-pressed={selected}
                          onClick={() => {
                            onRangeChange(option.id)
                            setMenu(null)
                          }}
                        >
                          <span className={styles.setupText}>
                            <span className={styles.setupLabel}>{option.label}</span>
                            <span className={styles.setupDetail}>{describeTimelineRange(option, stepFor)}</span>
                          </span>
                          {selected ? <Check size={16} weight="bold" aria-hidden /> : null}
                        </button>
                      )
                    })}
                  </div>
                </>
              )}
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
