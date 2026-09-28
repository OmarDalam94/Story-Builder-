import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowLeft,
  ArrowsOut,
  CaretDown,
  ChartLine,
  Copy,
  DotsThreeVertical,
  FunnelSimple,
  MagnifyingGlass,
  MapPin,
  PencilSimple,
  Plus,
  ShareNetwork,
  SquaresFour,
  CalendarBlank,
  Trash,
  X,
} from '@phosphor-icons/react'
import { landingAssets, storyThumbLayers } from '../landing/landingAssets'
import type { StoryChapter, StoryFilter, StorySlide } from './storyDemoData'
import styles from './StoryEditPanel.module.css'

const SLIDE_THUMB_VARIANTS = ['map', 'chart', 'satellite'] as const

export type StoryEditSection = 'story' | 'slide' | 'assets' | 'map' | 'tools'

export type StoryEditPanelProps = {
  storyTitle: string
  storyDescription: string
  presentationSettings: StoryPresentationSettings
  chapters: StoryChapter[]
  slides: StorySlide[]
  activeSlideIndex: number
  filters: StoryFilter[]
  onStoryTitleChange: (value: string) => void
  onStoryDescriptionChange: (value: string) => void
  onPresentationSettingsChange: (settings: StoryPresentationSettings) => void
  onSelectSlide: (index: number) => void
  onSlideChange: (slide: StorySlide) => void
  onFiltersChange: (filters: StoryFilter[]) => void
  onAddChapter: () => void
  onRenameChapter: (chapterId: string, title: string) => void
  onDeleteChapter: (chapterId: string) => void
  onAddSlide: (chapterId: string) => void
  onDuplicateSlide: (slideId?: string) => void
  onDeleteSlide: (slideId: string) => void
  onDeleteSlides: () => void
  onClose: () => void
  section: StoryEditSection
}

export type StoryPresentationSettings = {
  darkLogoName: string
  lightLogoName: string
  textDirection: 'ltr' | 'rtl'
  chapterSplash: boolean
  autoplay: boolean
  multiSlide: boolean
}

export function StoryEditPanel({
  storyTitle,
  storyDescription,
  presentationSettings,
  chapters,
  slides,
  activeSlideIndex,
  filters,
  onStoryTitleChange,
  onStoryDescriptionChange,
  onPresentationSettingsChange,
  onSelectSlide,
  onSlideChange,
  onFiltersChange,
  onAddChapter,
  onRenameChapter,
  onDeleteChapter,
  onAddSlide,
  onDuplicateSlide,
  onDeleteSlide,
  onDeleteSlides,
  onClose,
  section,
}: StoryEditPanelProps) {
  const [isEditingSlide, setIsEditingSlide] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [assetsExpanded, setAssetsExpanded] = useState(false)
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 })
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    setIsEditingSlide(false)
    setMenuOpen(false)
    setAssetsExpanded(false)
  }, [section])

  const slide = slides[activeSlideIndex]
  const slideChapter = chapters.find((chapter) => chapter.id === slide?.chapterId)
  const chapterSlides = slides.filter((item) => item.chapterId === slide?.chapterId)
  const slideNumber = chapterSlides.findIndex((item) => item.id === slide?.id) + 1
  const slideHeading = `${slideChapter?.title ?? 'Chapter'} / Slide ${Math.max(slideNumber, 1)}`
  const modalTitle =
    section === 'story'
      ? 'Story Configuration'
      : section === 'assets'
        ? 'Assets & Filters'
        : section === 'map'
          ? 'Map'
          : section === 'tools'
          ? 'Tools'
          : isEditingSlide
            ? slideHeading
            : 'Slides Configuration'

  const syncMenuPosition = useCallback(() => {
    const button = menuButtonRef.current
    if (!button) return
    const rect = button.getBoundingClientRect()
    setMenuPosition({
      top: rect.bottom + 8,
      left: Math.min(rect.left, window.innerWidth - 210),
    })
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (menuOpen) {
        setMenuOpen(false)
        return
      }
      if (isEditingSlide) {
        setIsEditingSlide(false)
        return
      }
      onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isEditingSlide, menuOpen, onClose])

  useEffect(() => {
    if (!menuOpen) return
    syncMenuPosition()
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (menuButtonRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setMenuOpen(false)
    }
    const onLayout = () => syncMenuPosition()
    document.addEventListener('mousedown', onPointerDown)
    window.addEventListener('resize', onLayout)
    window.addEventListener('scroll', onLayout, true)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('resize', onLayout)
      window.removeEventListener('scroll', onLayout, true)
    }
  }, [menuOpen, syncMenuPosition])

  const patchSlide = <K extends keyof StorySlide>(key: K, value: StorySlide[K]) => {
    onSlideChange({ ...slide, [key]: value })
  }

  const shareSlides = async () => {
    const shareData = {
      title: storyTitle,
      text: storyDescription,
      url: window.location.href,
    }
    try {
      if (navigator.share) {
        await navigator.share(shareData)
      } else {
        await navigator.clipboard.writeText(shareData.url)
      }
    } catch {
      setMenuOpen(false)
      return
    }
    setMenuOpen(false)
  }

  return createPortal(
    <div className={styles.modalRoot}>
      <button type="button" className={styles.modalBackdrop} aria-label="Close settings" onClick={onClose} />
      <div
        id="story-edit-modal"
        className={`${styles.panel} ${styles.modal}${
          section === 'assets' ? ` ${styles.assetsModal}` : ''
        }${assetsExpanded ? ` ${styles.assetsModalExpanded}` : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="story-edit-modal-title"
        dir="ltr"
      >
      {section === 'assets' ? (
        <AssetsPicker
          filters={filters}
          expanded={assetsExpanded}
          onExpandedChange={setAssetsExpanded}
          onFiltersChange={onFiltersChange}
          onClose={onClose}
        />
      ) : (
      <>
      <header className={styles.header}>
        <div className={styles.headerIdentity}>
          {section === 'slide' && isEditingSlide && (
            <button
              type="button"
              className={styles.backBtn}
              onClick={() => {
                setMenuOpen(false)
                setIsEditingSlide(false)
              }}
              aria-label="Back to slides"
            >
              <ArrowLeft size={18} weight="bold" aria-hidden />
            </button>
          )}
          <div className={styles.headerCopy}>
            <div className={styles.titleLine}>
              <h2 id="story-edit-modal-title" className={styles.title}>
                {modalTitle}
              </h2>
              {section === 'slide' && isEditingSlide && presentationSettings.multiSlide ? (
                <button
                  ref={menuButtonRef}
                  type="button"
                  className={`${styles.titleMenuBtn}${menuOpen ? ` ${styles.titleMenuBtnOpen}` : ''}`}
                  aria-label={isEditingSlide ? 'Slide actions' : 'Edit story menu'}
                  aria-expanded={menuOpen}
                  aria-haspopup="menu"
                  onClick={() => {
                    if (!menuOpen) syncMenuPosition()
                    setMenuOpen((open) => !open)
                  }}
                >
                  <CaretDown size={15} weight="bold" aria-hidden />
                </button>
              ) : null}
            </div>
          </div>
        </div>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close Story settings"
          >
            <X size={18} weight="bold" aria-hidden />
          </button>
        </div>
      </header>

      <div
        key={section === 'slide' && isEditingSlide ? `slide-${slide.id}` : section}
        className={styles.scroll}
      >
        {section === 'story' ? (
          <MainContentTab
            storyTitle={storyTitle}
            storyDescription={storyDescription}
            presentationSettings={presentationSettings}
            onStoryTitleChange={onStoryTitleChange}
            onStoryDescriptionChange={onStoryDescriptionChange}
            onPresentationSettingsChange={onPresentationSettingsChange}
          />
        ) : null}
        {section === 'slide' ? (
          isEditingSlide ? (
            <SlideEditor
              part="content"
              slide={slide}
              filters={filters}
              multiSlide={presentationSettings.multiSlide}
              textDirection={presentationSettings.textDirection}
              onTextDirectionChange={(textDirection) =>
                onPresentationSettingsChange({ ...presentationSettings, textDirection })
              }
              onSlideChange={patchSlide}
              onFiltersChange={onFiltersChange}
            />
          ) : (
            <SlidesOverview
              chapters={chapters}
              slides={slides}
              activeSlideIndex={activeSlideIndex}
              onEditSlide={(index) => {
                onSelectSlide(index)
                setMenuOpen(false)
                setIsEditingSlide(true)
              }}
              onDuplicateSlide={onDuplicateSlide}
              onDeleteSlide={(slideId) => onDeleteSlide(slideId)}
              onAddChapter={onAddChapter}
              onRenameChapter={onRenameChapter}
              onDeleteChapter={onDeleteChapter}
              onAddSlide={onAddSlide}
              multiSlide={presentationSettings.multiSlide}
            />
          )
        ) : null}
        {section === 'map' ? <MapSection /> : null}
        {section === 'tools' ? (
          <ToolsSection
            canRemoveSlide={slides.length > 1}
            onDuplicateSlide={() => onDuplicateSlide()}
            onDeleteSlide={() => onDeleteSlide(slide.id)}
            onShare={() => void shareSlides()}
            onDeleteSlides={onDeleteSlides}
          />
        ) : null}
      </div>
      {menuOpen
        ? createPortal(
            <div
              ref={menuRef}
              className={styles.titleMenu}
              role="menu"
              aria-label={isEditingSlide ? 'Slide actions' : 'Edit story menu'}
              style={
                {
                  top: menuPosition.top,
                  left: menuPosition.left,
                } as CSSProperties
              }
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onDuplicateSlide()
                  setMenuOpen(false)
                }}
              >
                <Copy size={16} aria-hidden />
                Duplicate
              </button>
              <button
                type="button"
                role="menuitem"
                className={styles.titleMenuDanger}
                disabled={slides.length === 1}
                onClick={() => {
                  onDeleteSlide(slide.id)
                  setMenuOpen(false)
                  setIsEditingSlide(false)
                }}
              >
                <Trash size={16} aria-hidden />
                Delete
              </button>
            </div>,
            document.body,
          )
        : null}
      </>
      )}
      </div>
    </div>,
    document.body,
  )
}

const ASSET_CAPTION = 'Real-Time Permit, EIA & Environmental Risk Intelligence'

const MAP_LAYERS = [
  {
    id: 'layer-permit',
    title: ASSET_CAPTION,
    category: 'Traffic',
    image: landingAssets.assetLayerPermit,
  },
  {
    id: 'layer-terrain',
    title: ASSET_CAPTION,
    category: 'Weather',
    image: landingAssets.assetLayerTerrain,
  },
  {
    id: 'layer-pins',
    title: ASSET_CAPTION,
    category: 'Operations',
    image: landingAssets.assetLayerPins,
  },
] as const

const CHARTS = [
  {
    id: 'chart-aqi',
    title: 'Air Quality Trend',
    category: 'Trends',
    image: landingAssets.storyThumbChartBase,
    overlay: landingAssets.storyThumbChartBars,
  },
] as const

const ASSET_TABS = [
  {
    id: 'layers',
    label: 'Map Layers',
    icon: MapPin,
    all: 'All Map Layers',
    categories: ['Traffic', 'Weather', 'Sales', 'Operations'],
    placeholder: 'Search map layers..',
  },
  {
    id: 'charts',
    label: 'Charts',
    icon: ChartLine,
    all: 'All Charts',
    categories: ['Trends', 'Comparison', 'Distribution'],
    placeholder: 'Search charts..',
  },
  {
    id: 'filters',
    label: 'Filters',
    icon: FunnelSimple,
    all: 'All Filters',
    categories: ['Location', 'Time', 'Demographics'],
    placeholder: 'Search filters..',
  },
] as const

type AssetTabId = (typeof ASSET_TABS)[number]['id']

const FILTER_CATEGORY: Record<string, string> = {
  loc: 'Location',
  year: 'Time',
  ssi: 'Demographics',
  type: 'Demographics',
  gender: 'Demographics',
  level: 'Demographics',
}

const FILTER_CATALOG = [
  { id: 'filter-airports', label: 'Airports', category: 'Location', icon: 'calendar' },
  { id: 'filter-aqi-timeseries', label: 'AQI Timeseries', category: 'Time', icon: 'calendar' },
  { id: 'filter-area', label: 'Area', category: 'Location', icon: 'pin' },
  { id: 'filter-calendar-timeseries', label: 'CalendarTimeSeries', category: 'Time', icon: 'calendar' },
  { id: 'filter-channel', label: 'Channel', category: 'Demographics', icon: 'grid' },
  { id: 'filter-comparison', label: 'Comparison', category: 'Demographics', icon: 'grid' },
  { id: 'filter-custom3-time', label: 'Custom3Time', category: 'Time', icon: 'calendar' },
  { id: 'filter-date', label: 'Date', category: 'Time', icon: 'calendar' },
  { id: 'filter-day', label: 'Day', category: 'Time', icon: 'calendar' },
] as const

function FilterGlyph({ icon }: { icon: (typeof FILTER_CATALOG)[number]['icon'] }) {
  if (icon === 'pin') return <MapPin size={28} weight="regular" aria-hidden />
  if (icon === 'grid') return <SquaresFour size={28} weight="regular" aria-hidden />
  return <CalendarBlank size={28} weight="regular" aria-hidden />
}

function AssetsPicker({
  filters,
  expanded,
  onExpandedChange,
  onFiltersChange,
  onClose,
}: {
  filters: StoryFilter[]
  expanded: boolean
  onExpandedChange: (expanded: boolean) => void
  onFiltersChange: (filters: StoryFilter[]) => void
  onClose: () => void
}) {
  const [tab, setTab] = useState<AssetTabId>('layers')
  const [category, setCategory] = useState('All Map Layers')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const activeTab = ASSET_TABS.find((item) => item.id === tab) ?? ASSET_TABS[0]
  const normalizedQuery = query.trim().toLowerCase()

  const layerItems = MAP_LAYERS.filter(
    (item) =>
      (category === 'All Map Layers' || item.category === category) &&
      item.title.toLowerCase().includes(normalizedQuery),
  )
  const chartItems = CHARTS.filter(
    (item) =>
      (category === 'All Charts' || item.category === category) &&
      item.title.toLowerCase().includes(normalizedQuery),
  )
  const filterItems = filters.filter((item) => {
    const itemCategory = FILTER_CATEGORY[item.id] ?? 'Location'
    return (
      (category === 'All Filters' || itemCategory === category) &&
      item.label.toLowerCase().includes(normalizedQuery)
    )
  })
  const catalogFilterItems = FILTER_CATALOG.filter(
    (item) =>
      !filters.some((filter) => filter.label === item.label) &&
      (category === 'All Filters' || item.category === category) &&
      item.label.toLowerCase().includes(normalizedQuery),
  )
  const visibleItems = tab === 'layers' ? layerItems : tab === 'charts' ? chartItems : filterItems

  const selectedItems = selected.flatMap((id) => {
    const layer = MAP_LAYERS.find((item) => item.id === id)
    if (layer) return [{ id, title: layer.category }]
    const chart = CHARTS.find((item) => item.id === id)
    if (chart) return [{ id, title: chart.title }]
    const filter = filters.find((item) => item.id === id)
    if (filter) return [{ id, title: filter.label }]
    const catalog = FILTER_CATALOG.find((item) => item.id === id)
    return catalog ? [{ id, title: catalog.label }] : []
  })

  const toggleSelected = (id: string) => {
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    )
  }

  const chooseTab = (next: AssetTabId) => {
    const nextTab = ASSET_TABS.find((item) => item.id === next) ?? ASSET_TABS[0]
    setTab(next)
    setCategory(nextTab.all)
    setQuery('')
  }

  return (
    <>
      <header className={styles.assetsHeader}>
        <h2 id="story-edit-modal-title" className={styles.assetsTitle}>
          Add Assets
        </h2>
        <div className={styles.assetsTabs} role="tablist" aria-label="Asset types">
          {ASSET_TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              className={`${styles.assetsTab}${tab === id ? ` ${styles.assetsTabActive}` : ''}`}
              aria-selected={tab === id}
              onClick={() => chooseTab(id)}
            >
              <Icon size={20} weight="regular" aria-hidden />
              {label}
            </button>
          ))}
        </div>
        <div className={styles.assetsHeaderEnd}>
          <label className={styles.assetsSearch}>
            <MagnifyingGlass size={20} aria-hidden />
            <input
              value={query}
              placeholder={activeTab.placeholder}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <button
            type="button"
            className={styles.assetsExpand}
            aria-label={expanded ? 'Restore assets modal' : 'Expand assets modal'}
            aria-pressed={expanded}
            onClick={() => onExpandedChange(!expanded)}
          >
            <ArrowsOut size={20} aria-hidden />
          </button>
        </div>
      </header>
      <div className={styles.assetsBody}>
        <nav className={styles.assetsNav} aria-label="Asset categories">
          {[activeTab.all, ...activeTab.categories].map((name) => (
            <button
              key={name}
              type="button"
              className={`${styles.assetsNavBtn}${category === name ? ` ${styles.assetsNavBtnActive}` : ''}`}
              aria-pressed={category === name}
              onClick={() => setCategory(name)}
            >
              {name}
            </button>
          ))}
        </nav>
        <div className={styles.assetsStage}>
          <div className={styles.assetsGrid}>
            {tab === 'filters' ? (
              filterItems.length + catalogFilterItems.length === 0 ? (
              <p className={styles.assetsEmpty}>No assets match.</p>
            ) : (
              <>
              {filterItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`${styles.assetCard} ${styles.assetCardPlain}${
                      selected.includes(item.id) ? ` ${styles.assetCardSelected}` : ''
                    }`}
                    aria-pressed={selected.includes(item.id)}
                    onClick={() => toggleSelected(item.id)}
                  >
                    <span className={styles.assetCardTitle}>{item.label}</span>
                  </button>
                ))}
              {catalogFilterItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`${styles.assetFilter}${
                    selected.includes(item.id) ? ` ${styles.assetFilterSelected}` : ''
                  }`}
                  aria-pressed={selected.includes(item.id)}
                  onClick={() => toggleSelected(item.id)}
                >
                  <span className={styles.assetFilterIcon}>
                    <FilterGlyph icon={item.icon} />
                  </span>
                  <span className={styles.assetFilterLabel}>{item.label}</span>
                </button>
              ))}
              </>
            )
            ) : visibleItems.length === 0 ? (
              <p className={styles.assetsEmpty}>No assets match.</p>
            ) : (
              (tab === 'layers' ? layerItems : chartItems).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`${styles.assetCard}${
                    selected.includes(item.id) ? ` ${styles.assetCardSelected}` : ''
                  }`}
                  aria-pressed={selected.includes(item.id)}
                  onClick={() => toggleSelected(item.id)}
                >
                  <span className={styles.assetCardImage}>
                    <img src={item.image} alt="" />
                    {'overlay' in item && item.overlay ? <img src={item.overlay} alt="" /> : null}
                  </span>
                  <span className={styles.assetCardTitle}>{item.title}</span>
                </button>
              ))
            )}
          </div>
        </div>
        <aside className={styles.assetsSelected} aria-label="Selected assets">
          <p className={styles.assetsSelectedTitle}>Selected</p>
          {selectedItems.length === 0 ? (
            <p className={styles.assetsSelectedEmpty}>No asset selected</p>
          ) : (
            <div className={styles.assetsSelectedList}>
              {selectedItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={styles.assetsSelectedItem}
                  onClick={() => toggleSelected(item.id)}
                >
                  {item.title}
                </button>
              ))}
            </div>
          )}
        </aside>
      </div>
      <footer className={styles.assetsFooter}>
        <p className={styles.assetsHint}>You can add components by drag and drop, or select multiple.</p>
        <button
          type="button"
          className={styles.assetsNext}
          onClick={() => {
            const selectedFilters = filters.filter((item) => selected.includes(item.id))
            const catalogAdditions = FILTER_CATALOG.filter(
              (item) =>
                selected.includes(item.id) && !filters.some((filter) => filter.label === item.label),
            ).map((item) => ({ id: item.id, label: item.label, removable: true }))
            if (selectedFilters.length > 0) {
              onFiltersChange([...selectedFilters, ...catalogAdditions])
            } else if (catalogAdditions.length > 0) {
              onFiltersChange([...filters, ...catalogAdditions])
            }
            onClose()
          }}
        >
          Next
        </button>
      </footer>
    </>
  )
}

function ToolsSection({
  canRemoveSlide,
  onDuplicateSlide,
  onDeleteSlide,
  onShare,
  onDeleteSlides,
}: {
  canRemoveSlide: boolean
  onDuplicateSlide: () => void
  onDeleteSlide: () => void
  onShare: () => void
  onDeleteSlides: () => void
}) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHeading}>
        <h3 className={`${styles.sectionTitle} ${styles.sectionTitleLarge}`}>Story tools</h3>
      </div>
      <div className={styles.toolList}>
        <button type="button" className={styles.secondaryBtn} onClick={onDuplicateSlide}>
          <Copy size={16} aria-hidden />
          Duplicate slide
        </button>
        <button type="button" className={styles.secondaryBtn} onClick={onShare}>
          <ShareNetwork size={16} aria-hidden />
          Share slides
        </button>
        <button
          type="button"
          className={styles.dangerBtn}
          disabled={!canRemoveSlide}
          onClick={onDeleteSlide}
        >
          <Trash size={16} aria-hidden />
          Remove slide
        </button>
        <button
          type="button"
          className={styles.dangerBtn}
          onClick={() => {
            if (window.confirm('Delete this slide deck?')) onDeleteSlides()
          }}
        >
          <Trash size={16} aria-hidden />
          Delete slides
        </button>
      </div>
    </section>
  )
}

const LOGO_OPTIONS = [
  { value: 'dark', label: 'Dark Mode Logo (Default)' },
  { value: 'light', label: 'Light Mode Logo' },
] as const

function MainContentTab({
  storyTitle,
  storyDescription,
  presentationSettings,
  onStoryTitleChange,
  onStoryDescriptionChange,
  onPresentationSettingsChange,
}: {
  storyTitle: string
  storyDescription: string
  presentationSettings: StoryPresentationSettings
  onStoryTitleChange: (value: string) => void
  onStoryDescriptionChange: (value: string) => void
  onPresentationSettingsChange: (settings: StoryPresentationSettings) => void
}) {
  const [logoMode, setLogoMode] = useState<'dark' | 'light'>('dark')
  const [logoMenuOpen, setLogoMenuOpen] = useState(false)
  const [logoMenuPosition, setLogoMenuPosition] = useState({ top: 0, left: 0, width: 0 })
  const logoTriggerRef = useRef<HTMLButtonElement>(null)
  const logoMenuRef = useRef<HTMLDivElement>(null)
  const patchSettings = <K extends keyof StoryPresentationSettings>(
    key: K,
    value: StoryPresentationSettings[K],
  ) => onPresentationSettingsChange({ ...presentationSettings, [key]: value })
  const logoName =
    logoMode === 'dark' ? presentationSettings.darkLogoName : presentationSettings.lightLogoName
  const logoLabel = LOGO_OPTIONS.find((option) => option.value === logoMode)?.label ?? LOGO_OPTIONS[0].label

  const syncLogoMenuPosition = useCallback(() => {
    const trigger = logoTriggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    setLogoMenuPosition({
      top: rect.bottom + 8,
      left: Math.min(rect.left, Math.max(8, window.innerWidth - rect.width - 8)),
      width: rect.width,
    })
  }, [])

  useEffect(() => {
    if (!logoMenuOpen) return
    syncLogoMenuPosition()
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (logoTriggerRef.current?.contains(target) || logoMenuRef.current?.contains(target)) return
      setLogoMenuOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopImmediatePropagation()
      setLogoMenuOpen(false)
      logoTriggerRef.current?.focus()
    }
    const onLayout = () => syncLogoMenuPosition()
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
  }, [logoMenuOpen, syncLogoMenuPosition])

  return (
    <section className={styles.section}>
      <label className={styles.field}>
        <span className={styles.label}>Story title</span>
        <input
          className={styles.input}
          maxLength={100}
          value={storyTitle}
          onChange={(event) => onStoryTitleChange(event.target.value)}
        />
        <span className={styles.charCount}>{storyTitle.length}/100</span>
      </label>
      <label className={styles.field}>
        <span className={styles.label}>Description</span>
        <textarea
          className={styles.textarea}
          rows={3}
          maxLength={300}
          value={storyDescription}
          onChange={(event) => onStoryDescriptionChange(event.target.value)}
        />
        <span className={styles.charCount}>{storyDescription.length}/300</span>
      </label>
      <div className={styles.field}>
        <span className={styles.label}>Logo</span>
        <div className={styles.logoField}>
        <div className={styles.logoSelectWrap}>
          <button
            ref={logoTriggerRef}
            type="button"
            className={`${styles.logoSelect}${logoMenuOpen ? ` ${styles.logoSelectOpen}` : ''}`}
            aria-label="Logo"
            aria-haspopup="listbox"
            aria-expanded={logoMenuOpen}
            aria-controls="logo-mode-menu"
            onClick={() => {
              if (logoMenuOpen) {
                setLogoMenuOpen(false)
                return
              }
              syncLogoMenuPosition()
              setLogoMenuOpen(true)
            }}
          >
            <span>{logoLabel}</span>
            <CaretDown className={styles.logoSelectCaret} size={16} weight="bold" aria-hidden />
          </button>
          {logoMenuOpen
            ? createPortal(
                <div
                  ref={logoMenuRef}
                  id="logo-mode-menu"
                  className={styles.logoMenu}
                  role="listbox"
                  aria-label="Logo"
                  style={
                    {
                      top: logoMenuPosition.top,
                      left: logoMenuPosition.left,
                      width: logoMenuPosition.width,
                    } as CSSProperties
                  }
                >
                  {LOGO_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      role="option"
                      aria-selected={option.value === logoMode}
                      className={option.value === logoMode ? styles.logoMenuSelected : undefined}
                      onClick={() => {
                        setLogoMode(option.value)
                        setLogoMenuOpen(false)
                      }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>,
                document.body,
              )
            : null}
        </div>
        <label className={styles.fileSelect}>
          <input
            className={styles.fileInput}
            type="file"
            accept="image/*"
            onChange={(event) =>
              patchSettings(
                logoMode === 'dark' ? 'darkLogoName' : 'lightLogoName',
                event.target.files?.[0]?.name ?? '',
              )
            }
          />
          {logoName || 'Select'}
        </label>
        {logoMode === 'light' ? (
          <p className={styles.settingHelp}>
            This logo will be used in light mode if provided. Otherwise, the dark mode logo will be
            used instead.
          </p>
        ) : null}
        </div>
      </div>
      <SettingToggle
        label="Enable Chapter Splash Screen"
        checked={presentationSettings.chapterSplash}
        onChange={(checked) => patchSettings('chapterSplash', checked)}
      />
      <SettingToggle
        label="Enable Autoplay Button"
        checked={presentationSettings.autoplay}
        onChange={(checked) => patchSettings('autoplay', checked)}
      />
      <div className={styles.settingGroup}>
        <SettingToggle
          label="Enable Multi-slide Slides"
          checked={presentationSettings.multiSlide}
          onChange={(checked) => patchSettings('multiSlide', checked)}
        />
        <p className={styles.settingHelp}>
          When off, the editor hides controls for adding or renaming slides and the bottom slide
          arrows. Slides content is still saved as usual.
        </p>
      </div>
    </section>
  )
}

function TextDirectionField({
  value,
  onChange,
}: {
  value: 'ltr' | 'rtl'
  onChange: (value: 'ltr' | 'rtl') => void
}) {
  return (
    <div className={styles.inlineSetting}>
      <span className={styles.label}>Text Direction</span>
      <div className={`${styles.segmentedControl} ${styles.segmentedControlCompact}`} aria-label="Text direction">
        <button
          type="button"
          className={`${styles.segmentedBtn}${value === 'ltr' ? ` ${styles.segmentedBtnActive}` : ''}`}
          aria-pressed={value === 'ltr'}
          onClick={() => onChange('ltr')}
        >
          Left to Right
        </button>
        <button
          type="button"
          className={`${styles.segmentedBtn}${value === 'rtl' ? ` ${styles.segmentedBtnActive}` : ''}`}
          aria-pressed={value === 'rtl'}
          onClick={() => onChange('rtl')}
        >
          Right to Left
        </button>
      </div>
    </div>
  )
}

function SettingToggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <div className={styles.toggleSetting}>
      <span className={styles.label}>{label}</span>
      <button
        type="button"
        role="switch"
        className={`${styles.switch}${checked ? ` ${styles.switchOn}` : ''}`}
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
      >
        <span className={styles.switchThumb} />
      </button>
    </div>
  )
}

function SlidesOverview({
  chapters,
  slides,
  activeSlideIndex,
  onEditSlide,
  onDuplicateSlide,
  onDeleteSlide,
  onAddChapter,
  onRenameChapter,
  onDeleteChapter,
  onAddSlide,
  multiSlide,
}: {
  chapters: StoryChapter[]
  slides: StorySlide[]
  activeSlideIndex: number
  onEditSlide: (index: number) => void
  onDuplicateSlide: (slideId?: string) => void
  onDeleteSlide: (slideId: string) => void
  onAddChapter: () => void
  onRenameChapter: (chapterId: string, title: string) => void
  onDeleteChapter: (chapterId: string) => void
  onAddSlide: (chapterId: string) => void
  multiSlide: boolean
}) {
  const [editingChapterId, setEditingChapterId] = useState<string | null>(null)
  const [chapterDraft, setChapterDraft] = useState('')
  const [menuSlideId, setMenuSlideId] = useState<string | null>(null)
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 })
  const menuButtonRef = useRef<HTMLButtonElement | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const placeSlideMenu = useCallback((button: HTMLButtonElement) => {
    const rect = button.getBoundingClientRect()
    const width = 200
    const height = 92
    const left = Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8))
    const below = rect.bottom + 8
    const top = below + height > window.innerHeight ? Math.max(8, rect.top - 8 - height) : below
    setMenuPosition({ top, left })
  }, [])

  useEffect(() => {
    if (!menuSlideId) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopImmediatePropagation()
      setMenuSlideId(null)
    }
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (menuButtonRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setMenuSlideId(null)
    }
    const onLayout = () => {
      if (menuButtonRef.current) placeSlideMenu(menuButtonRef.current)
    }
    window.addEventListener('keydown', onKeyDown, true)
    document.addEventListener('mousedown', onPointerDown)
    window.addEventListener('resize', onLayout)
    window.addEventListener('scroll', onLayout, true)
    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
      document.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('resize', onLayout)
      window.removeEventListener('scroll', onLayout, true)
    }
  }, [menuSlideId, placeSlideMenu])
  const cancelChapterRename = useRef(false)

  const commitChapterName = () => {
    if (cancelChapterRename.current) {
      cancelChapterRename.current = false
      return
    }
    if (!editingChapterId) return
    const title = chapterDraft.trim()
    if (title) onRenameChapter(editingChapterId, title)
    setEditingChapterId(null)
  }
  return (
    <section className={styles.section}>
      <div className={styles.sectionHeading}>
        <div>
          <h3 className={`${styles.sectionTitle} ${styles.sectionTitleLarge}`}>Chapters</h3>
        </div>
        {multiSlide ? (
          <button type="button" className={styles.addBtn} onClick={onAddChapter}>
            <Plus size={15} weight="bold" aria-hidden />
            Add chapter
          </button>
        ) : null}
      </div>
      <div className={styles.chapterList}>
        {chapters.map((chapter) => {
          const chapterSlides = slides
            .map((item, index) => ({ item, index }))
            .filter(({ item }) => item.chapterId === chapter.id)
          return (
            <div key={chapter.id} className={styles.chapterGroup}>
              <div className={styles.chapterHeading}>
                <div className={styles.chapterTitleGroup}>
                  {editingChapterId === chapter.id ? (
                    <input
                      className={styles.chapterTitleInput}
                      value={chapterDraft}
                      aria-label={`Chapter name for ${chapter.title}`}
                      autoFocus
                      maxLength={80}
                      onChange={(event) => setChapterDraft(event.target.value)}
                      onBlur={commitChapterName}
                      onKeyDown={(event) => {
                        if (event.key === 'Escape') {
                          event.stopPropagation()
                          cancelChapterRename.current = true
                          setEditingChapterId(null)
                          return
                        }
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          commitChapterName()
                        }
                      }}
                    />
                  ) : (
                    <>
                      <h4 className={styles.chapterTitle}>{chapter.title}</h4>
                      <button
                        type="button"
                        className={`${styles.slideActionBtn} ${styles.chapterEditBtn}`}
                        onClick={() => {
                          setEditingChapterId(chapter.id)
                          setChapterDraft(chapter.title)
                        }}
                        aria-label={`Edit ${chapter.title}`}
                        title="Edit chapter name"
                      >
                        <PencilSimple size={15} aria-hidden />
                      </button>
                    </>
                  )}
                </div>
                {multiSlide && chapters.length > 1 ? (
                  <button
                    type="button"
                    className={`${styles.slideActionBtn} ${styles.slideActionDanger}`}
                    onClick={() => onDeleteChapter(chapter.id)}
                    aria-label={`Delete ${chapter.title}`}
                    title="Delete chapter"
                  >
                    <Trash size={15} aria-hidden />
                  </button>
                ) : null}
              </div>
              <div className={styles.slideList}>
                {chapterSlides.map(({ item, index }, chapterIndex) => {
                  const thumbnail = storyThumbLayers(
                    SLIDE_THUMB_VARIANTS[index % SLIDE_THUMB_VARIANTS.length],
                  )
                  return (
                    <div
                      key={item.id}
                      className={`${styles.slideItem}${
                        index === activeSlideIndex ? ` ${styles.slideItemActive}` : ''
                      }`}
                    >
                      <button
                        type="button"
                        className={styles.slideItemSelect}
                        onClick={() => onEditSlide(index)}
                        aria-current={index === activeSlideIndex ? 'true' : undefined}
                        aria-label={`Edit slide ${chapterIndex + 1}: ${item.title}`}
                      >
                        <span className={styles.slideThumbnail} aria-hidden>
                          <span className={styles.slideThumbnailLayers}>
                            <img src={thumbnail.image} alt="" />
                            {thumbnail.overlay ? <img src={thumbnail.overlay} alt="" /> : null}
                          </span>
                        </span>
                        <span className={styles.slideItemMeta}>
                          <span className={styles.slideItemCopy}>
                            <span className={styles.slideTitleLine}>
                              <span className={styles.slideNumber}>{chapterIndex + 1}.</span>
                              <span className={styles.slideItemTitle}>{item.title}</span>
                            </span>
                            <span className={styles.slideItemDetails}>
                              <span>{item.layout === 'sidebar' ? 'Sidebar' : 'Full width'}</span>
                              {item.layout === 'sidebar' ? (
                                <span>
                                  {item.sidebarWidth === 'small' ? 'Small sidebar' : 'Large sidebar'}
                                </span>
                              ) : null}
                              <span>{item.focusLayout ? 'Focus on' : 'Focus off'}</span>
                            </span>
                          </span>
                        </span>
                      </button>
                      {multiSlide ? (
                        <div className={styles.slideItemActions}>
                          <button
                            type="button"
                            className={`${styles.slideMenuBtn}${
                              menuSlideId === item.id ? ` ${styles.slideMenuBtnOpen}` : ''
                            }`}
                            aria-label={`Actions for ${item.title}`}
                            aria-haspopup="menu"
                            aria-expanded={menuSlideId === item.id}
                            onClick={(event) => {
                              const button = event.currentTarget
                              if (menuSlideId === item.id) {
                                setMenuSlideId(null)
                                return
                              }
                              menuButtonRef.current = button
                              placeSlideMenu(button)
                              setMenuSlideId(item.id)
                            }}
                          >
                            <DotsThreeVertical size={18} weight="bold" aria-hidden />
                          </button>
                        </div>
                      ) : null}
                    </div>
                  )
                })}
                {multiSlide ? (
                  <button
                    type="button"
                    className={styles.addSlideRow}
                    onClick={() => onAddSlide(chapter.id)}
                  >
                    <Plus size={16} weight="bold" aria-hidden />
                    Add slide
                  </button>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
      {menuSlideId
        ? createPortal(
            <div
              ref={menuRef}
              className={styles.titleMenu}
              role="menu"
              aria-label="Slide actions"
              style={{ top: menuPosition.top, left: menuPosition.left }}
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onDuplicateSlide(menuSlideId)
                  setMenuSlideId(null)
                }}
              >
                <Copy size={16} aria-hidden />
                Duplicate
              </button>
              <button
                type="button"
                role="menuitem"
                className={styles.titleMenuDanger}
                disabled={slides.length === 1}
                onClick={() => {
                  onDeleteSlide(menuSlideId)
                  setMenuSlideId(null)
                }}
              >
                <Trash size={16} aria-hidden />
                Remove
              </button>
            </div>,
            document.body,
          )
        : null}
    </section>
  )
}

function MapSection() {
  const mapThumb = storyThumbLayers('map')

  return (
    <section className={styles.section}>
      <div className={styles.mapCard}>
        <span className={styles.mapThumb} aria-hidden>
          <img src={mapThumb.image} alt="" />
          {mapThumb.overlay ? <img src={mapThumb.overlay} alt="" /> : null}
        </span>
        <span className={styles.mapCopy}>
          <span className={styles.mapName}>Map</span>
          <span className={styles.mapStyleName}>Custom style</span>
        </span>
        <button type="button" className={styles.mapChange}>
          Change
        </button>
      </div>
    </section>
  )
}

function SlideEditor({
  part,
  slide,
  filters,
  multiSlide,
  textDirection,
  onTextDirectionChange,
  onSlideChange,
  onFiltersChange,
}: {
  part: 'content' | 'assets'
  slide: StorySlide
  filters: StoryFilter[]
  multiSlide: boolean
  textDirection?: 'ltr' | 'rtl'
  onTextDirectionChange?: (value: 'ltr' | 'rtl') => void
  onSlideChange: <K extends keyof StorySlide>(key: K, value: StorySlide[K]) => void
  onFiltersChange: (filters: StoryFilter[]) => void
}) {
  const [editingFilterId, setEditingFilterId] = useState<string | null>(null)

  return (
    <>
      {part === 'content' ? (
      <>
      <section className={styles.section}>
        <div className={styles.sectionHeading}>
          <div>
            <h3 className={`${styles.sectionTitle} ${styles.sectionTitleLarge}`}>Content</h3>
          </div>
        </div>
        {multiSlide ? (
          <label className={styles.field}>
            <span className={styles.label}>Heading</span>
            <input
              className={styles.input}
              value={slide.title}
              onChange={(event) => onSlideChange('title', event.target.value)}
            />
          </label>
        ) : null}
        <label className={styles.field}>
          <span className={styles.label}>Slide description</span>
          <textarea
            className={styles.textarea}
            rows={4}
            value={slide.finding}
            onChange={(event) => onSlideChange('finding', event.target.value)}
          />
        </label>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeading}>
          <div>
            <h3 className={`${styles.sectionTitle} ${styles.sectionTitleLarge}`}>Layout</h3>
          </div>
        </div>
        <div className={styles.inlineSetting}>
          <span className={styles.label}>Slide Layout</span>
          <div className={`${styles.segmentedControl} ${styles.segmentedControlCompact}`} aria-label="Slide layout">
            <button
              type="button"
              className={`${styles.segmentedBtn}${
                slide.layout === 'sidebar' ? ` ${styles.segmentedBtnActive}` : ''
              }`}
              aria-pressed={slide.layout === 'sidebar'}
              onClick={() => onSlideChange('layout', 'sidebar')}
            >
              Side Bar
            </button>
            <button
              type="button"
              className={`${styles.segmentedBtn}${
                slide.layout === 'full-width' ? ` ${styles.segmentedBtnActive}` : ''
              }`}
              aria-pressed={slide.layout === 'full-width'}
              onClick={() => onSlideChange('layout', 'full-width')}
            >
              Full Width
            </button>
          </div>
        </div>
        {slide.layout === 'sidebar' ? (
          <div className={styles.inlineSetting}>
            <span className={styles.label}>Sidebar Width</span>
            <div className={`${styles.segmentedControl} ${styles.segmentedControlCompact}`} aria-label="Sidebar width">
              <button
                type="button"
                className={`${styles.segmentedBtn}${
                  slide.sidebarWidth === 'small' ? ` ${styles.segmentedBtnActive}` : ''
                }`}
                aria-pressed={slide.sidebarWidth === 'small'}
                onClick={() => onSlideChange('sidebarWidth', 'small')}
              >
                Small
              </button>
              <button
                type="button"
                className={`${styles.segmentedBtn}${
                  slide.sidebarWidth === 'large' ? ` ${styles.segmentedBtnActive}` : ''
                }`}
                aria-pressed={slide.sidebarWidth === 'large'}
                onClick={() => onSlideChange('sidebarWidth', 'large')}
              >
                Large
              </button>
            </div>
          </div>
        ) : null}
        {textDirection && onTextDirectionChange ? (
          <TextDirectionField value={textDirection} onChange={onTextDirectionChange} />
        ) : null}
        <SettingToggle
          label="Focus Layout"
          checked={slide.focusLayout}
          onChange={(checked) => onSlideChange('focusLayout', checked)}
        />
      </section>
      </>
      ) : null}

      {part === 'assets' ? (
      <>
      <section className={styles.section}>
        <div className={styles.sectionHeading}>
          <div>
            <h3 className={`${styles.sectionTitle} ${styles.sectionTitleLarge}`}>Filters</h3>
          </div>
          <button
            type="button"
            className={styles.addBtn}
            onClick={() =>
              onFiltersChange([
                ...filters,
                {
                  id: `custom-${Date.now()}`,
                  label: 'New filter',
                  removable: true,
                },
              ])
            }
          >
            <Plus size={15} weight="bold" aria-hidden />
            Add filter
          </button>
        </div>
        <div className={styles.filterList}>
          {filters.map((filter, index) => (
            <div className={styles.filterRow} key={filter.id}>
              <span className={styles.filterNumber}>{index + 1}</span>
              {editingFilterId === filter.id ? (
                <input
                  className={styles.filterInput}
                  aria-label={`Filter ${index + 1}`}
                  value={filter.label}
                  autoFocus
                  onChange={(event) =>
                    onFiltersChange(
                      filters.map((item) =>
                        item.id === filter.id ? { ...item, label: event.target.value } : item,
                      ),
                    )
                  }
                  onBlur={() => setEditingFilterId(null)}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                      event.stopPropagation()
                      setEditingFilterId(null)
                      return
                    }
                    if (event.key === 'Enter') {
                      event.currentTarget.blur()
                    }
                  }}
                />
              ) : (
                <span className={styles.filterLabel}>{filter.label}</span>
              )}
              <div className={styles.filterActions}>
                <button
                  type="button"
                  className={`${styles.slideActionBtn} ${styles.chapterEditBtn}`}
                  aria-label={`Edit filter ${index + 1}`}
                  title="Edit filter"
                  onClick={() => setEditingFilterId(filter.id)}
                >
                  <PencilSimple size={15} aria-hidden />
                </button>
                <button
                  type="button"
                  className={`${styles.slideActionBtn} ${styles.slideActionDanger}`}
                  aria-label={`Remove ${filter.label} filter`}
                  title="Remove filter"
                  onClick={() => {
                    if (editingFilterId === filter.id) setEditingFilterId(null)
                    onFiltersChange(filters.filter((item) => item.id !== filter.id))
                  }}
                >
                  <Trash size={15} aria-hidden />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
      </>
      ) : null}

    </>
  )
}
