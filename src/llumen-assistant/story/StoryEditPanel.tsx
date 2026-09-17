import { useEffect, useState } from 'react'
import { ArrowCounterClockwise, ArrowLeft, Copy, Plus, Trash, X } from '@phosphor-icons/react'
import type { StoryFilter, StorySlide } from './storyDemoData'
import styles from './StoryEditPanel.module.css'

export type StoryEditPanelProps = {
  storyTitle: string
  storyDescription: string
  slides: StorySlide[]
  activeSlideIndex: number
  filters: StoryFilter[]
  onStoryTitleChange: (value: string) => void
  onStoryDescriptionChange: (value: string) => void
  onSelectSlide: (index: number) => void
  onSlideChange: (slide: StorySlide) => void
  onFiltersChange: (filters: StoryFilter[]) => void
  onAddSlide: () => void
  onDuplicateSlide: () => void
  onDeleteSlide: () => void
  onReset: () => void
  onClose: () => void
}

export function StoryEditPanel({
  storyTitle,
  storyDescription,
  slides,
  activeSlideIndex,
  filters,
  onStoryTitleChange,
  onStoryDescriptionChange,
  onSelectSlide,
  onSlideChange,
  onFiltersChange,
  onAddSlide,
  onDuplicateSlide,
  onDeleteSlide,
  onReset,
  onClose,
}: StoryEditPanelProps) {
  const [isEditingSlide, setIsEditingSlide] = useState(false)
  const slide = slides[activeSlideIndex]

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (isEditingSlide) {
        setIsEditingSlide(false)
        return
      }
      onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isEditingSlide, onClose])

  const patchSlide = <K extends keyof StorySlide>(key: K, value: StorySlide[K]) => {
    onSlideChange({ ...slide, [key]: value })
  }

  return (
    <aside id="story-edit-panel" className={styles.panel} aria-label="Story settings">
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
            <p className={styles.kicker}>
              {isEditingSlide ? `Slide ${activeSlideIndex + 1}` : 'Edit mode · Live preview'}
            </p>
            <h2 className={styles.title}>{isEditingSlide ? slide.title : 'Story builder'}</h2>
          </div>
        </div>
        <div className={styles.headerActions}>
          <button type="button" className={styles.iconBtn} onClick={onReset} title="Reset story">
            <ArrowCounterClockwise size={16} weight="bold" aria-hidden />
            <span>Reset</span>
          </button>
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
            onSlideChange={patchSlide}
            onFiltersChange={onFiltersChange}
            onDuplicateSlide={onDuplicateSlide}
            onDeleteSlide={() => {
              onDeleteSlide()
              setIsEditingSlide(false)
            }}
          />
        ) : (
          <>
            <MainContentTab
              storyTitle={storyTitle}
              storyDescription={storyDescription}
              onStoryTitleChange={onStoryTitleChange}
              onStoryDescriptionChange={onStoryDescriptionChange}
            />
            <SlidesOverview
              slides={slides}
              activeSlideIndex={activeSlideIndex}
              onSelectSlide={(index) => {
                onSelectSlide(index)
                setIsEditingSlide(true)
              }}
              onAddSlide={onAddSlide}
            />
          </>
        )}
      </div>
    </aside>
  )
}

function MainContentTab({
  storyTitle,
  storyDescription,
  onStoryTitleChange,
  onStoryDescriptionChange,
}: {
  storyTitle: string
  storyDescription: string
  onStoryTitleChange: (value: string) => void
  onStoryDescriptionChange: (value: string) => void
}) {
  return (
    <>
      <section className={styles.section}>
        <div className={styles.sectionHeading}>
          <div>
            <h3 className={styles.sectionTitle}>Main content</h3>
          </div>
        </div>
        <label className={styles.field}>
          <span className={styles.label}>Story title</span>
          <input
            className={styles.input}
            value={storyTitle}
            onChange={(event) => onStoryTitleChange(event.target.value)}
          />
        </label>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeading}>
          <div>
            <h3 className={styles.sectionTitle}>Description</h3>
          </div>
        </div>
        <label className={styles.field}>
          <span className={styles.label}>Description</span>
          <textarea
            className={styles.textarea}
            rows={5}
            value={storyDescription}
            onChange={(event) => onStoryDescriptionChange(event.target.value)}
          />
        </label>
      </section>
    </>
  )
}

function SlidesOverview({
  slides,
  activeSlideIndex,
  onSelectSlide,
  onAddSlide,
}: {
  slides: StorySlide[]
  activeSlideIndex: number
  onSelectSlide: (index: number) => void
  onAddSlide: () => void
}) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHeading}>
        <div>
          <h3 className={styles.sectionTitle}>Slides</h3>
        </div>
        <button type="button" className={styles.addBtn} onClick={onAddSlide}>
          <Plus size={15} weight="bold" aria-hidden />
          Add slide
        </button>
      </div>
      <div className={styles.slideList}>
        {slides.map((item, index) => (
          <button
            key={item.id}
            type="button"
            className={`${styles.slideItem}${
              index === activeSlideIndex ? ` ${styles.slideItemActive}` : ''
            }`}
            onClick={() => onSelectSlide(index)}
          >
            <span className={styles.slideNumber}>{index + 1}</span>
            <span className={styles.slideItemTitle}>{item.title}</span>
          </button>
        ))}
      </div>
    </section>
  )
}

function SlideEditor({
  slide,
  filters,
  slidesCount,
  onSlideChange,
  onFiltersChange,
  onDuplicateSlide,
  onDeleteSlide,
}: {
  slide: StorySlide
  filters: StoryFilter[]
  slidesCount: number
  onSlideChange: <K extends keyof StorySlide>(key: K, value: StorySlide[K]) => void
  onFiltersChange: (filters: StoryFilter[]) => void
  onDuplicateSlide: () => void
  onDeleteSlide: () => void
}) {
  return (
    <>
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

      <section className={styles.section}>
        <div className={styles.sectionHeading}>
          <div>
            <h3 className={styles.sectionTitle}>Content</h3>
          </div>
        </div>
        <label className={styles.field}>
          <span className={styles.label}>Heading</span>
          <input
            className={styles.input}
            value={slide.title}
            onChange={(event) => onSlideChange('title', event.target.value)}
          />
        </label>
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
