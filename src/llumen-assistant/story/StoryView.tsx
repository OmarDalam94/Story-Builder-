/**
 * Landing Story content type — Figma slide-landing-screen-map (3359:3802).
 * Full-page main content (not agent subcontext). Map from llumen-map-legend layers.
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowLeft,
  ArrowRight,
  Buildings,
  CalendarBlank,
  CaretDown,
  Copy,
  DotsThree,
  Export,
  Eye,
  EyeSlash,
  GearSix,
  GenderIntersex,
  Info,
  List,
  MapPin,
  MapTrifold,
  PaintBucket,
  Pause,
  PencilSimple,
  Play,
  Plus,
  Student,
  SquaresFour,
  Trash,
  X,
} from '@phosphor-icons/react'
import { llumenAssets } from '../assets'
import { ShareModal } from '../ShareModal'
import {
  AnimatedNumber,
  BiodiversityChart,
  EMISSIONS_LINE,
  EmissionsChart,
  GROUNDWATER_LINE,
  GroundwaterChart,
  MonitoringSitesChart,
  formatCount,
  warpPath,
} from './StoryCharts'
import {
  StoryEditPanel,
  type StoryEditSection,
  type StoryPresentationSettings,
} from './StoryEditPanel'
import {
  getLandingStory,
  type LandingStory,
  type StoryFilter,
  type StoryChapter,
  type StorySlide,
} from './storyDemoData'
import { StoryMap, STORY_MAP_STYLE, type StoryMapLayerVisibility } from './StoryMap'
import { sceneAtPhase, storySceneAt, type ColumnGlyphColors } from './storyDemoScenes'
import { StoryTimeSeries } from './StoryTimeSeries'
import {
  DEFAULT_SLIDE_TIMELINE,
  timelineFrameCount,
  timelineGranularityById,
  timelineRangeById,
  timelineStepMs,
  withGranularity,
  withRange,
  type SlideTimeline,
} from './storyTimeline'
import styles from './StoryView.module.css'

export type StoryViewProps = {
  storyId: string
  onBack: () => void
  /** Opens left agent rail with current story/slide context. */
  onAsk?: (context: { story: LandingStory; slideIndex: number; sourceRect: DOMRect }) => void
  /** When the agent rail is open, hide the Ask icon. */
  agentOpen?: boolean
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

function makePresentationSettings(): StoryPresentationSettings {
  return {
    darkLogoName: '',
    lightLogoName: '',
    textDirection: 'ltr',
    chapterSplash: false,
    autoplay: false,
    multiSlide: true,
  }
}

export function StoryView({ storyId, onBack, onAsk, agentOpen = false }: StoryViewProps) {
  const story = useMemo(() => getLandingStory(storyId), [storyId])
  const [storyTitle, setStoryTitle] = useState(story.storyTitle)
  const [storyDescription, setStoryDescription] = useState(story.description)
  const [presentationSettings, setPresentationSettings] = useState(makePresentationSettings)
  const [autoplaying, setAutoplaying] = useState(false)
  const [slideIndex, setSlideIndex] = useState(0)
  const [chapters, setChapters] = useState<StoryChapter[]>(() =>
    story.chapters.map((chapter) => ({ ...chapter })),
  )
  const [slides, setSlides] = useState<StorySlide[]>(() => story.slides.map(copySlide))
  const [filtersBySlide, setFiltersBySlide] = useState<Record<string, StoryFilter[]>>(() =>
    makeFilterMap(story.slides, story.filters),
  )
  const [legendOpen, setLegendOpen] = useState(true)
  const [editSection, setEditSection] = useState<StoryEditSection | null>(null)
  const [storyMode, setStoryMode] = useState<'edit' | 'view'>('view')
  const [shareOpen, setShareOpen] = useState(false)
  const [storyMenuOpen, setStoryMenuOpen] = useState(false)
  const [storyMenuPos, setStoryMenuPos] = useState({ top: 0, left: 0 })
  const storyMenuRef = useRef<HTMLButtonElement>(null)
  const [slideMenuOpen, setSlideMenuOpen] = useState(false)
  const [slideMenuPos, setSlideMenuPos] = useState({ top: 0, left: 0 })
  const slideMenuRef = useRef<HTMLButtonElement>(null)
  const [directSlideEditor, setDirectSlideEditor] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  const [layers, setLayers] = useState<StoryMapLayerVisibility>({
    junctions: true,
    distribution: true,
  })
  const [mapStyle, setMapStyle] = useState({ id: 'aimsun-teal', url: STORY_MAP_STYLE })
  const [timelineBySlide, setTimelineBySlide] = useState<Record<string, SlideTimeline>>({})
  const [timelinePlaying, setTimelinePlaying] = useState(false)
  const [playbackSpeed, setPlaybackSpeed] = useState(1)

  const activeSlideIndex = Math.min(slideIndex, slides.length - 1)
  const slide = slides[activeSlideIndex]
  const [timelineSlideId, setTimelineSlideId] = useState(slide.id)
  if (timelineSlideId !== slide.id) {
    setTimelineSlideId(slide.id)
    setTimelinePlaying(false)
  }
  const filters = filtersBySlide[slide.id] ?? story.filters
  const timeline = timelineBySlide[slide.id] ?? DEFAULT_SLIDE_TIMELINE
  const timelineRange = timelineRangeById(timeline.rangeId)
  const timelineGranularity = timelineGranularityById(timeline.granularityId)
  const frameCount = timelineFrameCount(timelineRange, timelineGranularity)
  const frameStepMs = timelineStepMs(frameCount, playbackSpeed)
  const framePhase = timeline.frame / frameCount
  const baseScene = storySceneAt(activeSlideIndex)
  const scene = useMemo(() => sceneAtPhase(baseScene, framePhase), [baseScene, framePhase])
  const insight = scene.insight
  const emissionsLine = useMemo(
    () => warpPath(EMISSIONS_LINE, insight.emissionsWarp),
    [insight.emissionsWarp],
  )
  const groundwaterLine = useMemo(
    () => warpPath(GROUNDWATER_LINE, insight.groundwaterWarp),
    [insight.groundwaterWarp],
  )
  const previewStory: LandingStory = {
    ...story,
    storyTitle,
    description: storyDescription,
    filters,
    chapters,
    slides,
  }
  const slidesConfigOpen = editSection === 'slide' && !directSlideEditor
  const canPrev = activeSlideIndex > 0
  const canNext = activeSlideIndex < slides.length - 1

  const updateTimeline = (slideId: string, update: (current: SlideTimeline) => SlideTimeline) => {
    setTimelineBySlide((current) => ({
      ...current,
      [slideId]: update(current[slideId] ?? DEFAULT_SLIDE_TIMELINE),
    }))
  }

  useEffect(() => {
    if (!timelinePlaying) return
    const slideId = slide.id
    const timer = window.setTimeout(() => {
      setTimelineBySlide((current) => {
        const entry = current[slideId] ?? DEFAULT_SLIDE_TIMELINE
        return { ...current, [slideId]: { ...entry, frame: (entry.frame + 1) % frameCount } }
      })
    }, frameStepMs)
    return () => window.clearTimeout(timer)
  }, [timelinePlaying, timeline.frame, frameStepMs, slide.id, frameCount])

  const toggleSection = (section: StoryEditSection) => {
    setDirectSlideEditor(false)
    setEditSection((current) => (current === section ? null : section))
  }

  useEffect(() => {
    if (!storyMenuOpen) return
    const onPointerDown = (event: PointerEvent) => {
      const menu = document.getElementById('story-title-menu')
      if (storyMenuRef.current?.contains(event.target as Node) || menu?.contains(event.target as Node)) return
      setStoryMenuOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setStoryMenuOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [storyMenuOpen])

  const toggleStoryMenu = () => {
    const rect = storyMenuRef.current?.getBoundingClientRect()
    if (!rect) return
    if (storyMenuOpen) {
      setStoryMenuOpen(false)
      return
    }
    const width = 200
    setStoryMenuPos({
      top: rect.bottom + 6,
      left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
    })
    setSlideMenuOpen(false)
    setStoryMenuOpen(true)
  }

  useEffect(() => {
    if (!slideMenuOpen) return
    const onPointerDown = (event: PointerEvent) => {
      const menu = document.getElementById('slide-title-menu')
      if (slideMenuRef.current?.contains(event.target as Node) || menu?.contains(event.target as Node)) return
      setSlideMenuOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSlideMenuOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [slideMenuOpen])

  const toggleSlideMenu = () => {
    const rect = slideMenuRef.current?.getBoundingClientRect()
    if (!rect) return
    if (slideMenuOpen) {
      setSlideMenuOpen(false)
      return
    }
    const width = 200
    setSlideMenuPos({
      top: rect.bottom + 6,
      left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
    })
    setStoryMenuOpen(false)
    setSlideMenuOpen(true)
  }

  const duplicateActiveSlide = () => {
    const id = `${story.id}-slide-${Date.now()}`
    const nextSlide = {
      ...copySlide(slide),
      id,
      chapterId: slide.chapterId,
      title: `${slide.title} copy`,
    }
    const sourceFilters = filtersBySlide[slide.id] ?? filters
    setSlides((items) => [...items, nextSlide])
    setFiltersBySlide((current) => ({
      ...current,
      [id]: sourceFilters.map((filter) => ({ ...filter })),
    }))
    setTimelineBySlide((current) =>
      current[slide.id] ? { ...current, [id]: { ...current[slide.id] } } : current,
    )
    setSlideIndex(slides.length)
    setSlideMenuOpen(false)
  }

  const deleteActiveSlide = () => {
    if (slides.length === 1) return
    const deletedIndex = activeSlideIndex
    setSlides((items) => items.filter((item) => item.id !== slide.id))
    setFiltersBySlide((current) => {
      const next = { ...current }
      delete next[slide.id]
      return next
    })
    setTimelineBySlide((current) => {
      const next = { ...current }
      delete next[slide.id]
      return next
    })
    setSlideIndex((currentIndex) => {
      if (currentIndex > deletedIndex) return currentIndex - 1
      return Math.min(currentIndex, slides.length - 2)
    })
    setSlideMenuOpen(false)
    setDirectSlideEditor(false)
    setEditSection(null)
  }

  const deleteStory = () => {
    setStoryMenuOpen(false)
    setEditSection(null)
    onBack()
  }

  useEffect(() => {
    if (!autoplaying || !presentationSettings.autoplay || !presentationSettings.multiSlide) return
    const timer = window.setInterval(
      () => setSlideIndex((index) => (index + 1) % slides.length),
      4000,
    )
    return () => window.clearInterval(timer)
  }, [autoplaying, presentationSettings.autoplay, presentationSettings.multiSlide, slides.length])

  return (
    <div className={styles.root} aria-label={`${story.storyTitle} story`}>
      <StoryMap
        className={styles.map}
        layers={layers}
        sceneIndex={activeSlideIndex}
        framePhase={framePhase}
        frameDuration={timelinePlaying ? frameStepMs : 500}
        frameLinear={timelinePlaying}
        styleUrl={mapStyle.url}
      />

      <div className={styles.overlay}>
        <header className={styles.header} dir={presentationSettings.textDirection}>
          <div className={styles.titleRow}>
            <button type="button" className={styles.backBtn} onClick={onBack} aria-label="Back to home">
              <ArrowLeft size={20} weight="regular" aria-hidden />
            </button>
            <div className={styles.titleGroup}>
              <div className={styles.storyTitleRow}>
                <h1 className={styles.storyTitle}>{storyTitle}</h1>
                {storyMode === 'edit' ? (
                  <button
                    ref={storyMenuRef}
                    type="button"
                    className={`${styles.storyMenuBtn}${storyMenuOpen ? ` ${styles.storyMenuBtnOpen}` : ''}`}
                    aria-label="Story actions"
                    aria-haspopup="menu"
                    aria-expanded={storyMenuOpen}
                    aria-controls="story-title-menu"
                    onClick={toggleStoryMenu}
                  >
                    <DotsThree size={16} weight="bold" aria-hidden />
                  </button>
                ) : null}
              </div>
              <div className={styles.slideTitleRow}>
                <h2 className={styles.slideTitle}>{slide.title}</h2>
                {storyMode === 'edit' ? (
                  <button
                    ref={slideMenuRef}
                    type="button"
                    className={`${styles.slideMenuBtn}${slideMenuOpen ? ` ${styles.slideMenuBtnOpen}` : ''}`}
                    aria-label="Slide actions"
                    aria-haspopup="menu"
                    aria-expanded={slideMenuOpen}
                    aria-controls="slide-title-menu"
                    onClick={toggleSlideMenu}
                  >
                    <DotsThree size={16} weight="bold" aria-hidden />
                  </button>
                ) : (
                  <button
                    type="button"
                    className={styles.infoBtn}
                    aria-label="Show slide description"
                    aria-expanded={infoOpen}
                    aria-describedby={infoOpen ? 'slide-description' : undefined}
                    onClick={() => setInfoOpen((open) => !open)}
                  >
                    <Info size={18} weight="regular" aria-hidden />
                  </button>
                )}
              </div>
              {storyMode === 'view' && infoOpen ? (
                <div id="slide-description" className={styles.infoPopover} role="tooltip">
                  {slide.finding || 'No description added.'}
                </div>
              ) : null}
            </div>
          </div>
          <div className={styles.filters}>
            {filters.map((f) => (
              <span
                key={f.id}
                className={`${styles.filterPill}${storyMode === 'edit' ? ` ${styles.filterPillEditing}` : ''}`}
              >
                {filterIcon(f.id)}
                <span>{f.label}</span>
                {storyMode === 'edit' ? (
                  <button
                    type="button"
                    className={styles.filterRemove}
                    aria-label={`Remove ${f.label}`}
                    onClick={() =>
                      setFiltersBySlide((current) => ({
                        ...current,
                        [slide.id]: (current[slide.id] ?? filters).filter((item) => item.id !== f.id),
                      }))
                    }
                  >
                    <X size={12} weight="bold" aria-hidden />
                  </button>
                ) : null}
              </span>
            ))}
            {storyMode === 'edit' ? (
              <button
                type="button"
                className={`${styles.filterAddBtn}${editSection === 'filters' ? ` ${styles.filterAddBtnActive}` : ''}`}
                aria-pressed={editSection === 'filters'}
                onClick={() => toggleSection('filters')}
              >
                <Plus size={16} weight="bold" aria-hidden />
                Filters
              </button>
            ) : null}
          </div>
          <div className={styles.headerRule} aria-hidden />
        </header>

        <div
          className={`${styles.body}${slide.focusLayout ? ` ${styles.bodyFocus}` : ''}`}
          dir={presentationSettings.textDirection}
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
            <section className={styles.summaryCard}>
              <h2 className={styles.summaryTitle}>Executive Summary</h2>
              <p className={styles.summaryBody}>
                Key Performance Indicators (KPIs) are the critical navigational instruments that
                organizations rely upon to understand whether they are on course to reach their
                strategic objectives or whether adjustments need to be made along the way. At their
                core, KPIs translate complex business operations into quantifiable metrics that
                leaders, managers, and individual contributors can use to assess progress, identify
                trends, and make informed decisions. Without well-defined KPIs, organizations
                operate in a fog — they may have a general sense of direction, but they lack the
                precision needed to steer effectively through competitive markets and rapidly
                changing environments.
              </p>
            </section>

            <section className={styles.visualCard}>
              <EmissionsChart yLabels={insight.emissionsLabels} line={emissionsLine} />
            </section>

            <section className={styles.visualCard}>
              <GroundwaterChart value={insight.groundwaterValue} line={groundwaterLine} />
            </section>

            <section className={styles.visualCard}>
              <BiodiversityChart terrestrial={insight.terrestrial} marine={insight.marine} />
            </section>

            <section className={styles.visualCard}>
              <MonitoringSitesChart
                online={insight.online}
                sites={insight.sites}
                uptime={insight.uptime}
                offlineBars={insight.offlineBars}
              />
            </section>
          </aside>
        </div>

        {editSection ? (
          <StoryEditPanel
            section={editSection}
            storyTitle={storyTitle}
            storyDescription={storyDescription}
            presentationSettings={presentationSettings}
            chapters={chapters}
            slides={slides}
            activeSlideIndex={activeSlideIndex}
            filters={filters}
            onStoryTitleChange={setStoryTitle}
            onStoryDescriptionChange={setStoryDescription}
            onPresentationSettingsChange={(settings) => {
              setPresentationSettings(settings)
              if (!settings.autoplay || !settings.multiSlide) setAutoplaying(false)
            }}
            onSelectSlide={setSlideIndex}
            onSlideChange={(nextSlide) =>
              setSlides((items) =>
                items.map((item) => (item.id === nextSlide.id ? nextSlide : item)),
              )
            }
            onFiltersChange={(nextFilters) =>
              setFiltersBySlide((current) => ({ ...current, [slide.id]: nextFilters }))
            }
            onAddChapter={() => {
              const id = `${story.id}-chapter-${Date.now()}`
              setChapters((items) => [...items, { id, title: `Chapter ${items.length + 1}` }])
            }}
            onRenameChapter={(chapterId, title) => {
              setChapters((items) =>
                items.map((item) => (item.id === chapterId ? { ...item, title } : item)),
              )
            }}
            onDeleteChapter={(chapterId) => {
              if (chapters.length === 1) return
              const remaining = slides.filter((item) => item.chapterId !== chapterId)
              if (remaining.length === 0) return
              const removedIds = new Set(
                slides.filter((item) => item.chapterId === chapterId).map((item) => item.id),
              )
              setChapters((items) => items.filter((item) => item.id !== chapterId))
              setSlides(remaining)
              setFiltersBySlide((current) => {
                const next = { ...current }
                removedIds.forEach((id) => delete next[id])
                return next
              })
              if (removedIds.has(slide.id)) {
                setSlideIndex(0)
              }
            }}
            onAddSlide={(chapterId) => {
              const source = slides[activeSlideIndex] ?? slides[0]
              if (!source) return
              const id = `${story.id}-slide-${Date.now()}`
              const chapterSlides = slides.filter((item) => item.chapterId === chapterId)
              const nextSlide = {
                ...copySlide(source),
                id,
                chapterId,
                title: `Untitled slide ${chapterSlides.length + 1}`,
              }
              setSlides((items) => [...items, nextSlide])
              setFiltersBySlide((current) => ({
                ...current,
                [id]: filters.map((filter) => ({ ...filter })),
              }))
              setSlideIndex(slides.length)
            }}
            onDuplicateSlide={(slideId) => {
              const source = slides.find((item) => item.id === slideId) ?? slide
              if (!source) return
              const id = `${story.id}-slide-${Date.now()}`
              const nextSlide = {
                ...copySlide(source),
                id,
                chapterId: source.chapterId,
                title: `${source.title} copy`,
              }
              const sourceFilters = filtersBySlide[source.id] ?? filters
              setSlides((items) => [...items, nextSlide])
              setFiltersBySlide((current) => ({
                ...current,
                [id]: sourceFilters.map((filter) => ({ ...filter })),
              }))
              setSlideIndex(slides.length)
            }}
            onDeleteSlide={(slideId) => {
              if (slides.length === 1) return
              const deletedIndex = slides.findIndex((item) => item.id === slideId)
              if (deletedIndex === -1) return
              setSlides((items) => items.filter((item) => item.id !== slideId))
              setFiltersBySlide((current) => {
                const next = { ...current }
                delete next[slideId]
                return next
              })
              setSlideIndex((currentIndex) => {
                if (currentIndex > deletedIndex) return currentIndex - 1
                if (currentIndex === deletedIndex) {
                  return Math.min(currentIndex, slides.length - 2)
                }
                return currentIndex
              })
            }}
            onDeleteSlides={() => {
              setEditSection(null)
              onBack()
            }}
            directSlideEditor={directSlideEditor}
            onClose={() => {
              setDirectSlideEditor(false)
              setEditSection(null)
            }}
            mapStyleId={mapStyle.id}
            onMapStyleChange={setMapStyle}
          />
        ) : null}

        <div className={styles.mapStack}>
          <StoryTimeSeries
            range={timelineRange}
            granularity={timelineGranularity}
            frameCount={frameCount}
            frame={timeline.frame}
            playing={timelinePlaying}
            speed={playbackSpeed}
            stepMs={frameStepMs}
            onFrameChange={(frame) => updateTimeline(slide.id, (current) => ({ ...current, frame }))}
            onPlayingChange={setTimelinePlaying}
            onSpeedChange={setPlaybackSpeed}
            onGranularityChange={(granularityId) =>
              updateTimeline(slide.id, (current) => withGranularity(current, granularityId))
            }
            onRangeChange={(rangeId) => updateTimeline(slide.id, (current) => withRange(current, rangeId))}
          />
          <div className={styles.mapData}>
            <button
              type="button"
              className={styles.mapDataHeader}
              onClick={() => setLegendOpen((o) => !o)}
              aria-expanded={legendOpen}
            >
              <span>Map Data</span>
              <CaretDown
                size={18}
                weight="regular"
                className={legendOpen ? undefined : styles.caretClosed}
                aria-hidden
              />
            </button>
            {legendOpen ? (
              <div className={styles.mapDataBody}>
                <div className={styles.legendGroup}>
                  <div className={styles.legendHead}>
                    <p className={styles.legendSection}>Abu Dhabi Monitored Junctions</p>
                    <span className={styles.legendActions}>
                      <button type="button" className={styles.legendIconBtn} aria-label="Junction style">
                        <PaintBucket size={16} weight="regular" aria-hidden />
                      </button>
                      <button
                        type="button"
                        className={`${styles.legendIconBtn}${layers.junctions ? '' : ` ${styles.legendIconOff}`}`}
                        aria-label="Toggle monitored junctions"
                        aria-pressed={layers.junctions}
                        onClick={() => setLayers((current) => ({ ...current, junctions: !current.junctions }))}
                      >
                        {layers.junctions ? (
                          <Eye size={16} weight="regular" aria-hidden />
                        ) : (
                          <EyeSlash size={16} weight="regular" aria-hidden />
                        )}
                      </button>
                    </span>
                  </div>
                  <div className={styles.legendRow}>
                    <span className={styles.legendMark}>
                      <i
                        className={styles.diskOther}
                        style={{
                          borderColor: scene.legend.diskRing,
                          backgroundColor: `${scene.legend.diskRing}1f`,
                        }}
                      />
                      Other
                    </span>
                    <span className={styles.legendCount}>
                      <AnimatedNumber value={scene.legend.junctionCount} format={formatCount} />
                    </span>
                  </div>
                  <div className={styles.legendScale}>
                    <span>Low</span>
                    <span
                      className={styles.diskScale}
                      style={{ '--disk-scale': scene.legend.diskScale } as CSSProperties}
                      aria-hidden
                    >
                      <i />
                      <i />
                      <i />
                    </span>
                    <span>High</span>
                  </div>
                </div>
                <div className={styles.legendGroup}>
                  <div className={styles.legendHead}>
                    <p className={styles.legendSection}>Abu Dhabi Value Distribution</p>
                    <span className={styles.legendActions}>
                      <button type="button" className={styles.legendIconBtn} aria-label="Distribution style">
                        <PaintBucket size={16} weight="regular" aria-hidden />
                      </button>
                      <button
                        type="button"
                        className={`${styles.legendIconBtn}${layers.distribution ? '' : ` ${styles.legendIconOff}`}`}
                        aria-label="Toggle value distribution"
                        aria-pressed={layers.distribution}
                        onClick={() =>
                          setLayers((current) => ({ ...current, distribution: !current.distribution }))
                        }
                      >
                        {layers.distribution ? (
                          <Eye size={16} weight="regular" aria-hidden />
                        ) : (
                          <EyeSlash size={16} weight="regular" aria-hidden />
                        )}
                      </button>
                    </span>
                  </div>
                  <div className={styles.legendScale}>
                    <span>Low</span>
                    <span className={styles.columnScale} aria-hidden>
                      <ColumnGlyph height={16} colors={scene.legend.glyphs[0]} />
                      <ColumnGlyph height={24} colors={scene.legend.glyphs[1]} />
                      <ColumnGlyph height={34} colors={scene.legend.glyphs[2]} />
                    </span>
                    <span>High</span>
                  </div>
                </div>
                {storyMode === 'edit' ? (
                  <button
                    type="button"
                    className={`${styles.addMapLayerBtn}${editSection === 'layers' ? ` ${styles.addMapLayerBtnActive}` : ''}`}
                    aria-pressed={editSection === 'layers'}
                    onClick={() => toggleSection('layers')}
                  >
                    <Plus size={16} weight="bold" aria-hidden />
                    Map layer
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
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

          {presentationSettings.multiSlide ? (
            <div className={styles.navCluster}>
              {presentationSettings.autoplay ? (
                <button
                  type="button"
                  className={styles.navArrow}
                  aria-label={autoplaying ? 'Pause autoplay' : 'Start autoplay'}
                  aria-pressed={autoplaying}
                  onClick={() => setAutoplaying((playing) => !playing)}
                >
                  {autoplaying ? (
                    <Pause size={18} weight="fill" aria-hidden />
                  ) : (
                    <Play size={18} weight="fill" aria-hidden />
                  )}
                </button>
              ) : null}
              <button
                type="button"
                className={styles.navArrow}
                aria-label="Previous slide"
                disabled={!canPrev}
                onClick={() => canPrev && setSlideIndex((i) => i - 1)}
              >
                <ArrowLeft size={20} weight="regular" aria-hidden />
              </button>
              <button
                type="button"
                className={`${styles.navCount}${slidesConfigOpen ? ` ${styles.navCountActive}` : ''}`}
                aria-label={`Slide ${activeSlideIndex + 1} of ${slides.length}, open slides configuration`}
                aria-haspopup="dialog"
                aria-expanded={slidesConfigOpen}
                onClick={() => {
                  setDirectSlideEditor(false)
                  setEditSection(slidesConfigOpen ? null : 'slide')
                }}
              >
                <List size={16} weight="regular" aria-hidden />
                {activeSlideIndex + 1}/{slides.length}
              </button>
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
          ) : null}

          <div
            className={`${styles.modeSwitch}${storyMode === 'edit' ? ` ${styles.modeSwitchEdit}` : ''}`}
            role="group"
            aria-label="Story mode"
          >
            <div className={styles.modeActions} aria-hidden={storyMode !== 'edit'} inert={storyMode !== 'edit'}>
              <div className={styles.modeActionsClip}>
                <div className={styles.modeActionsInner}>
                  <button
                    type="button"
                    className={`${styles.modeAction}${editSection === 'assets' ? ` ${styles.modeActionActive}` : ''}`}
                    onClick={() => toggleSection('assets')}
                  >
                    <Plus size={18} weight="bold" aria-hidden />
                    Assets
                  </button>
                  <button
                    type="button"
                    className={`${styles.modeAction}${editSection === 'tools' ? ` ${styles.modeActionActive}` : ''}`}
                    onClick={() => toggleSection('tools')}
                  >
                    <Plus size={18} weight="bold" aria-hidden />
                    Tools
                  </button>
                  <button
                    type="button"
                    className={`${styles.modeAction}${editSection === 'map' ? ` ${styles.modeActionActive}` : ''}`}
                    onClick={() => toggleSection('map')}
                  >
                    <MapTrifold size={18} weight="regular" aria-hidden />
                    Background
                  </button>
                  <span className={styles.modeDivider} aria-hidden />
                </div>
              </div>
            </div>
            <button
              type="button"
              className={`${styles.modeBtn}${storyMode === 'edit' ? ` ${styles.modeBtnActive}` : ''}`}
              aria-label="Edit mode"
              aria-pressed={storyMode === 'edit'}
              onClick={() => {
                setStoryMode('edit')
                setInfoOpen(false)
              }}
            >
              <PencilSimple size={20} weight="regular" aria-hidden />
            </button>
            <button
              type="button"
              className={`${styles.modeBtn}${storyMode === 'view' ? ` ${styles.modeBtnActive}` : ''}`}
              aria-label="View mode"
              aria-pressed={storyMode === 'view'}
              onClick={() => {
                setStoryMode('view')
                setDirectSlideEditor(false)
                setEditSection(null)
                setStoryMenuOpen(false)
                setSlideMenuOpen(false)
                setInfoOpen(false)
              }}
            >
              <Eye size={20} weight="regular" aria-hidden />
            </button>
          </div>
        </div>
      </div>
    {slideMenuOpen
      ? createPortal(
          <div
            id="slide-title-menu"
            className={styles.storyMenu}
            role="menu"
            aria-label="Slide actions"
            style={{ top: slideMenuPos.top, left: slideMenuPos.left }}
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setDirectSlideEditor(true)
                setEditSection('slide')
                setSlideMenuOpen(false)
              }}
            >
              <GearSix size={16} weight="regular" aria-hidden />
              Configure
            </button>
            <button type="button" role="menuitem" onClick={duplicateActiveSlide}>
              <Copy size={16} weight="regular" aria-hidden />
              Duplicate slide
            </button>
            <button
              type="button"
              role="menuitem"
              className={styles.storyMenuDanger}
              disabled={slides.length === 1}
              onClick={deleteActiveSlide}
            >
              <Trash size={16} weight="regular" aria-hidden />
              Delete slide
            </button>
          </div>,
          document.body,
        )
      : null}
    {storyMenuOpen
      ? createPortal(
          <div
            id="story-title-menu"
            className={styles.storyMenu}
            role="menu"
            aria-label="Story actions"
            style={{ top: storyMenuPos.top, left: storyMenuPos.left }}
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setDirectSlideEditor(false)
                setEditSection('story')
                setStoryMenuOpen(false)
              }}
            >
              <GearSix size={16} weight="regular" aria-hidden />
              Configure
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setStoryMenuOpen(false)
                setShareOpen(true)
              }}
            >
              <Export size={16} weight="regular" aria-hidden />
              Share story
            </button>
            <button type="button" role="menuitem" className={styles.storyMenuDanger} onClick={deleteStory}>
              <Trash size={16} weight="regular" aria-hidden />
              Delete story
            </button>
          </div>,
          document.body,
        )
      : null}
      <ShareModal
        open={shareOpen}
        title={`Share “${storyTitle}”`}
        onClose={() => setShareOpen(false)}
      />
    </div>
  )
}

function ColumnGlyph({ height, colors }: { height: number; colors: ColumnGlyphColors }) {
  const [front, side, top] = colors
  const w = 8
  const d = 4
  return (
    <svg
      className={styles.columnGlyph}
      width={w + d}
      height={height + d}
      viewBox={`0 0 ${w + d} ${height + d}`}
      aria-hidden
    >
      <polygon points={`0,${d} ${d},0 ${w + d},0 ${w},${d}`} style={{ fill: top }} />
      <rect x="0" y={d} width={w} height={height} style={{ fill: front }} />
      <polygon
        points={`${w},${d} ${w + d},0 ${w + d},${height} ${w},${height + d}`}
        style={{ fill: side }}
      />
    </svg>
  )
}
