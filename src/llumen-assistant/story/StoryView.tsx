/**
 * Landing Story content type — Figma slide-landing-screen-map (3359:3802).
 * Full-page main content (not agent subcontext). Map from llumen-map-legend layers.
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Buildings,
  CalendarBlank,
  CaretDown,
  Eye,
  EyeSlash,
  GenderIntersex,
  GridFour,
  Info,
  MapPin,
  MapTrifold,
  PaintBucket,
  Pause,
  PencilSimple,
  Play,
  Plus,
  Slideshow,
  Student,
  SquaresFour,
  Wrench,
} from '@phosphor-icons/react'
import { llumenAssets } from '../assets'
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
import { storySceneAt, type ColumnGlyphColors } from './storyDemoScenes'
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
  const [editMenuOpen, setEditMenuOpen] = useState(false)
  const [editSection, setEditSection] = useState<StoryEditSection | null>(null)
  const [storyMode, setStoryMode] = useState<'edit' | 'view'>('edit')
  const [setupMenuOpen, setSetupMenuOpen] = useState(false)
  const [setupMenuPos, setSetupMenuPos] = useState({ top: 0, left: 0 })
  const setupSlotRef = useRef<HTMLDivElement>(null)
  const [infoOpen, setInfoOpen] = useState(false)
  const [layers, setLayers] = useState<StoryMapLayerVisibility>({
    junctions: true,
    distribution: true,
  })
  const [mapStyle, setMapStyle] = useState({ id: 'aimsun-teal', url: STORY_MAP_STYLE })

  const activeSlideIndex = Math.min(slideIndex, slides.length - 1)
  const slide = slides[activeSlideIndex]
  const filters = filtersBySlide[slide.id] ?? story.filters
  const scene = storySceneAt(activeSlideIndex)
  const insight = scene.insight
  const emissionsLine = useMemo(
    () => warpPath(EMISSIONS_LINE, insight.emissionsWarp),
    [insight.emissionsWarp],
  )
  const groundwaterLine = useMemo(
    () => warpPath(GROUNDWATER_LINE, insight.groundwaterWarp),
    [insight.groundwaterWarp],
  )
  const bioTotal = insight.terrestrial + insight.marine
  const terrestrialPct = Math.round((insight.terrestrial / bioTotal) * 100)
  const offlineBars = new Set(insight.offlineBars)
  const previewStory: LandingStory = {
    ...story,
    storyTitle,
    description: storyDescription,
    filters,
    chapters,
    slides,
  }
  const canPrev = activeSlideIndex > 0
  const canNext = activeSlideIndex < slides.length - 1

  useEffect(() => {
    if (!setupMenuOpen) return
    const onPointerDown = (event: PointerEvent) => {
      const menu = document.getElementById('story-setup-menu')
      if (setupSlotRef.current?.contains(event.target as Node) || menu?.contains(event.target as Node)) return
      setSetupMenuOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSetupMenuOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [setupMenuOpen])

  const chooseSetup = (section: StoryEditSection) => {
    setEditSection(section)
    setSetupMenuOpen(false)
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
        styleUrl={mapStyle.url}
      />

      <div className={styles.overlay}>
        <header className={styles.header} dir={presentationSettings.textDirection}>
          <div className={styles.titleRow}>
            <button type="button" className={styles.backBtn} onClick={onBack} aria-label="Back to home">
              <ArrowLeft size={20} weight="regular" aria-hidden />
            </button>
            <div className={styles.titleGroup}>
              <h1 className={styles.storyTitle}>{storyTitle}</h1>
              <div className={styles.slideTitleRow}>
                <h2 className={styles.slideTitle}>{slide.title}</h2>
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
              </div>
              {infoOpen ? (
                <div id="slide-description" className={styles.infoPopover} role="tooltip">
                  {slide.finding || 'No description added.'}
                </div>
              ) : null}
            </div>
            {storyMode === 'edit' ? (
            <div className={styles.editCluster} dir="ltr">
              <div
                id="story-edit-tools"
                className={`${styles.editTools}${editMenuOpen ? ` ${styles.editToolsOpen}` : ''}`}
                role="tablist"
                aria-label="Edit story"
                aria-hidden={!editMenuOpen}
                inert={!editMenuOpen}
              >
                <div className={styles.editToolsClip}>
                  <div className={styles.editToolsInner}>
                  {(
                    [
                      { id: 'story', label: 'Story Config', icon: BookOpen },
                      { id: 'slide', label: 'Slides Config', icon: Slideshow },
                      { id: 'assets', label: 'Assets & Filters', icon: GridFour },
                      { id: 'map', label: 'Map', icon: MapTrifold },
                      { id: 'tools', label: 'Tools', icon: Wrench },
                    ] as const
                  ).map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      type="button"
                      role="tab"
                      className={`${styles.editTool}${editSection === id ? ` ${styles.editToolActive}` : ''}`}
                      aria-selected={editSection === id}
                      aria-controls="story-edit-modal"
                      onClick={() => setEditSection((current) => (current === id ? null : id))}
                    >
                      <Icon size={16} weight="regular" aria-hidden />
                      {label}
                    </button>
                  ))}
                  </div>
                </div>
              </div>
              <button
                type="button"
                className={`${styles.editBtn}${editMenuOpen ? ` ${styles.editBtnActive}` : ''}`}
                aria-label="Edit"
                aria-expanded={editMenuOpen}
                aria-controls="story-edit-tools"
                onClick={() => {
                  if (editMenuOpen) {
                    setEditMenuOpen(false)
                    setEditSection(null)
                    return
                  }
                  setEditMenuOpen(true)
                }}
              >
                <PencilSimple size={16} weight="regular" aria-hidden />
              </button>
            </div>
            ) : null}
          </div>
          <div className={styles.filters}>
            {filters.map((f) => (
              <span key={f.id} className={styles.filterPill}>
                {filterIcon(f.id)}
                <span>{f.label}</span>
              </span>
            ))}
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
              <h2 className={styles.visualTitle}>Emissions trajectory vs Net-Zero pathway</h2>
              <div className={styles.chartLegend}>
                <span>
                  <i className={styles.swatchProjected} />
                  Projected
                </span>
                <span>
                  <i className={styles.swatchPlanned} />
                  Planned
                </span>
              </div>
              <TrendChart
                yLabels={insight.emissionsLabels}
                xLabels={['2030', '2035', '2040', '2045', '2050']}
                line={emissionsLine}
                lineColor="#7dcea0"
                gradientId="emissions-area"
                dashed
              />
            </section>

            <section className={styles.visualCard}>
              <h2 className={styles.visualTitle}>Average Groundwater Level Change (m/year)</h2>
              <p className={styles.visualValue}>
                <strong>
                  <AnimatedNumber value={insight.groundwaterValue} format={formatSigned} />
                </strong>
                <span>m/year</span>
              </p>
              <TrendChart
                yLabels={['+0.5', '0', '-0.50']}
                xLabels={['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']}
                line={groundwaterLine}
                lineColor="#ee7b93"
                gradientId="groundwater-area"
              />
            </section>

            <section className={styles.visualCard}>
              <h2 className={styles.visualTitle}>Biodiversity Activity Events</h2>
              <p className={styles.visualValue}>
                <strong>
                  <AnimatedNumber value={bioTotal} format={formatCount} />
                </strong>
                <span>Triggers</span>
              </p>
              <div className={styles.splitBar} aria-hidden>
                <span className={styles.splitTerrestrial} style={{ flexGrow: insight.terrestrial }} />
                <span className={styles.splitMarine} style={{ flexGrow: insight.marine }} />
              </div>
              <div className={styles.seriesRow}>
                <span>
                  <i className={styles.swatchTerrestrial} />
                  Terrestrial Cameras
                </span>
                <b>
                  <AnimatedNumber value={insight.terrestrial} format={formatCount} /> (
                  <AnimatedNumber value={terrestrialPct} format={formatCount} />
                  %)
                </b>
              </div>
              <div className={styles.seriesRow}>
                <span>
                  <i className={styles.swatchMarine} />
                  Marine Sensors
                </span>
                <b>
                  <AnimatedNumber value={insight.marine} format={formatCount} /> (
                  <AnimatedNumber value={100 - terrestrialPct} format={formatCount} />
                  %)
                </b>
              </div>
            </section>

            <section className={styles.visualCard}>
              <h2 className={styles.visualTitle}>Active Monitoring Sites</h2>
              <p className={styles.visualValue}>
                <strong>
                  <AnimatedNumber value={insight.online} format={formatCount} />
                </strong>
                <span>/{insight.sites} Online</span>
              </p>
              <span className={styles.uptimeChip}>
                <AnimatedNumber value={insight.uptime} format={formatCount} />% Uptime
              </span>
              <div className={styles.siteBars} aria-hidden>
                {Array.from({ length: 47 }, (_, index) => (
                  <span key={index} className={offlineBars.has(index) ? styles.siteOff : styles.siteOn} />
                ))}
              </div>
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
              setEditMenuOpen(false)
              setEditSection(null)
              onBack()
            }}
            onClose={() => setEditSection(null)}
            mapStyleId={mapStyle.id}
            onMapStyleChange={setMapStyle}
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
                    onClick={() => setEditSection((current) => (current === 'assets' ? null : 'assets'))}
                  >
                    <Plus size={18} weight="bold" aria-hidden />
                    Add
                  </button>
                  <div className={styles.setupSlot} ref={setupSlotRef}>
                    <button
                      type="button"
                      className={`${styles.modeAction}${
                        setupMenuOpen || editSection === 'story' || editSection === 'slide' || editSection === 'map'
                          ? ` ${styles.modeActionActive}`
                          : ''
                      }`}
                      aria-haspopup="menu"
                      aria-expanded={setupMenuOpen}
                      aria-controls="story-setup-menu"
                      onClick={() => {
                        const rect = setupSlotRef.current?.getBoundingClientRect()
                        if (rect) setSetupMenuPos({ top: rect.top, left: rect.left })
                        setSetupMenuOpen((open) => !open)
                      }}
                    >
                      <SquaresFour size={18} weight="regular" aria-hidden />
                      Setup
                    </button>
                  </div>
                  <span className={styles.modeDivider} aria-hidden />
                </div>
              </div>
            </div>
            <button
              type="button"
              className={`${styles.modeBtn}${storyMode === 'edit' ? ` ${styles.modeBtnActive}` : ''}`}
              aria-label="Edit mode"
              aria-pressed={storyMode === 'edit'}
              onClick={() => setStoryMode('edit')}
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
                setEditMenuOpen(false)
                setEditSection(null)
                setSetupMenuOpen(false)
              }}
            >
              <Eye size={20} weight="regular" aria-hidden />
            </button>
          </div>
        </div>
      </div>
    {setupMenuOpen
      ? createPortal(
          <div
            id="story-setup-menu"
            className={styles.setupMenu}
            role="menu"
            aria-label="Setup"
            style={{ top: setupMenuPos.top, left: setupMenuPos.left }}
          >
            {(
              [
                { id: 'story', label: 'Story Configuration', icon: BookOpen },
                { id: 'slide', label: 'Slide configuration', icon: Slideshow },
                { id: 'map', label: 'Basemap', icon: MapTrifold },
              ] as const
            ).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                role="menuitem"
                className={editSection === id ? styles.setupMenuActive : undefined}
                onClick={() => chooseSetup(id)}
              >
                <Icon size={16} weight="regular" aria-hidden />
                {label}
              </button>
            ))}
          </div>,
          document.body,
        )
      : null}
    </div>
  )
}

const EMISSIONS_LINE =
  'M0.00 9.00 C0.42 7.67 1.67 2.50 2.50 1.00 C3.33 0.00 4.17 0.00 5.00 0.00 C5.83 0.33 6.67 1.50 7.50 3.00 C8.33 4.50 9.17 7.00 10.00 9.00 C10.83 11.00 11.67 13.50 12.50 15.00 C13.33 16.50 14.17 17.00 15.00 18.00 C15.83 19.00 16.67 20.17 17.50 21.00 C18.33 21.83 19.17 22.33 20.00 23.00 C20.83 23.67 21.67 24.50 22.50 25.00 C23.33 25.50 24.17 25.67 25.00 26.00 C25.83 26.33 26.67 26.83 27.50 27.00 C28.33 27.17 29.17 26.83 30.00 27.00 C30.83 27.17 31.67 27.67 32.50 28.00 C33.33 28.33 34.17 28.67 35.00 29.00 C35.83 29.33 36.67 29.50 37.50 30.00 C38.33 30.50 39.17 31.17 40.00 32.00 C40.83 32.83 41.67 34.00 42.50 35.00 C43.33 36.00 44.17 36.83 45.00 38.00 C45.83 39.17 46.67 40.17 47.50 42.00 C48.33 43.83 49.17 46.67 50.00 49.00 C50.83 51.33 51.67 53.83 52.50 56.00 C53.33 58.17 54.17 60.50 55.00 62.00 C55.83 63.50 56.67 64.50 57.50 65.00 C58.33 65.50 59.17 65.00 60.00 65.00 C60.83 65.00 61.67 65.17 62.50 65.00 C63.33 64.83 64.17 64.00 65.00 64.00 C65.83 64.00 66.67 64.50 67.50 65.00 C68.33 65.50 69.17 66.50 70.00 67.00 C70.83 67.50 71.67 67.50 72.50 68.00 C73.33 68.50 74.17 69.50 75.00 70.00 C75.83 70.50 76.67 70.50 77.50 71.00 C78.33 71.50 79.17 72.33 80.00 73.00 C80.83 73.67 81.67 74.33 82.50 75.00 C83.33 75.67 84.17 76.50 85.00 77.00 C85.83 77.50 86.67 77.83 87.50 78.00 C88.33 78.17 89.17 78.00 90.00 78.00 C90.83 78.00 91.67 78.00 92.50 78.00 C93.33 78.00 94.17 77.83 95.00 78.00 C95.83 78.17 96.67 78.17 97.50 79.00 C98.33 79.83 99.58 82.33 100.00 83.00'
const GROUNDWATER_LINE =
  'M0.00 8.57 C0.34 8.10 1.36 5.95 2.04 5.71 C2.72 5.48 3.40 6.67 4.08 7.14 C4.76 7.62 5.44 7.38 6.12 8.57 C6.80 9.76 7.48 11.67 8.16 14.29 C8.84 16.90 9.52 20.24 10.20 24.29 C10.88 28.33 11.56 35.00 12.24 38.57 C12.93 42.14 13.61 43.57 14.29 45.71 C14.97 47.86 15.65 49.52 16.33 51.43 C17.01 53.33 17.69 55.48 18.37 57.14 C19.05 58.81 19.73 60.48 20.41 61.43 C21.09 62.38 21.77 62.38 22.45 62.86 C23.13 63.33 23.81 64.29 24.49 64.29 C25.17 64.29 25.85 63.57 26.53 62.86 C27.21 62.14 27.89 61.19 28.57 60.00 C29.25 58.81 29.93 57.14 30.61 55.71 C31.29 54.29 31.97 52.86 32.65 51.43 C33.33 50.00 34.01 48.57 34.69 47.14 C35.37 45.71 36.05 44.05 36.73 42.86 C37.41 41.67 38.10 40.71 38.78 40.00 C39.46 39.29 40.14 38.33 40.82 38.57 C41.50 38.81 42.18 40.00 42.86 41.43 C43.54 42.86 44.22 45.71 44.90 47.14 C45.58 48.57 46.26 49.52 46.94 50.00 C47.62 50.48 48.30 50.24 48.98 50.00 C49.66 49.76 50.34 49.05 51.02 48.57 C51.70 48.10 52.38 47.86 53.06 47.14 C53.74 46.43 54.42 45.24 55.10 44.29 C55.78 43.33 56.46 42.14 57.14 41.43 C57.82 40.71 58.50 40.48 59.18 40.00 C59.86 39.52 60.54 38.81 61.22 38.57 C61.90 38.33 62.59 38.33 63.27 38.57 C63.95 38.81 64.63 39.52 65.31 40.00 C65.99 40.48 66.67 40.71 67.35 41.43 C68.03 42.14 68.71 43.57 69.39 44.29 C70.07 45.00 70.75 45.24 71.43 45.71 C72.11 46.19 72.79 46.67 73.47 47.14 C74.15 47.62 74.83 48.10 75.51 48.57 C76.19 49.05 76.87 49.05 77.55 50.00 C78.23 50.95 78.91 52.62 79.59 54.29 C80.27 55.95 80.95 58.33 81.63 60.00 C82.31 61.67 82.99 62.62 83.67 64.29 C84.35 65.95 85.03 68.57 85.71 70.00 C86.39 71.43 87.07 71.67 87.76 72.86 C88.44 74.05 89.12 75.95 89.80 77.14 C90.48 78.33 91.16 79.29 91.84 80.00 C92.52 80.71 93.20 81.19 93.88 81.43 C94.56 81.67 95.24 81.43 95.92 81.43 C96.60 81.43 97.28 81.43 97.96 81.43 C98.64 81.43 99.66 81.43 100.00 81.43'

/** Remaps every y of an absolute M/C path; the command structure stays intact so `d` can morph. */
function warpPath(path: string, warp: (x: number, y: number) => number) {
  let index = 0
  let x = 0
  return path.replace(/-?\d+(?:\.\d+)?/g, (token) => {
    const value = Number(token)
    const out = index % 2 === 0 ? (x = value) : warp(x, value)
    index += 1
    return out.toFixed(2)
  })
}

const formatCount = (value: number) => Math.round(value).toLocaleString('en-US')

function formatSigned(value: number) {
  const rounded = Math.round(value * 100) / 100
  if (rounded === 0) return '0.00'
  return `${rounded > 0 ? '+' : '-'}${Math.abs(rounded).toFixed(2)}`
}

function useTweenedNumber(value: number, durationMs = 900) {
  const [display, setDisplay] = useState(value)
  const displayRef = useRef(value)

  useEffect(() => {
    const from = displayRef.current
    if (from === value) return
    const start = performance.now()
    let frame = 0
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs)
      const next = from + (value - from) * (1 - (1 - t) ** 3)
      displayRef.current = next
      setDisplay(next)
      if (t < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [value, durationMs])

  return display
}

function AnimatedNumber({ value, format }: { value: number; format: (value: number) => string }) {
  return <>{format(useTweenedNumber(value))}</>
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

function TrendChart({
  yLabels,
  xLabels,
  line,
  lineColor,
  gradientId,
  dashed = false,
}: {
  yLabels: string[]
  xLabels: string[]
  line: string
  lineColor: string
  gradientId: string
  dashed?: boolean
}) {
  const ticks = yLabels.map((_, index) =>
    yLabels.length === 1 ? 0 : (index / (yLabels.length - 1)) * 100,
  )
  const area = `${line} L100 100 L0 100 Z`

  return (
    <div className={styles.chart}>
      <div className={styles.chartMain}>
        <div className={styles.yAxis}>
          {yLabels.map((label, index) => (
            <span key={label} style={{ top: `${ticks[index]}%` }}>
              {label}
            </span>
          ))}
        </div>
        <svg className={styles.chartSvg} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={lineColor} stopOpacity="0.42" />
              <stop offset="100%" stopColor={lineColor} stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {ticks.map((y) => (
            <line
              key={y}
              x1="0"
              y1={y}
              x2="100"
              y2={y}
              stroke="rgba(255,255,255,0.16)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          <path
            className={styles.chartPath}
            d={area}
            style={{ d: `path('${area}')` } as CSSProperties}
            fill={`url(#${gradientId})`}
          />
          {dashed ? (
            <line
              x1="0"
              y1="0"
              x2="100"
              y2="100"
              stroke="rgba(255,255,255,0.72)"
              strokeWidth="1.25"
              strokeDasharray="3.5 3"
              vectorEffect="non-scaling-stroke"
            />
          ) : null}
          <path
            className={styles.chartPath}
            d={line}
            style={{ d: `path('${line}')` } as CSSProperties}
            fill="none"
            stroke={lineColor}
            strokeWidth="1.75"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>
      <div className={styles.chartX}>
        {xLabels.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
    </div>
  )
}
