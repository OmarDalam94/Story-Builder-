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
  sceneAtPhase,
  sceneState,
  storySceneAt,
  type StorySceneState,
} from './storyDemoScenes'
import type { StoryCamera, StoryCameraLink } from './storyCameraLink'
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
  const displayedRef = useRef<StorySceneState>(
    sceneState(sceneAtPhase(storySceneAt(sceneIndex), framePhase)),
  )
  const tweenRef = useRef<number | null>(null)
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
      parentObserver?.disconnect()
      if (tweenRef.current !== null) cancelAnimationFrame(tweenRef.current)
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
    if (sceneChanged && flyToSceneRef.current) {
      map.flyTo({
        ...scene.camera,
        zoom: scene.camera.zoom + mountOptionsRef.current.zoomOffset,
        duration: CAMERA_DURATION_MS,
        curve: 1.2,
        essential: true,
      })
    }

    if (tweenRef.current !== null) cancelAnimationFrame(tweenRef.current)
    const from = displayedRef.current
    const to = sceneState(sceneAtPhase(scene, framePhase))
    const duration = sceneChanged ? SCENE_TWEEN_MS : Math.max(1, frameDuration)
    const ease = !sceneChanged && frameLinear ? (t: number) => t : easeInOutCubic
    const start = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      displayedRef.current = mixSceneState(from, to, ease(t))
      applySceneState(map, displayedRef.current)
      tweenRef.current = t < 1 ? requestAnimationFrame(step) : null
    }
    tweenRef.current = requestAnimationFrame(step)
  }, [sceneIndex, framePhase, frameDuration, frameLinear, ready])

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
