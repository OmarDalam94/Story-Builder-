/**
 * Landing Story content type — Figma slide-landing-screen-map (3359:3802).
 * Full-page main content (not agent subcontext). Map from llumen-map-legend layers.
 */
import { useMemo, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Buildings,
  CalendarBlank,
  CaretDown,
  Eye,
  GenderIntersex,
  Info,
  MapPin,
  PencilSimple,
  Student,
  SquaresFour,
  X,
} from '@phosphor-icons/react'
import { llumenAssets } from '../assets'
import { StoryEditPanel } from './StoryEditPanel'
import {
  getLandingStory,
  type LandingStory,
  type StoryFilter,
  type StorySlide,
} from './storyDemoData'
import { StoryMap, type StoryMapLayerVisibility } from './StoryMap'
import styles from './StoryView.module.css'

export type StoryViewProps = {
  storyId: string
  onBack: () => void
  /** Opens left agent rail with current story/slide context. */
  onAsk?: (context: { story: LandingStory; slideIndex: number; sourceRect: DOMRect }) => void
  /** When the agent rail is open, hide the Ask icon. */
  agentOpen?: boolean
}

function Chem({ name }: { name: string }) {
  const match = name.match(/^([A-Za-z]+)(\d+(?:\.\d+)?)$/)
  if (!match) return <>{name}</>
  return (
    <>
      {match[1]}
      <sub>{match[2]}</sub>
    </>
  )
}

function filterIcon(id: string) {
  switch (id) {
    case 'loc':
      return <MapPin size={18} weight="regular" aria-hidden />
    case 'year':
      return <CalendarBlank size={18} weight="regular" aria-hidden />
    case 'ssi':
      return <SquaresFour size={18} weight="regular" aria-hidden />
    case 'type':
      return <Buildings size={18} weight="regular" aria-hidden />
    case 'gender':
      return <GenderIntersex size={18} weight="regular" aria-hidden />
    case 'level':
      return <Student size={18} weight="regular" aria-hidden />
    default:
      return <SquaresFour size={18} weight="regular" aria-hidden />
  }
}

function copySlide(slide: StorySlide): StorySlide {
  return {
    ...slide,
    pollutants: slide.pollutants.map((pollutant) => ({ ...pollutant })),
  }
}

function makeFilterMap(slides: StorySlide[], filters: StoryFilter[]) {
  return Object.fromEntries(
    slides.map((slide) => [slide.id, filters.map((filter) => ({ ...filter }))]),
  ) as Record<string, StoryFilter[]>
}

export function StoryView({ storyId, onBack, onAsk, agentOpen = false }: StoryViewProps) {
  const story = useMemo(() => getLandingStory(storyId), [storyId])
  const [storyTitle, setStoryTitle] = useState(story.storyTitle)
  const [storyDescription, setStoryDescription] = useState(story.description)
  const [slideIndex, setSlideIndex] = useState(0)
  const [slides, setSlides] = useState<StorySlide[]>(() => story.slides.map(copySlide))
  const [filtersBySlide, setFiltersBySlide] = useState<Record<string, StoryFilter[]>>(() =>
    makeFilterMap(story.slides, story.filters),
  )
  const [legendOpen, setLegendOpen] = useState(true)
  const [editOpen, setEditOpen] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  const [layers, setLayers] = useState<StoryMapLayerVisibility>({
    utilization: true,
    vehiclesActive: true,
    vehiclesIdling: true,
  })

  const activeSlideIndex = Math.min(slideIndex, slides.length - 1)
  const slide = slides[activeSlideIndex]
  const filters = filtersBySlide[slide.id] ?? story.filters
  const previewStory: LandingStory = {
    ...story,
    storyTitle,
    description: storyDescription,
    filters,
    slides,
  }
  const canPrev = activeSlideIndex > 0
  const canNext = activeSlideIndex < slides.length - 1
  const aqiPct = Math.min(100, Math.max(0, (slide.aqi / 500) * 100))

  return (
    <div className={styles.root} aria-label={`${story.storyTitle} story`}>
      <StoryMap className={styles.map} layers={layers} />

      <div className={styles.overlay}>
        <header className={styles.header}>
          <div className={styles.titleRow}>
            <button type="button" className={styles.backBtn} onClick={onBack} aria-label="Back to home">
              <ArrowLeft size={20} weight="regular" aria-hidden />
            </button>
            <div className={styles.titleGroup}>
              <h1 className={styles.storyTitle}>{storyTitle}</h1>
              <button
                type="button"
                className={styles.infoBtn}
                aria-label="Show Story description"
                aria-expanded={infoOpen}
                aria-describedby={infoOpen ? 'story-description' : undefined}
                onClick={() => setInfoOpen((open) => !open)}
              >
                <Info size={18} weight="regular" aria-hidden />
              </button>
              {infoOpen ? (
                <div id="story-description" className={styles.infoPopover} role="tooltip">
                  {storyDescription || 'No description added.'}
                </div>
              ) : null}
            </div>
            <button
              type="button"
              className={`${styles.editBtn}${editOpen ? ` ${styles.editBtnActive}` : ''}`}
              aria-expanded={editOpen}
              aria-controls="story-edit-panel"
              onClick={() => setEditOpen((open) => !open)}
            >
              <PencilSimple size={16} weight="regular" aria-hidden />
              <span>Edit</span>
            </button>
          </div>
          <div className={styles.filters}>
            {filters.map((f) => (
              <span
                key={f.id}
                className={`${styles.filterPill}${f.removable ? ` ${styles.filterPillActive}` : ''}`}
              >
                {filterIcon(f.id)}
                <span>{f.label}</span>
                {f.removable ? (
                  <span className={styles.filterClear} aria-hidden>
                    <X size={10} weight="bold" />
                  </span>
                ) : null}
              </span>
            ))}
          </div>
          <div className={styles.headerRule} aria-hidden />
        </header>

        <div
          className={`${styles.body}${slide.focusLayout ? ` ${styles.bodyFocus}` : ''}`}
        >
          <aside
            className={[
              styles.insight,
              slide.layout === 'full-width' ? styles.insightFullWidth : '',
              slide.layout === 'sidebar' && slide.sidebarWidth === 'small'
                ? styles.insightSmall
                : '',
              slide.focusLayout ? styles.insightFocus : '',
            ]
              .filter(Boolean)
              .join(' ')}
            aria-label="Story insight"
          >
            <div className={styles.insightCopy}>
              <h2 className={styles.slideHeading}>{slide.title}</h2>
              <p className={styles.finding}>{slide.finding}</p>
              <p className={styles.bodyCopy}>{slide.body}</p>
            </div>

            <section className={styles.aqiCard}>
              <p className={styles.aqiLabel}>Air Quality Index</p>
              <p className={styles.aqiValue}>{slide.aqi}</p>
              <div className={styles.aqiBar} aria-hidden>
                <span className={styles.aqiThumb} style={{ left: `${aqiPct}%` }} />
              </div>
              <span className={styles.statusPillUnhealthy}>{slide.aqiLabel}</span>
            </section>

            <section className={styles.pollutants}>
              <p className={styles.pollutantsTitle}>Pollutants</p>
              <div className={styles.pollutantGrid}>
                {slide.pollutants.map((p) => (
                  <div key={p.name} className={styles.pollutant}>
                    <p className={styles.pollutantName}>
                      <Chem name={p.name} />
                    </p>
                    <div className={styles.pollutantValue}>
                      <strong>{p.value}</strong>
                      <span>
                        {p.unit.includes('/') ? (
                          <>
                            {p.unit.split('/')[0]}
                            <br />/{p.unit.split('/')[1]}
                          </>
                        ) : (
                          p.unit
                        )}
                      </span>
                    </div>
                    <span
                      className={
                        p.status === 'critical' ? styles.statusPillCritical : styles.statusPillNormal
                      }
                    >
                      {p.status === 'critical' ? 'Critical' : 'Normal'}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </div>

        {editOpen ? (
          <StoryEditPanel
            storyTitle={storyTitle}
            storyDescription={storyDescription}
            slides={slides}
            activeSlideIndex={activeSlideIndex}
            filters={filters}
            onStoryTitleChange={setStoryTitle}
            onStoryDescriptionChange={setStoryDescription}
            onSelectSlide={setSlideIndex}
            onSlideChange={(nextSlide) =>
              setSlides((items) =>
                items.map((item) => (item.id === nextSlide.id ? nextSlide : item)),
              )
            }
            onFiltersChange={(nextFilters) =>
              setFiltersBySlide((current) => ({ ...current, [slide.id]: nextFilters }))
            }
            onAddSlide={() => {
              const id = `${story.id}-slide-${Date.now()}`
              const nextSlide = {
                ...copySlide(slide),
                id,
                title: `Untitled slide ${slides.length + 1}`,
              }
              setSlides((items) => [...items, nextSlide])
              setFiltersBySlide((current) => ({
                ...current,
                [id]: filters.map((filter) => ({ ...filter })),
              }))
              setSlideIndex(slides.length)
            }}
            onDuplicateSlide={() => {
              const id = `${story.id}-slide-${Date.now()}`
              const nextSlide = {
                ...copySlide(slide),
                id,
                title: `${slide.title} copy`,
              }
              setSlides((items) => [...items, nextSlide])
              setFiltersBySlide((current) => ({
                ...current,
                [id]: filters.map((filter) => ({ ...filter })),
              }))
              setSlideIndex(slides.length)
            }}
            onDeleteSlide={() => {
              if (slides.length === 1) return
              setSlides((items) => items.filter((item) => item.id !== slide.id))
              setFiltersBySlide((current) => {
                const next = { ...current }
                delete next[slide.id]
                return next
              })
              setSlideIndex(Math.max(0, activeSlideIndex - 1))
            }}
            onReset={() => {
              setStoryTitle(story.storyTitle)
              setStoryDescription(story.description)
              setSlides(story.slides.map(copySlide))
              setFiltersBySlide(makeFilterMap(story.slides, story.filters))
              setSlideIndex(0)
              setLayers({
                utilization: true,
                vehiclesActive: true,
                vehiclesIdling: true,
              })
            }}
            onClose={() => setEditOpen(false)}
          />
        ) : null}

        <div className={styles.mapData}>
          <button
            type="button"
            className={styles.mapDataHeader}
            onClick={() => setLegendOpen((o) => !o)}
            aria-expanded={legendOpen}
          >
            <span>Map Data</span>
            <CaretDown
              size={16}
              weight="bold"
              className={legendOpen ? styles.caretOpen : undefined}
              aria-hidden
            />
          </button>
          {legendOpen ? (
            <div className={styles.mapDataBody}>
              <p className={styles.legendSection}>Vehicles Status (Live)</p>
              <div className={styles.legendRow}>
                <span className={styles.legendMark}>
                  <img src={`${iconPath('diamond-active')}`} alt="" width={12} height={12} />
                  Active
                </span>
                <button
                  type="button"
                  className={styles.eyeBtn}
                  aria-pressed={layers.vehiclesActive}
                  onClick={() => setLayers((l) => ({ ...l, vehiclesActive: !l.vehiclesActive }))}
                >
                  <Eye size={16} weight={layers.vehiclesActive ? 'fill' : 'regular'} aria-hidden />
                </button>
              </div>
              <div className={styles.legendRow}>
                <span className={styles.legendMark}>
                  <img src={`${iconPath('diamond-idling')}`} alt="" width={12} height={12} />
                  Idling
                </span>
                <button
                  type="button"
                  className={styles.eyeBtn}
                  aria-pressed={layers.vehiclesIdling}
                  onClick={() => setLayers((l) => ({ ...l, vehiclesIdling: !l.vehiclesIdling }))}
                >
                  <Eye size={16} weight={layers.vehiclesIdling ? 'fill' : 'regular'} aria-hidden />
                </button>
              </div>
              <div className={styles.legendRow}>
                <span>Utilization Overlay</span>
                <button
                  type="button"
                  className={styles.eyeBtn}
                  aria-pressed={layers.utilization}
                  onClick={() => setLayers((l) => ({ ...l, utilization: !l.utilization }))}
                >
                  <Eye size={16} weight={layers.utilization ? 'fill' : 'regular'} aria-hidden />
                </button>
              </div>
              <div className={styles.legendScale}>
                <span>Low</span>
                <span className={styles.gradientBar} aria-hidden />
                <span>High</span>
              </div>
            </div>
          ) : null}
        </div>

        <div className={styles.lowerNav} aria-label="Story navigation">
          {!agentOpen && onAsk ? (
            <button
              type="button"
              className={styles.askBtn}
              aria-label="Ask about this story"
              onClick={(event) =>
                onAsk({
                  story: previewStory,
                  slideIndex: activeSlideIndex,
                  sourceRect: event.currentTarget.getBoundingClientRect(),
                })
              }
            >
              <img className={styles.askIcon} src={llumenAssets.launcherOrb} alt="" width={24} height={24} />
            </button>
          ) : null}

          <div className={styles.navCluster}>
            <button
              type="button"
              className={styles.navArrow}
              aria-label="Previous slide"
              disabled={!canPrev}
              onClick={() => canPrev && setSlideIndex((i) => i - 1)}
            >
              <ArrowLeft size={20} weight="regular" aria-hidden />
            </button>
            <span className={styles.navCount}>
              {activeSlideIndex + 1}/{slides.length}
            </span>
            <button
              type="button"
              className={styles.navArrow}
              aria-label="Next slide"
              disabled={!canNext}
              onClick={() => canNext && setSlideIndex((i) => i + 1)}
            >
              <ArrowRight size={20} weight="regular" aria-hidden />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function iconPath(name: 'diamond-active' | 'diamond-idling') {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '')
  return `${base}/llumen-assets/map-icons/${name}.svg`
}
