import { useEffect, useRef, useState } from 'react'
import { BorderBeam } from 'border-beam'
import { llumenAssets } from '../assets'
import {
  DEFAULT_FINDING_AURORA,
  findingAuroraCssVars,
  type FindingAuroraSettings,
} from './findingAuroraSettings'
import styles from './FindingReveal.module.css'

function splitWordSpaceSegments(text: string): { text: string; isWord: boolean }[] {
  const segments: { text: string; isWord: boolean }[] = []
  const re = /\S+|\s+/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    segments.push({ text: m[0], isWord: /\S/.test(m[0]) })
  }
  return segments
}

function FindingCopyText({
  text,
  reduceMotion,
  staggerMs,
}: {
  text: string
  reduceMotion: boolean
  staggerMs: number
}) {
  if (reduceMotion || !text) {
    return <p className={styles.copyText}>{text}</p>
  }

  const segments = splitWordSpaceSegments(text)
  let wordIndex = 0

  return (
    <p className={styles.copyText}>
      {segments.map((seg, idx) => {
        if (!seg.isWord) {
          return <span key={`sp-${idx}`}>{seg.text}</span>
        }
        const delay = wordIndex * staggerMs
        wordIndex += 1
        return (
          <span
            key={`w-${idx}-${seg.text.slice(0, 24)}`}
            className={styles.wordReveal}
            style={{ animationDelay: `${delay}ms` }}
          >
            {seg.text}
          </span>
        )
      })}
    </p>
  )
}

export type FindingRevealProps = {
  count: number
  /** Fires once the intro (aurora + copy) has finished and the stack should appear. */
  onReady: () => void
  settings?: FindingAuroraSettings
  /** Keep the aurora looping and skip advancing to the toast stack. */
  hold?: boolean
}

/**
 * Finding notification intro: line-beam aurora behind the chatbox with Llumen copy.
 * Unmounted when the finding stack appears.
 */
export function FindingReveal({
  count,
  onReady,
  settings = DEFAULT_FINDING_AURORA,
  hold = false,
}: FindingRevealProps) {
  const [copyVisible, setCopyVisible] = useState(false)
  const [beamVisible, setBeamVisible] = useState(hold)
  const [reduceMotion, setReduceMotion] = useState(false)
  const onReadyRef = useRef(onReady)
  onReadyRef.current = onReady
  const holdRef = useRef(hold)
  holdRef.current = hold

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    setReduceMotion(reduce)
    if (reduce && !holdRef.current) {
      onReadyRef.current()
      return
    }
    if (holdRef.current) setBeamVisible(true)
    const copyTimer = window.setTimeout(() => {
      setCopyVisible(true)
      setBeamVisible(true)
    }, settings.copyDelayMs)
    const cycleMs = Math.max(0, settings.duration) * 1000
    const readyTimer = hold
      ? undefined
      : window.setTimeout(() => onReadyRef.current(), settings.copyDelayMs + cycleMs)
    return () => {
      window.clearTimeout(copyTimer)
      if (readyTimer != null) window.clearTimeout(readyTimer)
    }
  }, [hold, settings.copyDelayMs, settings.duration])

  const message =
    count === 1
      ? 'I found 1 thing that might need your attention'
      : `I found ${count} things that might need your attention`

  return (
    <>
      {beamVisible ? (
        <div className={styles.aurora} aria-hidden>
          <BorderBeam
            size={settings.size}
            theme={settings.theme}
            colorVariant={settings.colorVariant}
            brightness={settings.brightness}
            saturation={settings.saturation}
            duration={settings.duration}
            hueRange={settings.hueRange}
            strength={settings.strength}
            staticColors={settings.staticColors}
            active={settings.active}
            borderRadius={0}
            className={styles.beam}
            data-travel={settings.travel}
            data-play={hold ? 'loop' : 'once'}
            style={findingAuroraCssVars(settings)}
          >
            <div className={styles.track} />
          </BorderBeam>
        </div>
      ) : null}
      {copyVisible && settings.showCopy ? (
        <div className={styles.copy} aria-live="polite">
          <img className={styles.copyOrb} src={llumenAssets.launcherOrb} alt="" />
          <FindingCopyText
            text={message}
            reduceMotion={reduceMotion}
            staggerMs={settings.wordStaggerMs}
          />
        </div>
      ) : null}
    </>
  )
}
