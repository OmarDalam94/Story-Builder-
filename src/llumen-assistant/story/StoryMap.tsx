/**
 * Real Mapbox map for Story view with the demo Abu Dhabi overlay:
 * value-distribution columns and monitored-junction disks, varied per slide scene.
 */
import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { MapControls, type InteractiveMapHandle } from '../InteractiveMap'
import { DEMO_COLUMNS, DEMO_JUNCTIONS } from './storyDemoMapData'
import {
  mixSceneState,
  rampColor,
  rgbString,
  sceneAtPhase,
  sceneState,
  storySceneAt,
  type StorySceneCamera,
  type StorySceneState,
} from './storyDemoScenes'
import {
  regionColumnHeights,
  regionJunctionRadii,
  type StoryAreaEffect,
  type StoryMapCapture,
  type StoryMapRegion,
} from './storyAiScenarios'
import type { StoryCamera, StoryCameraLink } from './storyCameraLink'
import styles from './StoryMap.module.css'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN ?? ''
const MAPBOX_STYLE = 'mapbox://styles/pixonal/cmgnqbyjf005g01sh9s510hi2'
export const STORY_MAP_STYLE = MAPBOX_STYLE
/** Keeps the demo overlay clear of the 380px insight column. */
const CAMERA_PADDING = { top: 0, right: 0, bottom: 0, left: 400 }
const CAMERA_DURATION_MS = 2600
const SCENE_TWEEN_MS = 1800
const REGION_FLY_MS = 3200
const REGION_FLY_DELAY_MS = 120
const REGION_GROW_MS = 4400
const AREA_TWEEN_MS = 1900

export type StoryMapLayerVisibility = {
  junctions: boolean
  distribution: boolean
}

export type StoryMapHandle = {
  /** Map coordinate under a viewport point, as `[lng, lat]`. */
  unproject: (clientX: number, clientY: number) => [number, number]
  /** Thumbnail of the visible (unpadded) map area plus the camera that produced it. */
  capture: () => Promise<StoryMapCapture>
}

const CAPTURE_WIDTH = 560
const CAPTURE_ASPECT = 2.2

function captureMapView(map: mapboxgl.Map): StoryMapCapture {
  const canvas = map.getCanvas()
  const ratio = canvas.width / Math.max(1, canvas.clientWidth)
  const { top: padTop = 0, right: padRight = 0, bottom: padBottom = 0, left: padLeft = 0 } = map.getPadding()
  const left = padLeft * ratio
  const width = Math.max(1, canvas.width - left - padRight * ratio)
  const height = Math.min(canvas.height, width / CAPTURE_ASPECT)
  const centerY = ((padTop + (canvas.clientHeight - padBottom)) / 2) * ratio
  const top = Math.max(0, Math.min(canvas.height - height, centerY - height / 2))
  const out = document.createElement('canvas')
  out.width = CAPTURE_WIDTH
  out.height = Math.round(CAPTURE_WIDTH / CAPTURE_ASPECT)
  out.getContext('2d')?.drawImage(canvas, left, top, width, height, 0, 0, out.width, out.height)
  const center = map.getCenter()
  return {
    image: out.toDataURL('image/jpeg', 0.74),
    camera: {
      center: [center.lng, center.lat],
      zoom: map.getZoom(),
      pitch: map.getPitch(),
      bearing: map.getBearing(),
    },
  }
}

export type StoryMapProps = {
  className?: string
  controlsClassName?: string
  layers?: StoryMapLayerVisibility
  /** Index of the demo scene (camera, columns, disks) to show. */
  sceneIndex?: number
  /** Position (0…1) within the slide's time-series loop. */
  framePhase?: number
  /** Tween length for frame changes; linear keeps continuous playback smooth. */
  frameDuration?: number
  frameLinear?: boolean
  styleUrl?: string
  /** Turn off for previews; also hides the zoom controls. */
  interactive?: boolean
  /** Applied once when the map mounts. */
  cameraPadding?: mapboxgl.PaddingOptions
  /** Added to each scene's zoom so small previews frame the same area. */
  zoomOffset?: number
  /**
   * For a map taller than its clipping parent (anchored to the parent's top): pads the
   * hidden bottom so the camera stays centered in the visible part without resizing.
   */
  fitParentHeight?: boolean
  /** Shares the camera with the other maps on the same link. */
  cameraLink?: StoryCameraLink
  /** Off for maps that take their camera from a link instead of their own scene. */
  flyToScene?: boolean
  /** Focus region whose columns and disks grow in while the main overlay sinks away. */
  region?: StoryMapRegion | null
  /** Rescales the columns and disks inside a selected map area. */
  areaEffect?: StoryAreaEffect | null
  /** A new object flies the camera to `camera` (raw zoom, no offset applied). */
  cameraRequest?: { camera: StorySceneCamera } | null
  onHandle?: (handle: StoryMapHandle | null) => void
}

const DEFAULT_LAYERS: StoryMapLayerVisibility = {
  junctions: true,
  distribution: true,
}

const JUNCTION_LAYERS = [
  'story-junctions-halo',
  'story-junctions',
  'story-region-junctions-halo',
  'story-region-junctions',
]
const COLUMN_LAYERS = ['story-columns', 'story-region-columns']
const COLUMN_RADIUS_M = 36

function ring(lng: number, lat: number, radiusMeters: number, sides: number) {
  const dLat = radiusMeters / 111320
  const dLng = radiusMeters / (111320 * Math.cos((lat * Math.PI) / 180))
  const coords: [number, number][] = []
  for (let i = 0; i <= sides; i += 1) {
    const t = (i / sides) * Math.PI * 2
    coords.push([lng + Math.cos(t) * dLng, lat + Math.sin(t) * dLat])
  }
  return { type: 'Polygon' as const, coordinates: [coords] }
}

type DemoFeature = {
  type: 'Feature'
  properties: Record<string, number | string>
  geometry: ReturnType<typeof ring> | { type: 'Point'; coordinates: [number, number] }
}

/** Web-mercator meters per pixel at zoom 0 for 512px tiles, at the demo latitude. */
const METERS_PER_PX_Z0 = (40075016.686 / 512) * Math.cos((24.47 * Math.PI) / 180)

/** Circle radius expression that keeps each disk at `radius × scale` meters on the ground. */
function metersToPixels(scale: number): mapboxgl.ExpressionSpecification {
  const base = ['/', ['*', ['get', 'radius'], scale], METERS_PER_PX_Z0]
  return ['interpolate', ['exponential', 2], ['zoom'], 0, base, 22, ['*', base, 2 ** 22]]
}

const COLUMN_GEOMETRY = DEMO_COLUMNS.map(([lng, lat]) => ring(lng, lat, COLUMN_RADIUS_M, 14))

type ColumnGeometry = ReturnType<typeof ring>

type FeatureScales = {
  columns: number[]
  junctions: number[]
  regionColumns: number[]
  regionJunctions: number[]
}

/** Everything one overlay draw needs; tweens update fields and redraw. */
type StoryFrame = {
  state: StorySceneState
  ramp: [number, string][]
  scales: FeatureScales
  region: StoryMapRegion | null
  regionGeometry: ColumnGeometry[]
  phase: number
  area: [number, number][] | null
}

const SCALE_KEYS = ['columns', 'junctions', 'regionColumns', 'regionJunctions'] as const

const filled = (length: number, value: number) => Array.from({ length }, () => value)

function hash01(index: number, seed: number) {
  const s = Math.sin(index * 127.1 + seed * 311.7) * 43758.5453
  return s - Math.floor(s)
}

function featureCollection(features: DemoFeature[]) {
  return { type: 'FeatureCollection' as const, features }
}

function columnFeatures(
  geometry: ColumnGeometry[],
  heights: number[],
  scales: number[],
  color: (index: number, height: number, scale: number) => [number, number, number],
) {
  const features: DemoFeature[] = []
  geometry.forEach((ring, index) => {
    const scale = scales[index] ?? 1
    const height = (heights[index] ?? 0) * scale
    if (height < 1) return
    features.push({
      type: 'Feature',
      properties: { height, color: rgbString(color(index, height, scale)) },
      geometry: ring,
    })
  })
  return featureCollection(features)
}

function junctionFeatures(points: [number, number, number][], radii: number[], scales: number[]) {
  const features: DemoFeature[] = []
  points.forEach(([lng, lat], index) => {
    const radius = (radii[index] ?? 0) * (scales[index] ?? 1)
    if (radius < 0.5) return
    features.push({ type: 'Feature', properties: { radius }, geometry: { type: 'Point', coordinates: [lng, lat] } })
  })
  return featureCollection(features)
}

function areaData(polygon: [number, number][] | null) {
  if (!polygon || polygon.length < 3) return featureCollection([])
  return featureCollection([
    {
      type: 'Feature',
      properties: {},
      geometry: { type: 'Polygon', coordinates: [[...polygon, polygon[0]]] },
    },
  ])
}

function setSourceData(map: mapboxgl.Map, id: string, data: ReturnType<typeof featureCollection>) {
  ;(map.getSource(id) as mapboxgl.GeoJSONSource | undefined)?.setData(data)
}

function drawStory(map: mapboxgl.Map, frame: StoryFrame) {
  const { state, ramp, scales, region } = frame
  setSourceData(
    map,
    'story-columns',
    columnFeatures(COLUMN_GEOMETRY, state.heights, scales.columns, (index, height, scale) =>
      scale === 1 ? state.columnColors[index] : rampColor(ramp, height),
    ),
  )
  setSourceData(map, 'story-junctions', junctionFeatures(DEMO_JUNCTIONS, state.radii, scales.junctions))
  if (region) {
    const regionRamp = region.columnRamp
    setSourceData(
      map,
      'story-region-columns',
      columnFeatures(frame.regionGeometry, regionColumnHeights(region, frame.phase), scales.regionColumns, (_i, h) =>
        rampColor(regionRamp, h),
      ),
    )
    setSourceData(
      map,
      'story-region-junctions',
      junctionFeatures(region.junctions, regionJunctionRadii(region, frame.phase), scales.regionJunctions),
    )
  }
  if (map.getLayer('story-junctions')) {
    const core = rgbString(state.diskCore)
    const halo = rgbString(state.diskHalo)
    map.setPaintProperty('story-junctions', 'circle-color', core)
    map.setPaintProperty('story-junctions-halo', 'circle-color', halo)
    map.setPaintProperty('story-region-junctions', 'circle-color', core)
    map.setPaintProperty('story-region-junctions-halo', 'circle-color', halo)
  }
}

function addJunctionLayers(map: mapboxgl.Map, id: string, state: StorySceneState) {
  map.addLayer({
    id: `${id}-halo`,
    type: 'circle',
    source: id,
    paint: {
      'circle-radius': metersToPixels(1.7),
      'circle-color': rgbString(state.diskHalo),
      'circle-opacity': 0.22,
      'circle-blur': 1,
      'circle-pitch-alignment': 'map',
      'circle-pitch-scale': 'map',
      'circle-color-transition': { duration: 0 },
    },
  })

  map.addLayer({
    id,
    type: 'circle',
    source: id,
    paint: {
      'circle-radius': metersToPixels(1),
      'circle-color': rgbString(state.diskCore),
      'circle-opacity': 0.36,
      'circle-blur': 0.55,
      'circle-pitch-alignment': 'map',
      'circle-pitch-scale': 'map',
      'circle-color-transition': { duration: 0 },
    },
  })
}

function addColumnLayer(map: mapboxgl.Map, id: string) {
  map.addLayer({
    id,
    type: 'fill-extrusion',
    source: id,
    paint: {
      'fill-extrusion-color': ['to-color', ['get', 'color']],
      'fill-extrusion-height': ['get', 'height'],
      'fill-extrusion-base': 0,
      'fill-extrusion-opacity': 1,
      'fill-extrusion-vertical-gradient': true,
    },
  })
}

function mountStoryLayers(map: mapboxgl.Map, frame: StoryFrame) {
  map.resize()
  if (map.getSource('story-columns')) return

  const empty = featureCollection([])
  for (const id of ['story-area', 'story-junctions', 'story-region-junctions', 'story-columns', 'story-region-columns']) {
    map.addSource(id, { type: 'geojson', data: empty })
  }

  map.addLayer({
    id: 'story-area',
    type: 'fill',
    source: 'story-area',
    paint: { 'fill-color': '#70aeff', 'fill-opacity': 0.1 },
  })
  map.addLayer({
    id: 'story-area-line',
    type: 'line',
    source: 'story-area',
    paint: { 'line-color': '#70aeff', 'line-width': 1.5, 'line-dasharray': [2, 1.5], 'line-opacity': 0.9 },
  })
  addJunctionLayers(map, 'story-junctions', frame.state)
  addJunctionLayers(map, 'story-region-junctions', frame.state)
  addColumnLayer(map, 'story-columns')
  addColumnLayer(map, 'story-region-columns')

  setSourceData(map, 'story-area', areaData(frame.area))
  drawStory(map, frame)
}

function setLayerVisibility(map: mapboxgl.Map, id: string, visible: boolean) {
  if (!map.getLayer(id)) return
  map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none')
}

function syncDemoLayers(map: mapboxgl.Map, layers: StoryMapLayerVisibility) {
  for (const id of JUNCTION_LAYERS) setLayerVisibility(map, id, layers.junctions)
  for (const id of COLUMN_LAYERS) setLayerVisibility(map, id, layers.distribution)
}

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
}

function easeOutBack(t: number) {
  const c1 = 1.4
  return 1 + (c1 + 1) * (t - 1) ** 3 + c1 * (t - 1) ** 2
}

function targetScales(region: StoryMapRegion | null, regionActive: boolean, effect: StoryAreaEffect | null): FeatureScales {
  const main = regionActive ? 0 : 1
  return {
    columns: DEMO_COLUMNS.map((_, index) => main * (effect?.columns[index] ?? 1)),
    junctions: DEMO_JUNCTIONS.map((_, index) => main * (effect?.junctions[index] ?? 1)),
    regionColumns: (region?.columns ?? []).map((_, index) =>
      regionActive ? (effect?.regionColumns[index] ?? 1) : 0,
    ),
    regionJunctions: (region?.junctions ?? []).map((_, index) =>
      regionActive ? (effect?.regionJunctions[index] ?? 1) : 0,
    ),
  }
}

/** Start offsets (0…1 of the tween) so features move in a wave rather than all at once. */
function scaleDelays(
  scales: FeatureScales,
  region: StoryMapRegion | null,
  mode: 'tween' | 'grow' | 'restore',
  sceneCenter: [number, number],
): FeatureScales {
  const jitter = (length: number, seed: number, spread: number) =>
    Array.from({ length }, (_, index) => spread * hash01(index, seed))
  const spread = (points: [number, number, number][], center: [number, number], seed: number, offset: number) => {
    const distances = points.map(([lng, lat]) => Math.hypot(lng - center[0], lat - center[1]))
    const max = Math.max(1e-6, ...distances)
    return distances.map((distance, index) => offset + 0.4 * (distance / max) + 0.06 * hash01(index, seed))
  }
  if (mode === 'restore') {
    return {
      columns: spread(DEMO_COLUMNS, sceneCenter, 89, 0.3),
      junctions: spread(DEMO_JUNCTIONS, sceneCenter, 90, 0.24),
      regionColumns: jitter(scales.regionColumns.length, 91, 0.12),
      regionJunctions: jitter(scales.regionJunctions.length, 92, 0.12),
    }
  }
  if (mode === 'tween' || !region) {
    return {
      columns: jitter(scales.columns.length, 81, 0.3),
      junctions: jitter(scales.junctions.length, 82, 0.3),
      regionColumns: jitter(scales.regionColumns.length, 83, 0.3),
      regionJunctions: jitter(scales.regionJunctions.length, 84, 0.3),
    }
  }
  return {
    columns: jitter(scales.columns.length, 85, 0.15),
    junctions: jitter(scales.junctions.length, 86, 0.15),
    regionColumns: spread(region.columns, region.camera.center, 87, 0.26),
    regionJunctions: spread(region.junctions, region.camera.center, 88, 0.2),
  }
}

/** Full Mapbox story canvas. */
export function StoryMap({
  className,
  controlsClassName,
  layers = DEFAULT_LAYERS,
  sceneIndex = 0,
  framePhase = 0,
  frameDuration = 500,
  frameLinear = false,
  styleUrl = STORY_MAP_STYLE,
  interactive = true,
  cameraPadding = CAMERA_PADDING,
  zoomOffset = 0,
  fitParentHeight = false,
  cameraLink,
  flyToScene = true,
  region = null,
  areaEffect = null,
  cameraRequest = null,
  onHandle,
}: StoryMapProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const handleRef = useRef<InteractiveMapHandle | null>(null)
  const [ready, setReady] = useState(false)
  const appliedStyleRef = useRef(styleUrl)
  const layersRef = useRef(layers)
  const sceneIndexRef = useRef(sceneIndex)
  const appliedSceneRef = useRef(sceneIndex)
  const appliedPhaseRef = useRef(framePhase)
  const frameRef = useRef<StoryFrame>({
    state: sceneState(sceneAtPhase(storySceneAt(sceneIndex), framePhase)),
    ramp: storySceneAt(sceneIndex).columnRamp,
    scales: targetScales(null, false, null),
    region: null,
    regionGeometry: [],
    phase: framePhase,
    area: null,
  })
  const appliedRegionRef = useRef<StoryMapRegion | null>(null)
  const appliedEffectRef = useRef<StoryAreaEffect | null>(null)
  const tweenRef = useRef<number | null>(null)
  const scaleTweenRef = useRef<number | null>(null)
  const mountOptionsRef = useRef({ interactive, cameraPadding, zoomOffset, fitParentHeight })
  const flyToSceneRef = useRef(flyToScene)

  useEffect(() => {
    flyToSceneRef.current = flyToScene
  }, [flyToScene])

  useEffect(() => {
    layersRef.current = layers
  }, [layers])

  useEffect(() => {
    sceneIndexRef.current = sceneIndex
  }, [sceneIndex])

  useEffect(() => {
    const el = containerRef.current
    if (!el || mapRef.current || !MAPBOX_TOKEN) return

    const { camera } = storySceneAt(sceneIndexRef.current)
    const mountOptions = mountOptionsRef.current
    mapboxgl.accessToken = MAPBOX_TOKEN
    const map = new mapboxgl.Map({
      container: el,
      style: styleUrl,
      center: camera.center,
      zoom: camera.zoom + mountOptions.zoomOffset,
      pitch: camera.pitch,
      bearing: camera.bearing,
      antialias: true,
      attributionControl: false,
      interactive: mountOptions.interactive,
      dragPan: true,
      scrollZoom: true,
      touchZoomRotate: true,
      doubleClickZoom: true,
      keyboard: true,
    })
    map.setPadding(mountOptions.cameraPadding)
    mapRef.current = map

    const observer = new ResizeObserver(() => map.resize())
    observer.observe(el)

    const root = rootRef.current
    const parent = root?.parentElement
    let parentObserver: ResizeObserver | null = null
    if (mountOptions.fitParentHeight && root && parent) {
      const { cameraPadding: padding } = mountOptions
      let hidden = -1
      parentObserver = new ResizeObserver(() => {
        const next = Math.max(0, Math.round(root.clientHeight - parent.clientHeight))
        if (next === hidden) return
        hidden = next
        map.setPadding({ ...padding, bottom: (padding.bottom ?? 0) + next })
      })
      parentObserver.observe(parent)
      parentObserver.observe(root)
    }

    map.on('load', () => {
      mountStoryLayers(map, frameRef.current)
      syncDemoLayers(map, layersRef.current)
      setReady(true)
    })

    handleRef.current = {
      zoomIn: () => map.zoomIn({ duration: 280 }),
      zoomOut: () => map.zoomOut({ duration: 280 }),
      resetNorth: () => {
        const { pitch, bearing } = (appliedRegionRef.current ?? storySceneAt(sceneIndexRef.current)).camera
        map.easeTo({ bearing, pitch, duration: 420 })
      },
    }

    return () => {
      observer.disconnect()
      parentObserver?.disconnect()
      if (tweenRef.current !== null) cancelAnimationFrame(tweenRef.current)
      if (scaleTweenRef.current !== null) cancelAnimationFrame(scaleTweenRef.current)
      map.remove()
      mapRef.current = null
      handleRef.current = null
      setReady(false)
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !cameraLink) return
    const { zoomOffset: offset } = mountOptionsRef.current
    let following = false
    const read = (): StoryCamera => {
      const center = map.getCenter()
      return {
        center: [center.lng, center.lat],
        zoom: map.getZoom() - offset,
        bearing: map.getBearing(),
        pitch: map.getPitch(),
      }
    }
    const follow = (camera: StoryCamera) => {
      following = true
      map.jumpTo({ ...camera, zoom: camera.zoom + offset })
      following = false
    }
    const onMove = () => {
      if (!following) cameraLink.publish(follow, read())
    }
    const shared = cameraLink.join(follow)
    if (shared) follow(shared)
    else cameraLink.publish(follow, read())
    map.on('move', onMove)
    return () => {
      map.off('move', onMove)
      cameraLink.leave(follow)
    }
  }, [cameraLink])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    syncDemoLayers(map, layers)
  }, [layers, ready])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    const sceneChanged = appliedSceneRef.current !== sceneIndex
    if (!sceneChanged && appliedPhaseRef.current === framePhase) return
    appliedSceneRef.current = sceneIndex
    appliedPhaseRef.current = framePhase

    const scene = storySceneAt(sceneIndex)
    if (sceneChanged && flyToSceneRef.current && !appliedRegionRef.current) {
      map.flyTo({
        ...scene.camera,
        zoom: scene.camera.zoom + mountOptionsRef.current.zoomOffset,
        duration: CAMERA_DURATION_MS,
        curve: 1.2,
        essential: true,
      })
    }

    if (tweenRef.current !== null) cancelAnimationFrame(tweenRef.current)
    const frame = frameRef.current
    frame.ramp = scene.columnRamp
    const from = frame.state
    const to = sceneState(sceneAtPhase(scene, framePhase))
    const fromPhase = frame.phase
    const toPhase = framePhase - fromPhase < -0.5 ? framePhase + 1 : framePhase
    const duration = sceneChanged ? SCENE_TWEEN_MS : Math.max(1, frameDuration)
    const ease = !sceneChanged && frameLinear ? (t: number) => t : easeInOutCubic
    const start = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = ease(t)
      frame.state = mixSceneState(from, to, eased)
      frame.phase = (fromPhase + (toPhase - fromPhase) * eased) % 1
      drawStory(map, frame)
      tweenRef.current = t < 1 ? requestAnimationFrame(step) : null
    }
    tweenRef.current = requestAnimationFrame(step)
  }, [sceneIndex, framePhase, frameDuration, frameLinear, ready])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    const regionChanged = appliedRegionRef.current !== region
    if (!regionChanged && appliedEffectRef.current === areaEffect) return
    appliedRegionRef.current = region
    appliedEffectRef.current = areaEffect

    const frame = frameRef.current
    const growing = Boolean(region && regionChanged)
    const restoring = Boolean(!region && regionChanged && frame.region)
    const sceneCamera = storySceneAt(sceneIndexRef.current).camera
    if (restoring) {
      window.setTimeout(() => {
        if (appliedRegionRef.current !== null || mapRef.current !== map) return
        map.flyTo({
          ...sceneCamera,
          zoom: sceneCamera.zoom + mountOptionsRef.current.zoomOffset,
          duration: REGION_FLY_MS,
          curve: 1.3,
          essential: true,
        })
      }, REGION_FLY_DELAY_MS)
    }
    if (region && regionChanged) {
      frame.region = region
      frame.regionGeometry = region.columns.map(([lng, lat]) => ring(lng, lat, COLUMN_RADIUS_M, 14))
      frame.scales = {
        ...frame.scales,
        regionColumns: filled(region.columns.length, 0),
        regionJunctions: filled(region.junctions.length, 0),
      }
      // Let a layout change from the same update (the agent rail opening) resize the map first.
      window.setTimeout(() => {
        if (appliedRegionRef.current !== region || mapRef.current !== map) return
        map.flyTo({
          ...region.camera,
          zoom: region.camera.zoom + mountOptionsRef.current.zoomOffset,
          duration: REGION_FLY_MS,
          curve: 1.3,
          essential: true,
        })
      }, REGION_FLY_DELAY_MS)
    }
    frame.area = areaEffect?.polygon ?? null
    setSourceData(map, 'story-area', areaData(frame.area))

    if (scaleTweenRef.current !== null) cancelAnimationFrame(scaleTweenRef.current)
    const from = frame.scales
    const to = targetScales(frame.region, region !== null, areaEffect)
    const delays = scaleDelays(to, frame.region, restoring ? 'restore' : growing ? 'grow' : 'tween', sceneCamera.center)
    const duration = growing || restoring ? REGION_GROW_MS : AREA_TWEEN_MS
    const span = growing || restoring ? 0.3 : 0.65
    const start = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const next = {} as FeatureScales
      for (const key of SCALE_KEYS) {
        next[key] = to[key].map((target, index) => {
          const origin = from[key][index] ?? 0
          const local = Math.max(0, Math.min(1, (t - delays[key][index]) / span))
          const eased = target > origin ? easeOutBack(local) : easeInOutCubic(local)
          return t >= 1 ? target : origin + (target - origin) * eased
        })
      }
      frame.scales = next
      if (t >= 1 && restoring) {
        frame.region = null
        frame.regionGeometry = []
        frame.scales = { ...next, regionColumns: [], regionJunctions: [] }
      }
      drawStory(map, frame)
      scaleTweenRef.current = t < 1 ? requestAnimationFrame(step) : null
    }
    scaleTweenRef.current = requestAnimationFrame(step)
  }, [region, areaEffect, ready])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready || !cameraRequest) return
    // Runs after the region/restore flight is queued so this camera wins.
    const timer = window.setTimeout(() => {
      map.flyTo({ ...cameraRequest.camera, duration: REGION_FLY_MS, curve: 1.3, essential: true })
    }, REGION_FLY_DELAY_MS + 20)
    return () => window.clearTimeout(timer)
  }, [cameraRequest, ready])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready || !onHandle) return
    onHandle({
      unproject: (clientX, clientY) => {
        const rect = map.getCanvas().getBoundingClientRect()
        const point = map.unproject([clientX - rect.left, clientY - rect.top])
        return [point.lng, point.lat]
      },
      capture: () =>
        new Promise((resolve) => {
          map.once('render', () => {
            // The WebGL buffer is only readable inside the frame that drew it.
            resolve(captureMapView(map))
          })
          map.triggerRepaint()
        }),
    })
    return () => onHandle(null)
  }, [onHandle, ready])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready || appliedStyleRef.current === styleUrl) return
    appliedStyleRef.current = styleUrl
    setReady(false)
    map.once('style.load', () => {
      mountStoryLayers(map, frameRef.current)
      syncDemoLayers(map, layersRef.current)
      setReady(true)
    })
    map.setStyle(styleUrl)
  }, [ready, styleUrl])

  return (
    <div ref={rootRef} className={[styles.root, className].filter(Boolean).join(' ')}>
      <div ref={containerRef} className={styles.canvas} />
      {interactive ? (
        <MapControls
          className={[styles.controls, controlsClassName].filter(Boolean).join(' ')}
          disabled={!ready}
          onZoomIn={() => handleRef.current?.zoomIn()}
          onZoomOut={() => handleRef.current?.zoomOut()}
          onResetNorth={() => handleRef.current?.resetNorth()}
        />
      ) : null}
    </div>
  )
}
