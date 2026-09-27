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
import { storyThumbLayers } from '../landing/landingAssets'
import type { StoryChapter, StoryFilter, StorySlide } from './storyDemoData'
import styles from './StoryEditPanel.module.css'

const SLIDE_THUMB_VARIANTS = ['map', 'chart', 'satellite'] as const

export type StoryEditPanelProps = {
  storyTitle: string
  storyDescription: string
  presentationSettings: StoryPresentationSettings
  chapters: StoryChapter[]
  slides: StorySlide[]
  activeSlideIndex: number
  filters: StoryFilter[]
  onStoryTitleChange: (value: string) => void
  onPresentationSettingsChange: (settings: StoryPresentationSettings) => void
  onSelectSlide: (index: number) => void
  onSlideChange: (slide: StorySlide) => void
  onFiltersChange: (filters: StoryFilter[]) => void
  onAddChapter: () => void
  onRenameChapter: (chapterId: string, title: string) => void
  onDeleteChapter: (chapterId: string) => void
  onAddSlide: (chapterId: string) => void
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
  chapters,
  slides,
  activeSlideIndex,
  filters,
  onStoryTitleChange,
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
}: StoryEditPanelProps) {
  const [isEditingSlide, setIsEditingSlide] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 })
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const slide = slides[activeSlideIndex]
  const slideChapter = chapters.find((chapter) => chapter.id === slide?.chapterId)
  const chapterSlides = slides.filter((item) => item.chapterId === slide?.chapterId)
  const slideNumber = chapterSlides.findIndex((item) => item.id === slide?.id) + 1
  const slideHeading = `${slideChapter?.title ?? 'Chapter'} / Slide ${Math.max(slideNumber, 1)}`

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
              onClick={() => {
                setMenuOpen(false)
                setIsEditingSlide(false)
              }}
              aria-label="Back to Story builder"
            >
              <ArrowLeft size={18} weight="bold" aria-hidden />
            </button>
          )}
          <div className={styles.headerCopy}>
            <div className={styles.titleLine}>
              <h2 className={styles.title}>
                {isEditingSlide ? slideHeading : 'Edit Story'}
              </h2>
              {!isEditingSlide || presentationSettings.multiSlide ? (
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
        key={isEditingSlide ? `slide-${slide.id}` : 'story-overview'}
        className={styles.scroll}
      >
        {isEditingSlide ? (
          <SlideEditor
            slide={slide}
            filters={filters}
            multiSlide={presentationSettings.multiSlide}
            onSlideChange={patchSlide}
            onFiltersChange={onFiltersChange}
          />
        ) : (
          <>
            <MainContentTab
              storyTitle={storyTitle}
              presentationSettings={presentationSettings}
              onStoryTitleChange={onStoryTitleChange}
              onPresentationSettingsChange={onPresentationSettingsChange}
            />
            <SlidesOverview
              chapters={chapters}
              slides={slides}
              activeSlideIndex={activeSlideIndex}
              onSelectSlide={onSelectSlide}
              onEditSlide={(index) => {
                onSelectSlide(index)
                setMenuOpen(false)
                setIsEditingSlide(true)
              }}
              onDeleteSlide={(slideId) => onDeleteSlide(slideId)}
              onAddChapter={onAddChapter}
              onRenameChapter={onRenameChapter}
              onDeleteChapter={onDeleteChapter}
              onAddSlide={onAddSlide}
              multiSlide={presentationSettings.multiSlide}
            />
          </>
        )}
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
              {isEditingSlide ? (
                <>
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
                </>
              ) : (
                <>
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
                </>
              )}
            </div>,
            document.body,
          )
        : null}
    </aside>
  )
}

const LOGO_OPTIONS = [
  { value: 'dark', label: 'Dark Mode Logo (Default)' },
  { value: 'light', label: 'Light Mode Logo' },
] as const

function MainContentTab({
  storyTitle,
  presentationSettings,
  onStoryTitleChange,
  onPresentationSettingsChange,
}: {
  storyTitle: string
  presentationSettings: StoryPresentationSettings
  onStoryTitleChange: (value: string) => void
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
      <div className={styles.sectionHeading}>
        <h3 className={`${styles.sectionTitle} ${styles.sectionTitleLarge}`}>Story Configuration</h3>
      </div>
      <label className={styles.field}>
        <span className={styles.label}>Story title</span>
        <input
          className={styles.input}
          maxLength={100}
          value={storyTitle}
          onChange={(event) => onStoryTitleChange(event.target.value)}
        />
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
        </div>
      </div>
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
  chapters,
  slides,
  activeSlideIndex,
  onSelectSlide,
  onEditSlide,
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
  onSelectSlide: (index: number) => void
  onEditSlide: (index: number) => void
  onDeleteSlide: (slideId: string) => void
  onAddChapter: () => void
  onRenameChapter: (chapterId: string, title: string) => void
  onDeleteChapter: (chapterId: string) => void
  onAddSlide: (chapterId: string) => void
  multiSlide: boolean
}) {
  const [editingChapterId, setEditingChapterId] = useState<string | null>(null)
  const [chapterDraft, setChapterDraft] = useState('')
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
                        onClick={() => onSelectSlide(index)}
                        aria-current={index === activeSlideIndex ? 'true' : undefined}
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
                            className={styles.slideActionBtn}
                            onClick={() => onEditSlide(index)}
                            aria-label={`Edit slide ${chapterIndex + 1}: ${item.title}`}
                            title="Edit slide"
                          >
                            <PencilSimple size={15} aria-hidden />
                          </button>
                          <button
                            type="button"
                            className={`${styles.slideActionBtn} ${styles.slideActionDanger}`}
                            onClick={() => onDeleteSlide(item.id)}
                            aria-label={`Delete slide ${chapterIndex + 1}: ${item.title}`}
                            title="Delete slide"
                            disabled={slides.length === 1}
                          >
                            <Trash size={15} aria-hidden />
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
    </section>
  )
}

function SlideEditor({
  slide,
  filters,
  multiSlide,
  onSlideChange,
  onFiltersChange,
}: {
  slide: StorySlide
  filters: StoryFilter[]
  multiSlide: boolean
  onSlideChange: <K extends keyof StorySlide>(key: K, value: StorySlide[K]) => void
  onFiltersChange: (filters: StoryFilter[]) => void
}) {
  return (
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
