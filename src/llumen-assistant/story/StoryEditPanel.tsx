import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowLeft,
  CaretDown,
  Copy,
  PencilSimple,
  Plus,
  ShareNetwork,
  Trash,
  X,
} from '@phosphor-icons/react'
import type { StoryFilter, StorySlide } from './storyDemoData'
import styles from './StoryEditPanel.module.css'

export type StoryEditPanelProps = {
  storyTitle: string
  storyDescription: string
  presentationSettings: StoryPresentationSettings
  slides: StorySlide[]
  activeSlideIndex: number
  filters: StoryFilter[]
  onStoryTitleChange: (value: string) => void
  onStoryDescriptionChange: (value: string) => void
  onPresentationSettingsChange: (settings: StoryPresentationSettings) => void
  onSelectSlide: (index: number) => void
  onSlideChange: (slide: StorySlide) => void
  onFiltersChange: (filters: StoryFilter[]) => void
  onAddSlide: () => void
  onDuplicateSlide: () => void
  onDeleteSlide: (slideId: string) => void
  onDeleteSlides: () => void
  onClose: () => void
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
  slides,
  activeSlideIndex,
  filters,
  onStoryTitleChange,
  onStoryDescriptionChange,
  onPresentationSettingsChange,
  onSelectSlide,
  onSlideChange,
  onFiltersChange,
  onAddSlide,
  onDuplicateSlide,
  onDeleteSlide,
  onDeleteSlides,
  onClose,
}: StoryEditPanelProps) {
  const [isEditingSlide, setIsEditingSlide] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 })
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const slide = slides[activeSlideIndex]

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

  return (
    <aside id="story-edit-panel" className={styles.panel} aria-label="Story settings" dir="ltr">
      <header className={styles.header}>
        <div className={styles.headerIdentity}>
          {isEditingSlide && (
            <button
              type="button"
              className={styles.backBtn}
              onClick={() => setIsEditingSlide(false)}
              aria-label="Back to Story builder"
            >
              <ArrowLeft size={18} weight="bold" aria-hidden />
            </button>
          )}
          <div className={styles.headerCopy}>
            {isEditingSlide ? (
              <p className={styles.kicker}>Slide {activeSlideIndex + 1}</p>
            ) : null}
            <div className={styles.titleLine}>
              <h2 className={styles.title}>
                {isEditingSlide ? slide.title : 'Configure slides'}
              </h2>
              {!isEditingSlide ? (
                <button
                  ref={menuButtonRef}
                  type="button"
                  className={`${styles.titleMenuBtn}${menuOpen ? ` ${styles.titleMenuBtnOpen}` : ''}`}
                  aria-label="Configure slides menu"
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
        key={isEditingSlide ? `slide-${slide.id}` : 'story-overview'}
        className={styles.scroll}
      >
        {isEditingSlide ? (
          <SlideEditor
            slide={slide}
            filters={filters}
            slidesCount={slides.length}
            multiSlide={presentationSettings.multiSlide}
            onSlideChange={patchSlide}
            onFiltersChange={onFiltersChange}
            onDuplicateSlide={onDuplicateSlide}
            onDeleteSlide={() => {
              onDeleteSlide(slide.id)
              setIsEditingSlide(false)
            }}
          />
        ) : (
          <>
            <MainContentTab
              storyTitle={storyTitle}
              storyDescription={storyDescription}
              presentationSettings={presentationSettings}
              onStoryTitleChange={onStoryTitleChange}
              onStoryDescriptionChange={onStoryDescriptionChange}
              onPresentationSettingsChange={onPresentationSettingsChange}
            />
            <SlidesOverview
              slides={slides}
              activeSlideIndex={activeSlideIndex}
              onSelectSlide={onSelectSlide}
              onEditSlide={(index) => {
                onSelectSlide(index)
                setIsEditingSlide(true)
              }}
              onDeleteSlide={(slideId) => onDeleteSlide(slideId)}
              onAddSlide={onAddSlide}
              multiSlide={presentationSettings.multiSlide}
            />
          </>
        )}
      </div>
      {menuOpen && !isEditingSlide
        ? createPortal(
            <div
              ref={menuRef}
              className={styles.titleMenu}
              role="menu"
              style={
                {
                  top: menuPosition.top,
                  left: menuPosition.left,
                } as CSSProperties
              }
            >
              <button type="button" role="menuitem" onClick={() => void shareSlides()}>
                <ShareNetwork size={16} aria-hidden />
                Share slides
              </button>
              <button
                type="button"
                role="menuitem"
                className={styles.titleMenuDanger}
                onClick={() => {
                  setMenuOpen(false)
                  if (window.confirm('Delete this slide deck?')) onDeleteSlides()
                }}
              >
                <Trash size={16} aria-hidden />
                Delete slides
              </button>
            </div>,
            document.body,
          )
        : null}
    </aside>
  )
}

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
  const patchSettings = <K extends keyof StoryPresentationSettings>(
    key: K,
    value: StoryPresentationSettings[K],
  ) => onPresentationSettingsChange({ ...presentationSettings, [key]: value })

  return (
    <section className={styles.section}>
      <label className={styles.field}>
        <span className={styles.label}>Slides title</span>
        <input
          className={styles.input}
          maxLength={100}
          value={storyTitle}
          onChange={(event) => onStoryTitleChange(event.target.value)}
        />
        <span className={styles.characterCount}>{storyTitle.length}/100</span>
      </label>
      <label className={styles.field}>
        <span className={styles.label}>Slides description</span>
        <textarea
          className={styles.textarea}
          rows={5}
          maxLength={500}
          value={storyDescription}
          onChange={(event) => onStoryDescriptionChange(event.target.value)}
        />
        <span className={styles.characterCount}>{storyDescription.length}/500</span>
      </label>
      <label className={styles.logoField}>
        <span className={styles.label}>Dark Mode Logo (Default)</span>
        <input
          className={styles.fileInput}
          type="file"
          accept="image/*"
          onChange={(event) => patchSettings('darkLogoName', event.target.files?.[0]?.name ?? '')}
        />
        <span className={styles.fileSelect}>
          {presentationSettings.darkLogoName || 'Select'}
        </span>
      </label>
      <label className={styles.logoField}>
        <span className={styles.label}>Light Mode Logo</span>
        <input
          className={styles.fileInput}
          type="file"
          accept="image/*"
          onChange={(event) => patchSettings('lightLogoName', event.target.files?.[0]?.name ?? '')}
        />
        <span className={styles.fileSelect}>
          {presentationSettings.lightLogoName || 'Select'}
        </span>
      </label>
      <div className={styles.settingGroup}>
        <span className={styles.label}>Text Direction</span>
        <div className={styles.segmentedControl} aria-label="Text direction">
          <button
            type="button"
            className={`${styles.segmentedBtn}${
              presentationSettings.textDirection === 'ltr'
                ? ` ${styles.segmentedBtnActive}`
                : ''
            }`}
            aria-pressed={presentationSettings.textDirection === 'ltr'}
            onClick={() => patchSettings('textDirection', 'ltr')}
          >
            Left to Right
          </button>
          <button
            type="button"
            className={`${styles.segmentedBtn}${
              presentationSettings.textDirection === 'rtl'
                ? ` ${styles.segmentedBtnActive}`
                : ''
            }`}
            aria-pressed={presentationSettings.textDirection === 'rtl'}
            onClick={() => patchSettings('textDirection', 'rtl')}
          >
            Right to Left
          </button>
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
  slides,
  activeSlideIndex,
  onSelectSlide,
  onEditSlide,
  onDeleteSlide,
  onAddSlide,
  multiSlide,
}: {
  slides: StorySlide[]
  activeSlideIndex: number
  onSelectSlide: (index: number) => void
  onEditSlide: (index: number) => void
  onDeleteSlide: (slideId: string) => void
  onAddSlide: () => void
  multiSlide: boolean
}) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHeading}>
        <div>
          <h3 className={styles.sectionTitle}>Slides</h3>
        </div>
        {multiSlide ? (
          <button type="button" className={styles.addBtn} onClick={onAddSlide}>
            <Plus size={15} weight="bold" aria-hidden />
            Add slide
          </button>
        ) : null}
      </div>
      <div className={styles.slideList}>
        {slides.map((item, index) => (
          <div
            key={item.id}
            className={`${styles.slideItem}${
              index === activeSlideIndex ? ` ${styles.slideItemActive}` : ''
            }`}
          >
            <button
              type="button"
              className={styles.slideItemSelect}
              onClick={() => onSelectSlide(index)}
              aria-current={index === activeSlideIndex ? 'true' : undefined}
            >
              <span className={styles.slideNumber}>{index + 1}</span>
              <span className={styles.slideItemTitle}>{item.title}</span>
            </button>
            {multiSlide ? (
              <div className={styles.slideItemActions}>
                <button
                  type="button"
                  className={styles.slideActionBtn}
                  onClick={() => onEditSlide(index)}
                  aria-label={`Edit slide ${index + 1}: ${item.title}`}
                  title="Edit slide"
                >
                  <PencilSimple size={15} aria-hidden />
                </button>
                <button
                  type="button"
                  className={`${styles.slideActionBtn} ${styles.slideActionDanger}`}
                  onClick={() => onDeleteSlide(item.id)}
                  aria-label={`Delete slide ${index + 1}: ${item.title}`}
                  title="Delete slide"
                  disabled={slides.length === 1}
                >
                  <Trash size={15} aria-hidden />
                </button>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  )
}

function SlideEditor({
  slide,
  filters,
  slidesCount,
  multiSlide,
  onSlideChange,
  onFiltersChange,
  onDuplicateSlide,
  onDeleteSlide,
}: {
  slide: StorySlide
  filters: StoryFilter[]
  slidesCount: number
  multiSlide: boolean
  onSlideChange: <K extends keyof StorySlide>(key: K, value: StorySlide[K]) => void
  onFiltersChange: (filters: StoryFilter[]) => void
  onDuplicateSlide: () => void
  onDeleteSlide: () => void
}) {
  return (
    <>
      {multiSlide ? (
        <section className={styles.section}>
          <div className={styles.sectionHeading}>
            <div>
              <h3 className={styles.sectionTitle}>Actions</h3>
            </div>
            <div className={styles.slideActions}>
              <button type="button" className={styles.secondaryBtn} onClick={onDuplicateSlide}>
                <Copy size={15} aria-hidden />
                Duplicate
              </button>
              <button
                type="button"
                className={styles.dangerBtn}
                onClick={onDeleteSlide}
                disabled={slidesCount === 1}
              >
                <Trash size={15} aria-hidden />
                Delete
              </button>
            </div>
          </div>
        </section>
      ) : null}

      <section className={styles.section}>
        <div className={styles.sectionHeading}>
          <div>
            <h3 className={styles.sectionTitle}>Content</h3>
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
          <span className={styles.label}>Primary insight</span>
          <textarea
            className={styles.textarea}
            rows={4}
            value={slide.finding}
            onChange={(event) => onSlideChange('finding', event.target.value)}
          />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Supporting copy</span>
          <textarea
            className={styles.textarea}
            rows={4}
            value={slide.body}
            onChange={(event) => onSlideChange('body', event.target.value)}
          />
        </label>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeading}>
          <div>
            <h3 className={styles.sectionTitle}>Layout</h3>
          </div>
        </div>
        <div className={styles.layoutSettings}>
          <div className={styles.layoutPrimaryRow}>
            <div className={styles.segmentedControl} aria-label="Slide layout">
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
            <span className={styles.layoutDivider} aria-hidden />
            <div className={styles.focusControl}>
              <span>Focus Layout</span>
              <button
                type="button"
                role="switch"
                className={`${styles.switch}${slide.focusLayout ? ` ${styles.switchOn}` : ''}`}
                aria-checked={slide.focusLayout}
                aria-label="Focus layout"
                onClick={() => onSlideChange('focusLayout', !slide.focusLayout)}
              >
                <span className={styles.switchThumb} />
              </button>
            </div>
          </div>
          <div className={styles.sidebarWidthRow}>
            <span className={styles.settingLabel}>Sidebar Width</span>
            <div className={styles.segmentedControl} aria-label="Sidebar width">
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
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeading}>
          <div>
            <h3 className={styles.sectionTitle}>Filters</h3>
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
              <span className={styles.filterIndex}>{index + 1}</span>
              <input
                className={styles.input}
                aria-label={`Filter ${index + 1}`}
                value={filter.label}
                onChange={(event) =>
                  onFiltersChange(
                    filters.map((item) =>
                      item.id === filter.id ? { ...item, label: event.target.value } : item,
                    ),
                  )
                }
              />
              <button
                type="button"
                className={styles.removeBtn}
                aria-label={`Remove ${filter.label} filter`}
                onClick={() =>
                  onFiltersChange(filters.filter((item) => item.id !== filter.id))
                }
              >
                <X size={15} aria-hidden />
              </button>
            </div>
          ))}
        </div>
      </section>

    </>
  )
}
