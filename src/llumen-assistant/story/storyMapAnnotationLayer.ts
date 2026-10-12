import mapboxgl from 'mapbox-gl'
import { DEMO_COLUMNS, DEMO_JUNCTIONS } from './storyDemoMapData'
import {
  annotationCollection,
  circleRing,
  closeRing,
  distanceM,
  labelAnchor,
  minimumPoints,
  type AnnotationGeometry,
  type AnnotationTool,
  type AnnotationValidity,
  type DrawnShape,
  type FeatureRef,
  type LngLat,
  type MapAnnotationItem,
} from './storyMapAnnotations'
import styles from './StoryMapAnnotations.module.css'

const SOURCE = 'story-user-annotations'
const DRAFT_SOURCE = 'story-user-annotations-draft'
const ARROW_IMAGE = 'story-user-annotation-arrowhead'
const DRAFT_COLOR = '#70aeff'
/** A click this close to a column or junction drops the point on that feature. */
const SNAP_PX = 14
/** A click this close to the last (or, for polygons, the first) point finishes the shape. */
const CLOSE_PX = 9
const HIT_PX = 6

export const ANNOTATION_HIT_LAYERS = [
  'story-user-annotation-fill',
  'story-user-annotation-area-line',
  'story-user-annotation-area-dash',
  'story-user-annotation-line',
  'story-user-annotation-dash',
  'story-user-annotation-arrow',
]
/** Areas sit on the ground below the story's heat disks and columns. */
const AREA_BEFORE_LAYER = 'story-junctions-halo'

const empty = () => ({ type: 'FeatureCollection' as const, features: [] })

function arrowheadImage() {
  const size = 48
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.moveTo(size / 2, 2)
  ctx.lineTo(size - 4, size - 4)
  ctx.lineTo(size / 2, size - 14)
  ctx.lineTo(4, size - 4)
  ctx.closePath()
  ctx.fill()
  return ctx.getImageData(0, 0, size, size)
}

/** Sources and layers for drawn annotations and the in-progress draft; safe to call after every style load. */
export function mountAnnotationLayers(map: mapboxgl.Map) {
  if (map.getSource(SOURCE)) return
  if (!map.hasImage(ARROW_IMAGE)) {
    const image = arrowheadImage()
    if (image) map.addImage(ARROW_IMAGE, image, { sdf: true, pixelRatio: 2 })
  }
  map.addSource(SOURCE, { type: 'geojson', data: empty() })
  map.addSource(DRAFT_SOURCE, { type: 'geojson', data: empty() })
  const faded = (value: number) => ['case', ['get', 'faded'], value * 0.4, value]
  const areaBefore = map.getLayer(AREA_BEFORE_LAYER) ? AREA_BEFORE_LAYER : undefined
  map.addLayer(
    {
      id: 'story-user-annotation-fill',
      type: 'fill',
      source: SOURCE,
      filter: ['==', ['geometry-type'], 'Polygon'],
      paint: {
        'fill-color': ['get', 'color'],
        'fill-opacity': ['*', ['get', 'fill'], ['case', ['get', 'faded'], 0.4, 1]],
      },
    },
    areaBefore,
  )
  for (const area of [true, false]) {
    for (const dashed of [false, true]) {
      map.addLayer(
        {
          id: `story-user-annotation-${area ? 'area-' : ''}${dashed ? 'dash' : 'line'}`,
          type: 'line',
          source: SOURCE,
          filter: [
            'all',
            ['==', ['geometry-type'], area ? 'Polygon' : 'LineString'],
            dashed ? ['get', 'dashed'] : ['!', ['get', 'dashed']],
          ],
          layout: { 'line-join': 'round', 'line-cap': dashed ? 'butt' : 'round' },
          paint: {
            'line-color': ['get', 'color'],
            'line-width': ['get', 'width'],
            'line-opacity': faded(1) as mapboxgl.ExpressionSpecification,
            ...(dashed ? { 'line-dasharray': [2, 1.6] } : {}),
          },
        },
        area ? areaBefore : undefined,
      )
    }
  }
  map.addLayer({
    id: 'story-user-annotation-arrow',
    type: 'symbol',
    source: SOURCE,
    filter: ['==', ['get', 'arrow'], true],
    layout: {
      'icon-image': ARROW_IMAGE,
      'icon-rotate': ['get', 'rotation'],
      'icon-rotation-alignment': 'map',
      'icon-pitch-alignment': 'map',
      'icon-anchor': 'top',
      'icon-offset': [0, -2],
      'icon-size': ['interpolate', ['linear'], ['get', 'width'], 2, 0.9, 5, 1.4],
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
    paint: { 'icon-color': ['get', 'color'], 'icon-opacity': faded(1) as mapboxgl.ExpressionSpecification },
  })
  map.addLayer({
    id: 'story-user-annotation-draft-fill',
    type: 'fill',
    source: DRAFT_SOURCE,
    filter: ['==', ['geometry-type'], 'Polygon'],
    paint: { 'fill-color': DRAFT_COLOR, 'fill-opacity': 0.14 },
  })
  map.addLayer({
    id: 'story-user-annotation-draft-line',
    type: 'line',
    source: DRAFT_SOURCE,
    filter: ['!=', ['geometry-type'], 'Point'],
    layout: { 'line-join': 'round' },
    paint: { 'line-color': DRAFT_COLOR, 'line-width': 2, 'line-dasharray': [2, 1.4] },
  })
  map.addLayer({
    id: 'story-user-annotation-draft-vertex',
    type: 'circle',
    source: DRAFT_SOURCE,
    filter: ['==', ['geometry-type'], 'Point'],
    paint: {
      'circle-radius': ['case', ['get', 'snapped'], 7, ['get', 'closing'], 7, 4.5],
      'circle-color': ['case', ['get', 'cursor'], 'rgba(112, 174, 255, 0.35)', '#ffffff'],
      'circle-stroke-color': ['case', ['get', 'snapped'], '#ffb547', DRAFT_COLOR],
      'circle-stroke-width': 2,
      'circle-pitch-alignment': 'map',
    },
  })
}

function setSource(map: mapboxgl.Map, id: string, data: unknown) {
  ;(map.getSource(id) as mapboxgl.GeoJSONSource | undefined)?.setData(data as GeoJSON.FeatureCollection)
}

export function drawAnnotations(
  map: mapboxgl.Map,
  items: MapAnnotationItem[],
  selectedId: string | null,
  validity: Record<string, AnnotationValidity>,
) {
  setSource(map, SOURCE, annotationCollection(items, selectedId, validity))
}

/** The annotation under a map point, from its line, fill or arrowhead. */
export function annotationAt(map: mapboxgl.Map, point: mapboxgl.Point): string | null {
  if (!map.getLayer(ANNOTATION_HIT_LAYERS[0])) return null
  const hits = map.queryRenderedFeatures(
    [
      [point.x - HIT_PX, point.y - HIT_PX],
      [point.x + HIT_PX, point.y + HIT_PX],
    ],
    { layers: ANNOTATION_HIT_LAYERS },
  )
  // Lines and arrowheads win over the fill they sit on, so a line drawn inside an area stays selectable.
  const hit = hits.find((feature) => feature.layer?.type !== 'fill') ?? hits[0]
  const id = hit?.properties?.id
  return typeof id === 'string' ? id : null
}

const SVG_NS = 'http://www.w3.org/2000/svg'

function el(tag: string, className: string, text?: string) {
  const node = document.createElement(tag)
  node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

function pinSvg() {
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('viewBox', '0 0 24 30')
  svg.setAttribute('aria-hidden', 'true')
  const body = document.createElementNS(SVG_NS, 'path')
  body.setAttribute('d', 'M12 1C6.2 1 1.5 5.6 1.5 11.3 1.5 19 12 29 12 29s10.5-10 10.5-17.7C22.5 5.6 17.8 1 12 1z')
  body.setAttribute('class', styles.pinBody)
  const dot = document.createElementNS(SVG_NS, 'circle')
  dot.setAttribute('cx', '12')
  dot.setAttribute('cy', '11.3')
  dot.setAttribute('r', '4')
  dot.setAttribute('class', styles.pinDot)
  svg.append(body, dot)
  return svg
}

const STATUS_CLASS: Record<string, string> = { changed: styles.statusChanged, invalid: styles.statusInvalid }

function markerElement(item: MapAnnotationItem, validity: AnnotationValidity | undefined) {
  const root = el('div', styles.marker)
  if (item.style.text) {
    const card = el('div', styles.markerCard)
    card.append(el('span', styles.markerCardText, item.style.text))
    root.append(card, el('span', styles.markerStem))
  }
  const shape = el('span', `${styles.shape} ${styles[`shape_${item.style.markerShape}`] ?? ''}`)
  if (item.style.markerShape === 'pin') shape.append(pinSvg())
  const status = validity && STATUS_CLASS[validity.state]
  if (status) shape.append(el('span', `${styles.status} ${status}`))
  root.append(shape)
  return root
}

function pillElement(item: MapAnnotationItem, validity: AnnotationValidity | undefined) {
  const pill = el('div', styles.pill)
  pill.append(el('span', styles.pillDot), el('span', styles.pillText, item.style.text))
  const status = validity && STATUS_CLASS[validity.state]
  if (status) pill.append(el('span', `${styles.status} ${styles.pillStatus} ${status}`))
  return pill
}

type LabelEntry = { marker: mapboxgl.Marker; signature: string }

/** DOM labels: every marker, plus the text pill of any other annotation that has text. */
export class AnnotationLabels {
  private entries = new Map<string, LabelEntry>()
  private seen = new Set<string>()
  private map: mapboxgl.Map
  private onSelect: () => ((id: string) => void) | undefined

  constructor(map: mapboxgl.Map, onSelect: () => ((id: string) => void) | undefined) {
    this.map = map
    this.onSelect = onSelect
  }

  sync(
    items: MapAnnotationItem[],
    selectedId: string | null,
    validity: Record<string, AnnotationValidity>,
    selectable: boolean,
  ) {
    const keep = new Set<string>()
    for (const item of items) {
      const isMarker = item.geometry.type === 'Point'
      if (!item.visible || (!isMarker && !item.style.text)) continue
      keep.add(item.id)
      const selected = item.id === selectedId
      const state = validity[item.id]
      const at = labelAnchor(item)
      const signature = JSON.stringify([item.style, at, selected, state?.state, isMarker, selectable])
      const current = this.entries.get(item.id)
      if (current?.signature === signature) continue
      current?.marker.remove()
      const node = isMarker ? markerElement(item, state) : pillElement(item, state)
      node.style.setProperty('--annotation-color', item.style.color)
      node.classList.toggle(styles.selected, selected)
      node.classList.toggle(styles.faded, state?.state === 'invalid')
      node.classList.toggle(styles.readOnly, !selectable)
      if (!this.seen.has(item.id)) node.classList.add(styles.entering)
      this.seen.add(item.id)
      node.addEventListener('click', (event) => {
        event.stopPropagation()
        this.onSelect()?.(item.id)
      })
      const marker = new mapboxgl.Marker({
        element: node,
        anchor: isMarker ? 'bottom' : 'center',
        offset: isMarker && item.style.markerShape !== 'pin' ? [0, 8] : [0, 0],
      })
        .setLngLat(at)
        .addTo(this.map)
      this.entries.set(item.id, { marker, signature })
    }
    for (const [id, entry] of this.entries) {
      if (keep.has(id)) continue
      entry.marker.remove()
      this.entries.delete(id)
    }
  }

  destroy() {
    for (const entry of this.entries.values()) entry.marker.remove()
    this.entries.clear()
  }
}

export type AnnotationDrawing = {
  finish: () => void
  undo: () => void
  cancel: () => void
  /** Removes listeners and the draft without reporting back. */
  destroy: () => void
}

type DrawingOptions = {
  snapLayers: { columns: boolean; junctions: boolean }
  onProgress: (points: number) => void
  onComplete: (shape: DrawnShape) => void
  onCancel: () => void
}

type DraftFeature = { type: 'Feature'; properties: Record<string, boolean>; geometry: AnnotationGeometry }

const toLngLat = (value: mapboxgl.LngLat): LngLat => [value.lng, value.lat]

/** Starts an interactive drawing session for one tool on the map. */
export function startAnnotationDrawing(map: mapboxgl.Map, tool: AnnotationTool, options: DrawingOptions): AnnotationDrawing {
  const points: LngLat[] = []
  const snaps: (FeatureRef | null)[] = []
  let cursor: { at: LngLat; snapped: boolean } | null = null
  let done = false
  const canvas = map.getCanvas()
  const container = map.getContainer()
  const zoomOnDoubleClick = map.doubleClickZoom.isEnabled()
  map.doubleClickZoom.disable()
  container.classList.add(styles.drawing)
  canvas.style.cursor = 'crosshair'
  const snapping = tool === 'marker' || tool === 'line' || tool === 'arrow'

  const snapAt = (point: mapboxgl.Point): { ref: FeatureRef; at: LngLat } | null => {
    if (!snapping) return null
    let best: { ref: FeatureRef; at: LngLat; distance: number } | null = null
    const consider = (list: [number, number, number][], layer: FeatureRef['layer']) => {
      list.forEach(([lng, lat], index) => {
        const projected = map.project([lng, lat])
        const distance = Math.hypot(projected.x - point.x, projected.y - point.y)
        if (distance <= SNAP_PX && (!best || distance < best.distance)) best = { ref: { layer, index }, at: [lng, lat], distance }
      })
    }
    if (options.snapLayers.junctions) consider(DEMO_JUNCTIONS, 'junctions')
    if (options.snapLayers.columns) consider(DEMO_COLUMNS, 'columns')
    return best
  }

  const pixelsBetween = (a: LngLat, b: LngLat) => {
    const pa = map.project(a)
    const pb = map.project(b)
    return Math.hypot(pa.x - pb.x, pa.y - pb.y)
  }

  /** The rectangle that is upright on screen, stored as a geographic ring. */
  const rectangleRing = (a: LngLat, b: LngLat): LngLat[] => {
    const pa = map.project(a)
    const pb = map.project(b)
    const corners: [number, number][] = [
      [pa.x, pa.y],
      [pb.x, pa.y],
      [pb.x, pb.y],
      [pa.x, pb.y],
    ]
    return closeRing(corners.map((corner) => toLngLat(map.unproject(corner))))
  }

  const draft = (): DraftFeature[] => {
    const features: DraftFeature[] = []
    const shape = (geometry: AnnotationGeometry) => features.push({ type: 'Feature', properties: {}, geometry })
    const live = cursor ? [...points, cursor.at] : points
    if ((tool === 'line' || tool === 'arrow') && live.length >= 2) shape({ type: 'LineString', coordinates: live })
    if (tool === 'polygon' && live.length >= 2) {
      if (live.length >= 3) shape({ type: 'Polygon', coordinates: [closeRing(live)] })
      shape({ type: 'LineString', coordinates: live })
    }
    if (tool === 'rectangle' && points.length === 1 && cursor) {
      shape({ type: 'Polygon', coordinates: [rectangleRing(points[0], cursor.at)] })
    }
    if (tool === 'circle' && points.length === 1 && cursor) {
      shape({ type: 'Polygon', coordinates: [circleRing(points[0], distanceM(points[0], cursor.at))] })
      shape({ type: 'LineString', coordinates: [points[0], cursor.at] })
    }
    points.forEach((point, index) => {
      const closing = tool === 'polygon' && index === 0 && points.length >= 3
      features.push({ type: 'Feature', properties: { closing, snapped: Boolean(snaps[index]) }, geometry: { type: 'Point', coordinates: point } })
    })
    if (cursor) {
      features.push({
        type: 'Feature',
        properties: { cursor: true, snapped: cursor.snapped },
        geometry: { type: 'Point', coordinates: cursor.at },
      })
    }
    return features
  }

  const render = () => setSource(map, DRAFT_SOURCE, { type: 'FeatureCollection', features: draft() })

  const cleanup = () => {
    if (done) return
    done = true
    map.off('mousemove', onMove)
    map.off('click', onClick)
    window.removeEventListener('keydown', onKey, true)
    setSource(map, DRAFT_SOURCE, empty())
    container.classList.remove(styles.drawing)
    canvas.style.cursor = ''
    if (zoomOnDoubleClick) map.doubleClickZoom.enable()
  }

  const complete = (geometry: AnnotationGeometry, extra?: Pick<DrawnShape, 'circle'>) => {
    const refs = snaps.filter((ref): ref is FeatureRef => ref !== null)
    const unique = refs.filter((ref, index) => refs.findIndex((other) => other.layer === ref.layer && other.index === ref.index) === index)
    cleanup()
    options.onComplete({ tool, geometry, snaps: unique, ...extra })
  }

  const finish = () => {
    if (done || points.length < minimumPoints(tool)) return
    if (tool === 'polygon') complete({ type: 'Polygon', coordinates: [closeRing(points)] })
    else if (tool === 'line' || tool === 'arrow') complete({ type: 'LineString', coordinates: [...points] })
  }

  const undo = () => {
    if (done || points.length === 0) return
    points.pop()
    snaps.pop()
    options.onProgress(points.length)
    render()
  }

  const cancel = () => {
    if (done) return
    cleanup()
    options.onCancel()
  }

  function onMove(event: mapboxgl.MapMouseEvent) {
    const snap = snapAt(event.point)
    cursor = { at: snap?.at ?? toLngLat(event.lngLat), snapped: Boolean(snap) }
    render()
  }

  function onClick(event: mapboxgl.MapMouseEvent) {
    const snap = snapAt(event.point)
    const at = snap?.at ?? toLngLat(event.lngLat)
    if (tool === 'marker') {
      snaps.push(snap?.ref ?? null)
      complete({ type: 'Point', coordinates: at })
      return
    }
    if (tool === 'rectangle' || tool === 'circle') {
      if (points.length === 0) {
        points.push(at)
        snaps.push(null)
        options.onProgress(1)
        render()
        return
      }
      if (pixelsBetween(points[0], at) < CLOSE_PX) return
      if (tool === 'rectangle') complete({ type: 'Polygon', coordinates: [rectangleRing(points[0], at)] })
      else {
        const radiusM = distanceM(points[0], at)
        complete({ type: 'Polygon', coordinates: [circleRing(points[0], radiusM)] }, { circle: { center: points[0], radiusM } })
      }
      return
    }
    const last = points[points.length - 1]
    if (tool === 'polygon' && points.length >= 3 && pixelsBetween(points[0], at) <= CLOSE_PX) return finish()
    if (last && pixelsBetween(last, at) <= CLOSE_PX) return finish()
    points.push(at)
    snaps.push(snap?.ref ?? null)
    options.onProgress(points.length)
    render()
  }

  function onKey(event: KeyboardEvent) {
    const { target } = event
    if (target instanceof Element && target.closest('input, textarea, select, [contenteditable="true"]')) return
    if (event.key === 'Escape') {
      event.stopImmediatePropagation()
      cancel()
    } else if (event.key === 'Enter') {
      event.preventDefault()
      finish()
    } else if (event.key === 'Backspace' || event.key === 'Delete') {
      event.preventDefault()
      undo()
    }
  }

  map.on('mousemove', onMove)
  map.on('click', onClick)
  window.addEventListener('keydown', onKey, true)
  options.onProgress(0)
  return { finish, undo, cancel, destroy: cleanup }
}
