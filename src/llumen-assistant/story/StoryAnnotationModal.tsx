import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowUpRight, Circle, LineSegments, MapPin, Polygon, Rectangle, X, type Icon } from '@phosphor-icons/react'
import { ANNOTATION_TOOLS, type AnnotationTool } from './storyMapAnnotations'
import panel from './StoryEditPanel.module.css'
import styles from './StoryAnnotations.module.css'

const TOOL_ICONS: Record<AnnotationTool, Icon> = {
  marker: MapPin,
  line: LineSegments,
  arrow: ArrowUpRight,
  polygon: Polygon,
  rectangle: Rectangle,
  circle: Circle,
}

export function StoryAnnotationModal({
  onStart,
  onClose,
}: {
  onStart: (tool: AnnotationTool) => void
  onClose: () => void
}) {
  const [selected, setSelected] = useState<AnnotationTool>('marker')

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return createPortal(
    <div className={panel.modalRoot}>
      <button type="button" className={panel.modalBackdrop} aria-label="Close" onClick={onClose} />
      <div
        className={`${panel.panel} ${panel.modal} ${styles.modal}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="story-annotation-modal-title"
        dir="ltr"
      >
        <header className={panel.header}>
          <div className={panel.headerIdentity}>
            <div className={panel.headerCopy}>
              <h2 id="story-annotation-modal-title" className={panel.title}>
                Add annotation
              </h2>
              <p className={styles.modalSubtitle}>
                Annotations mark places, routes and areas on the map. They don’t change the map data underneath.
              </p>
            </div>
          </div>
          <div className={panel.headerActions}>
            <button type="button" className={panel.closeBtn} onClick={onClose} aria-label="Close">
              <X size={18} weight="bold" aria-hidden />
            </button>
          </div>
        </header>
        <div className={styles.toolGrid} role="radiogroup" aria-label="Annotation type">
          {ANNOTATION_TOOLS.map((tool) => {
            const ToolIcon = TOOL_ICONS[tool.id]
            return (
              <button
                key={tool.id}
                type="button"
                role="radio"
                aria-checked={selected === tool.id}
                className={`${styles.toolCard}${selected === tool.id ? ` ${styles.toolCardSelected}` : ''}`}
                onClick={() => setSelected(tool.id)}
                onDoubleClick={() => onStart(tool.id)}
              >
                <span className={styles.toolPreview} aria-hidden>
                  <ToolIcon size={40} weight="duotone" />
                </span>
                <span className={styles.toolCopy}>
                  <span className={styles.toolName}>{tool.label}</span>
                  <span className={styles.toolDesc}>{tool.description}</span>
                </span>
              </button>
            )
          })}
        </div>
        <footer className={`${panel.mapStyleFooter} ${styles.modalFooter}`}>
          <span className={styles.modalNote}>The map switches to 2D while you draw, then returns to its view.</span>
          <button type="button" className={panel.secondaryBtn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={panel.assetsNext} onClick={() => onStart(selected)}>
            Start drawing
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  )
}
