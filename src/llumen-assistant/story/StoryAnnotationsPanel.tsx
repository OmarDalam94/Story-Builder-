import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowCounterClockwise,
  ArrowLeft,
  ArrowUpRight,
  Circle,
  Eye,
  EyeSlash,
  Info,
  LineSegments,
  MapPin,
  PencilSimple,
  Plus,
  Polygon,
  Rectangle,
  Trash,
} from '@phosphor-icons/react'
import { ColorPicker } from './StoryColorPicker'
import { Field, Segmented, Slider } from './StoryBackgroundSettings'
import {
  annotationTool,
  contextSummary,
  MARKER_SHAPES,
  minimumPoints,
  STROKE_STYLES,
  STROKE_WIDTHS,
  type AnnotationStyle,
  type AnnotationTool,
  type AnnotationValidity,
  type MapAnnotationItem,
} from './storyMapAnnotations'
import settings from './StoryBackground.module.css'
import styles from './StoryAnnotations.module.css'

export type AnnotationDrawingState = { tool: AnnotationTool; points: number; redrawId: string | null }

const TOOL_ICONS: Record<AnnotationTool, (size: number) => ReactNode> = {
  marker: (size) => <MapPin size={size} weight="fill" aria-hidden />,
  line: (size) => <LineSegments size={size} weight="bold" aria-hidden />,
  arrow: (size) => <ArrowUpRight size={size} weight="bold" aria-hidden />,
  polygon: (size) => <Polygon size={size} weight="bold" aria-hidden />,
  rectangle: (size) => <Rectangle size={size} weight="bold" aria-hidden />,
  circle: (size) => <Circle size={size} weight="bold" aria-hidden />,
}

const STATE_LABELS = { valid: 'Valid', changed: 'Changed', invalid: 'Invalid' }

const STATE_CLASS = { valid: styles.stateValid, changed: styles.stateChanged, invalid: styles.stateInvalid }

const DRAW_STEP: Record<AnnotationTool, (points: number) => string> = {
  marker: () => 'Click the map to place the marker.',
  line: (points) => (points === 0 ? 'Click the map to start the line.' : 'Click to add a point.'),
  arrow: (points) => (points === 0 ? 'Click where the arrow starts.' : 'Click to add a point; the arrow ends at the last one.'),
  polygon: (points) => (points < 3 ? 'Click to add corners.' : 'Click the first corner to close the area.'),
  rectangle: (points) => (points === 0 ? 'Click one corner of the rectangle.' : 'Click the opposite corner.'),
  circle: (points) => (points === 0 ? 'Click the centre of the circle.' : 'Click to set the radius.'),
}

function formatMeters(value: number) {
  return value >= 1000 ? `${(value / 1000).toFixed(value >= 10000 ? 0 : 2)} km` : `${Math.round(value)} m`
}

function textPlaceholder(tool: AnnotationTool) {
  return tool === 'marker' ? 'Shown in a tooltip above the marker' : 'Shown in a pill at the centre'
}

type PanelProps = {
  items: MapAnnotationItem[]
  validity: Record<string, AnnotationValidity>
  selectedId: string | null
  editable: boolean
  drawing: AnnotationDrawingState | null
  onAdd: () => void
  onSelect: (id: string | null) => void
  onChange: (id: string, patch: Partial<Pick<MapAnnotationItem, 'name' | 'visible'>> & { style?: Partial<AnnotationStyle> }) => void
  onDelete: (id: string) => void
  onRedraw: (id: string) => void
  onFinishDrawing: () => void
  onUndoDrawing: () => void
  onCancelDrawing: () => void
}

function StateChip({ validity }: { validity: AnnotationValidity }) {
  return (
    <span className={`${styles.stateChip} ${STATE_CLASS[validity.state]}`}>
      <i aria-hidden />
      {STATE_LABELS[validity.state]}
    </span>
  )
}

const CONTEXT_TIP_GAP = 8

/** Status at a glance; the info icon reveals what the annotation refers to and why it has that status. */
function DataContext({ item, validity }: { item: MapAnnotationItem; validity: AnnotationValidity | undefined }) {
  const tipId = useId()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [anchor, setAnchor] = useState<DOMRect | null>(null)
  const open = () => setAnchor(buttonRef.current?.getBoundingClientRect() ?? null)
  const close = () => setAnchor(null)

  useEffect(() => {
    if (!anchor) return
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [anchor])

  const refersLabel =
    item.context.anchor === 'feature' ? 'Pinned to' : item.geometry.type === 'Polygon' ? 'Covers' : 'Refers to'

  return (
    <div className={styles.context}>
      <span className={styles.contextTitle}>Data context</span>
      {validity ? <StateChip validity={validity} /> : null}
      <button
        ref={buttonRef}
        type="button"
        className={styles.contextInfoBtn}
        aria-label="Data context details"
        aria-describedby={anchor ? tipId : undefined}
        onMouseEnter={open}
        onMouseLeave={close}
        onFocus={open}
        onBlur={close}
      >
        <Info size={16} weight="regular" aria-hidden />
      </button>
      {anchor
        ? createPortal(
            <div
              id={tipId}
              role="tooltip"
              className={styles.contextTip}
              style={{ right: window.innerWidth - anchor.right, bottom: window.innerHeight - anchor.top + CONTEXT_TIP_GAP }}
            >
              {validity ? <p className={styles.contextDetail}>{validity.detail}</p> : null}
              <div className={styles.metaRow}>
                <span>{refersLabel}</span>
                <b>{contextSummary(item.context)}</b>
              </div>
              <div className={styles.metaRow}>
                <span>Drawn on</span>
                <b>{item.context.dataLabel}</b>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}

function DrawingView({
  drawing,
  redrawing,
  onFinish,
  onUndo,
  onCancel,
}: {
  drawing: AnnotationDrawingState
  redrawing: string | null
  onFinish: () => void
  onUndo: () => void
  onCancel: () => void
}) {
  const tool = annotationTool(drawing.tool)
  const multiPoint = drawing.tool === 'line' || drawing.tool === 'arrow' || drawing.tool === 'polygon'
  const canFinish = drawing.points >= minimumPoints(drawing.tool)
  return (
    <div className={styles.drawing} role="status" aria-live="polite">
      <div className={styles.drawingHead}>
        <span className={styles.drawingIcon}>{TOOL_ICONS[drawing.tool](16)}</span>
        <span className={styles.drawingTitle}>{redrawing ? `Redrawing ${redrawing}` : `Drawing ${tool.label.toLowerCase()}`}</span>
        <span className={styles.drawingBadge}>2D</span>
      </div>
      <p className={styles.drawingStep}>{DRAW_STEP[drawing.tool](drawing.points)}</p>
      <p className={styles.drawingHint}>
        {multiPoint ? 'Enter finishes · Backspace removes the last point · Esc cancels' : 'Esc cancels'}
        {drawing.tool === 'marker' || drawing.tool === 'line' || drawing.tool === 'arrow'
          ? '. Points snap to columns and junctions.'
          : ''}
      </p>
      <div className={styles.drawingActions}>
        <button type="button" className={settings.pillBtn} onClick={onCancel}>
          Cancel
        </button>
        {multiPoint ? (
          <>
            <button type="button" className={settings.pillBtn} disabled={drawing.points === 0} onClick={onUndo}>
              <ArrowCounterClockwise size={14} weight="bold" aria-hidden />
              Undo
            </button>
            <button type="button" className={styles.primaryPill} disabled={!canFinish} onClick={onFinish}>
              Finish
            </button>
          </>
        ) : null}
      </div>
    </div>
  )
}

function Properties({
  item,
  validity,
  onBack,
  onChange,
  onDelete,
  onRedraw,
}: {
  item: MapAnnotationItem
  validity: AnnotationValidity | undefined
  onBack: () => void
  onChange: PanelProps['onChange']
  onDelete: () => void
  onRedraw: () => void
}) {
  const { style, tool } = item
  const setStyle = (patch: Partial<AnnotationStyle>) => onChange(item.id, { style: patch })
  const isArea = item.geometry.type === 'Polygon'
  const isLine = item.geometry.type === 'LineString'
  return (
    <div className={styles.properties}>
      <div className={styles.propertiesHead}>
        <button type="button" className={styles.circleBtn} aria-label="Back to annotations" onClick={onBack}>
          <ArrowLeft size={16} weight="bold" aria-hidden />
        </button>
        <input
          className={styles.nameInput}
          aria-label="Annotation name"
          value={item.name}
          onChange={(event) => onChange(item.id, { name: event.target.value })}
        />
      </div>

      <Field label="Text">
        <textarea
          className={styles.textInput}
          rows={2}
          aria-label="Annotation text"
          placeholder={textPlaceholder(tool)}
          value={style.text}
          onChange={(event) => setStyle({ text: event.target.value })}
        />
      </Field>
      <Field label="Color">
        <ColorPicker label="Annotation color" value={style.color} variant="palette" onChange={(color) => setStyle({ color })} />
      </Field>
      {tool === 'marker' ? (
        <Field label="Shape">
          <Segmented
            label="Marker shape"
            value={style.markerShape}
            options={MARKER_SHAPES}
            onChange={(markerShape) => setStyle({ markerShape })}
          />
        </Field>
      ) : null}
      {isLine || isArea ? (
        <>
          <Field label={isArea ? 'Outline' : 'Width'}>
            <Segmented
              label={isArea ? 'Outline width' : 'Line width'}
              value={style.strokeWidth}
              options={STROKE_WIDTHS}
              onChange={(strokeWidth) => setStyle({ strokeWidth })}
            />
          </Field>
          <Field label="Style">
            <Segmented
              label="Line style"
              value={style.dashed ? 'dashed' : 'solid'}
              options={STROKE_STYLES}
              onChange={(value) => setStyle({ dashed: value === 'dashed' })}
            />
          </Field>
        </>
      ) : null}
      {isArea ? (
        <Field label="Fill">
          <Slider
            label="Fill opacity"
            value={style.fillOpacity}
            min={0}
            max={0.6}
            step={0.02}
            display={`${Math.round(style.fillOpacity * 100)}%`}
            onChange={(fillOpacity) => setStyle({ fillOpacity })}
          />
        </Field>
      ) : null}
      {item.circle ? (
        <div className={styles.metaRow}>
          <span>Radius</span>
          <b>{formatMeters(item.circle.radiusM)}</b>
        </div>
      ) : null}

      <DataContext item={item} validity={validity} />

      <div className={styles.propertiesActions}>
        <button
          type="button"
          className={`${styles.circleBtn} ${styles.circleBtnDanger}`}
          aria-label="Delete"
          title="Delete"
          onClick={onDelete}
        >
          <Trash size={16} weight="bold" aria-hidden />
        </button>
        <button type="button" className={settings.pillBtn} onClick={onRedraw}>
          <PencilSimple size={14} weight="bold" aria-hidden />
          Redraw
        </button>
        <button type="button" className={`${styles.primaryPill} ${styles.saveBtn}`} onClick={onBack}>
          Save
        </button>
      </div>
    </div>
  )
}

/** The Annotations tab of the Map Data panel: list, drawing status and the selected annotation's properties. */
export function StoryAnnotationsPanel({
  items,
  validity,
  selectedId,
  editable,
  drawing,
  onAdd,
  onSelect,
  onChange,
  onDelete,
  onRedraw,
  onFinishDrawing,
  onUndoDrawing,
  onCancelDrawing,
}: PanelProps) {
  if (drawing) {
    const redrawing = drawing.redrawId ? (items.find((item) => item.id === drawing.redrawId)?.name ?? null) : null
    return (
      <div className={styles.body}>
        <DrawingView
          drawing={drawing}
          redrawing={redrawing}
          onFinish={onFinishDrawing}
          onUndo={onUndoDrawing}
          onCancel={onCancelDrawing}
        />
      </div>
    )
  }

  const selected = editable ? items.find((item) => item.id === selectedId) : undefined
  if (selected) {
    return (
      <div className={styles.body}>
        <Properties
          item={selected}
          validity={validity[selected.id]}
          onBack={() => onSelect(null)}
          onChange={onChange}
          onDelete={() => onDelete(selected.id)}
          onRedraw={() => onRedraw(selected.id)}
        />
      </div>
    )
  }

  return (
    <div className={styles.scroll}>
      <div className={styles.body}>
        {items.length === 0 ? (
          <p className={styles.empty}>
            {editable
              ? 'Mark places, routes and areas on the map. Annotations sit on top of the data and never change it.'
              : 'No annotations on this map.'}
          </p>
        ) : (
          <ul className={styles.list}>
            {items.map((item) => {
              const state = validity[item.id]
              return (
                <li key={item.id} className={`${styles.row}${item.visible ? '' : ` ${styles.rowHidden}`}`}>
                  <button
                    type="button"
                    className={styles.rowMain}
                    disabled={!editable}
                    onClick={() => onSelect(item.id)}
                    aria-label={editable ? `Edit ${item.name}` : item.name}
                  >
                    <span className={styles.itemIcon} style={{ color: item.style.color }}>
                      {TOOL_ICONS[item.tool](16)}
                    </span>
                    <span className={styles.rowCopy}>
                      <span className={styles.rowName}>{item.name}</span>
                      <span className={styles.rowMeta}>{item.style.text || contextSummary(item.context)}</span>
                    </span>
                    {state && state.state !== 'valid' ? (
                      <span
                        className={`${styles.rowState} ${STATE_CLASS[state.state]}`}
                        title={state.detail}
                        aria-label={STATE_LABELS[state.state]}
                      />
                    ) : null}
                  </button>
                  <button
                    type="button"
                    className={`${styles.iconBtn}${item.visible ? '' : ` ${styles.iconBtnOff}`}`}
                    aria-label={`${item.visible ? 'Hide' : 'Show'} ${item.name}`}
                    aria-pressed={item.visible}
                    onClick={() => onChange(item.id, { visible: !item.visible })}
                  >
                    {item.visible ? <Eye size={16} weight="regular" aria-hidden /> : <EyeSlash size={16} weight="regular" aria-hidden />}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        {editable ? (
          <button type="button" className={styles.addBtn} onClick={onAdd}>
            <Plus size={16} weight="bold" aria-hidden />
            Annotation
          </button>
        ) : null}
      </div>
    </div>
  )
}
