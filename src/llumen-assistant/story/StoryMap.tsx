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
  rgbString,
  sceneState,
  storySceneAt,
  type StorySceneState,
} from './storyDemoScenes'
import styles from './StoryMap.module.css'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN ?? ''
const MAPBOX_STYLE = 'mapbox://styles/pixonal/cmgnqbyjf005g01sh9s510hi2'
export const STORY_MAP_STYLE = MAPBOX_STYLE
/** Keeps the demo overlay clear of the 380px insight column. */
const CAMERA_PADDING = { top: 0, right: 0, bottom: 0, left: 400 }
const CAMERA_DURATION_MS = 2600
const SCENE_TWEEN_MS = 1800

export type StoryMapLayerVisibility = {
  junctions: boolean
  distribution: boolean
}

export type StoryMapProps = {
  className?: string
  layers?: StoryMapLayerVisibility
  /** Index of the demo scene (camera, columns, disks) to show. */
  sceneIndex?: number
  styleUrl?: string
}

const DEFAULT_LAYERS: StoryMapLayerVisibility = {
  junctions: true,
  distribution: true,
}

const JUNCTION_LAYERS = ['story-junctions-halo', 'story-junctions']
const COLUMN_LAYERS = ['story-columns']
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

function columnData(state: StorySceneState) {
  const features: DemoFeature[] = COLUMN_GEOMETRY.map((geometry, index) => ({
    type: 'Feature',
    properties: { height: state.heights[index], color: rgbString(state.columnColors[index]) },
    geometry,
  }))
  return { type: 'FeatureCollection' as const, features }
}

function junctionData(state: StorySceneState) {
  const features: DemoFeature[] = DEMO_JUNCTIONS.map(([lng, lat], index) => ({
    type: 'Feature',
    properties: { radius: state.radii[index] },
    geometry: { type: 'Point', coordinates: [lng, lat] },
  }))
  return { type: 'FeatureCollection' as const, features }
}

function applySceneState(map: mapboxgl.Map, state: StorySceneState) {
  const columns = map.getSource('story-columns') as mapboxgl.GeoJSONSource | undefined
  const junctions = map.getSource('story-junctions') as mapboxgl.GeoJSONSource | undefined
  columns?.setData(columnData(state))
  junctions?.setData(junctionData(state))
  if (map.getLayer('story-junctions')) {
    map.setPaintProperty('story-junctions', 'circle-color', rgbString(state.diskCore))
    map.setPaintProperty('story-junctions-halo', 'circle-color', rgbString(state.diskHalo))
  }
}

function mountStoryLayers(map: mapboxgl.Map, state: StorySceneState) {
  map.resize()
  if (map.getSource('story-columns')) return

  map.addSource('story-columns', { type: 'geojson', data: columnData(state) })
  map.addSource('story-junctions', { type: 'geojson', data: junctionData(state) })

  map.addLayer({
    id: 'story-junctions-halo',
    type: 'circle',
    source: 'story-junctions',
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
    id: 'story-junctions',
    type: 'circle',
    source: 'story-junctions',
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

  map.addLayer({
    id: 'story-columns',
    type: 'fill-extrusion',
    source: 'story-columns',
    paint: {
      'fill-extrusion-color': ['to-color', ['get', 'color']],
      'fill-extrusion-height': ['get', 'height'],
      'fill-extrusion-base': 0,
      'fill-extrusion-opacity': 1,
      'fill-extrusion-vertical-gradient': true,
    },
  })
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

/** Full Mapbox story canvas. */
export function StoryMap({
  className,
  layers = DEFAULT_LAYERS,
  sceneIndex = 0,
  styleUrl = STORY_MAP_STYLE,
}: StoryMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const handleRef = useRef<InteractiveMapHandle | null>(null)
  const [ready, setReady] = useState(false)
  const appliedStyleRef = useRef(styleUrl)
  const layersRef = useRef(layers)
  const sceneIndexRef = useRef(sceneIndex)
  const appliedSceneRef = useRef(sceneIndex)
  const displayedRef = useRef<StorySceneState>(sceneState(storySceneAt(sceneIndex)))
  const tweenRef = useRef<number | null>(null)

  useEffect(() => {
    layersRef.current = layers
  }, [layers])

  useEffect(() => {
    sceneIndexRef.current = sceneIndex
  }, [sceneIndex])

  useEffect(() => {
    const el = containerRef.current
    if (!el || mapRef.current) return

    const { camera } = storySceneAt(sceneIndexRef.current)
    mapboxgl.accessToken = MAPBOX_TOKEN
    const map = new mapboxgl.Map({
      container: el,
      style: styleUrl,
      center: camera.center,
      zoom: camera.zoom,
      pitch: camera.pitch,
      bearing: camera.bearing,
      antialias: true,
      attributionControl: false,
      dragPan: true,
      scrollZoom: true,
      touchZoomRotate: true,
      doubleClickZoom: true,
      keyboard: true,
    })
    map.setPadding(CAMERA_PADDING)
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right')
    mapRef.current = map

    const observer = new ResizeObserver(() => map.resize())
    observer.observe(el)

    map.on('load', () => {
      mountStoryLayers(map, displayedRef.current)
      syncDemoLayers(map, layersRef.current)
      setReady(true)
    })

    handleRef.current = {
      zoomIn: () => map.zoomIn({ duration: 280 }),
      zoomOut: () => map.zoomOut({ duration: 280 }),
      resetNorth: () => {
        const { pitch, bearing } = storySceneAt(sceneIndexRef.current).camera
        map.easeTo({ bearing, pitch, duration: 420 })
      },
    }

    return () => {
      observer.disconnect()
      if (tweenRef.current !== null) cancelAnimationFrame(tweenRef.current)
      map.remove()
      mapRef.current = null
      handleRef.current = null
      setReady(false)
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    syncDemoLayers(map, layers)
  }, [layers, ready])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready || appliedSceneRef.current === sceneIndex) return
    appliedSceneRef.current = sceneIndex

    const scene = storySceneAt(sceneIndex)
    map.flyTo({ ...scene.camera, duration: CAMERA_DURATION_MS, curve: 1.2, essential: true })

    if (tweenRef.current !== null) cancelAnimationFrame(tweenRef.current)
    const from = displayedRef.current
    const to = sceneState(scene)
    const start = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / SCENE_TWEEN_MS)
      displayedRef.current = mixSceneState(from, to, easeInOutCubic(t))
      applySceneState(map, displayedRef.current)
      tweenRef.current = t < 1 ? requestAnimationFrame(step) : null
    }
    tweenRef.current = requestAnimationFrame(step)
  }, [sceneIndex, ready])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready || appliedStyleRef.current === styleUrl) return
    appliedStyleRef.current = styleUrl
    setReady(false)
    map.once('style.load', () => {
      mountStoryLayers(map, displayedRef.current)
      syncDemoLayers(map, layersRef.current)
      setReady(true)
    })
    map.setStyle(styleUrl)
  }, [ready, styleUrl])

  return (
    <div className={[styles.root, className].filter(Boolean).join(' ')}>
      <div ref={containerRef} className={styles.canvas} />
      <MapControls
        className={styles.controls}
        disabled={!ready}
        onZoomIn={() => handleRef.current?.zoomIn()}
        onZoomOut={() => handleRef.current?.zoomOut()}
        onResetNorth={() => handleRef.current?.resetNorth()}
      />
    </div>
  )
}
