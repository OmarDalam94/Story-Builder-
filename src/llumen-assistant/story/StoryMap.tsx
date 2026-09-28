/**
 * Real Mapbox map for Story view — style + demo layers adapted from
 * llumen-map-legend MapView (utilization heatmap, vehicles, AQI blooms).
 */
import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { MapControls, type InteractiveMapHandle } from '../InteractiveMap'
import styles from './StoryMap.module.css'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN ?? ''
const MAPBOX_STYLE = 'mapbox://styles/pixonal/cmgnqbyjf005g01sh9s510hi2'
export const STORY_MAP_STYLE = MAPBOX_STYLE
const CENTER: [number, number] = [54.345474, 24.476976]
const ZOOM = 11.669772
const PITCH = 72
const BEARING = 0

const iconBase = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/llumen-assets/map-icons`

function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function jitter(rand: () => number, scale = 0.09): [number, number] {
  return [CENTER[0] + (rand() - 0.5) * scale, CENTER[1] + (rand() - 0.5) * scale]
}

function point(coords: [number, number], props: Record<string, string | number>) {
  return {
    type: 'Feature' as const,
    properties: props,
    geometry: { type: 'Point' as const, coordinates: coords },
  }
}

function buildDemoLayers() {
  const rand = mulberry32(2025)
  const vehicles = {
    type: 'FeatureCollection' as const,
    features: Array.from({ length: 42 }, (_, i) =>
      point(jitter(rand, 0.12), { status: i % 3 === 0 ? 'idling' : 'active' }),
    ),
  }
  const heat = {
    type: 'FeatureCollection' as const,
    features: Array.from({ length: 180 }, () => {
      const coords = jitter(rand, 0.16)
      return point(coords, { mag: 2 + rand() * 8 })
    }),
  }
  const aqi = {
    type: 'FeatureCollection' as const,
    features: Array.from({ length: 18 }, () =>
      point(jitter(rand, 0.14), { aqi: 40 + rand() * 220 }),
    ),
  }
  return { vehicles, heat, aqi }
}

function loadIcon(map: mapboxgl.Map, name: string, url: string): Promise<void> {
  return new Promise((resolve) => {
    const image = new Image(36, 36)
    image.crossOrigin = 'anonymous'
    image.onload = () => {
      if (!map.hasImage(name)) map.addImage(name, image, { pixelRatio: 2 })
      resolve()
    }
    image.onerror = () => resolve()
    image.src = url
  })
}

export type StoryMapLayerVisibility = {
  utilization: boolean
  vehiclesActive: boolean
  vehiclesIdling: boolean
}

export type StoryMapProps = {
  className?: string
  layers?: StoryMapLayerVisibility
  styleUrl?: string
}

const DEFAULT_LAYERS: StoryMapLayerVisibility = {
  utilization: true,
  vehiclesActive: true,
  vehiclesIdling: true,
}

async function mountStoryLayers(map: mapboxgl.Map, layers: StoryMapLayerVisibility) {
  map.resize()
  await Promise.all([
    loadIcon(map, 'diamond-active', `${iconBase}/diamond-map-idling.svg`),
    loadIcon(map, 'diamond-idling', `${iconBase}/diamond-map-active.svg`),
  ])
  if (map.getSource('story-heat')) return

  const data = buildDemoLayers()
  map.addSource('story-heat', { type: 'geojson', data: data.heat })
  map.addSource('story-vehicles', { type: 'geojson', data: data.vehicles })
  map.addSource('story-aqi', { type: 'geojson', data: data.aqi })

  map.addLayer({
    id: 'story-utilization',
    type: 'heatmap',
    source: 'story-heat',
    paint: {
      'heatmap-weight': ['/', ['get', 'mag'], 10],
      'heatmap-intensity': 0.9,
      'heatmap-radius': 42,
      'heatmap-opacity': 0.72,
      'heatmap-color': [
        'interpolate',
        ['linear'],
        ['heatmap-density'],
        0,
        'rgba(61,61,223,0)',
        0.2,
        '#3d3ddf',
        0.65,
        '#8b5cf0',
        1,
        '#e0744c',
      ],
    },
  })

  map.addLayer({
    id: 'story-aqi',
    type: 'circle',
    source: 'story-aqi',
    paint: {
      'circle-radius': 22,
      'circle-blur': 0.4,
      'circle-color': [
        'interpolate',
        ['linear'],
        ['get', 'aqi'],
        0,
        '#8bc17c',
        50,
        '#e0c27a',
        100,
        '#e39b4c',
        150,
        '#e43963',
        200,
        '#bd2695',
        300,
        '#b21b1b',
      ],
      'circle-opacity': 0.35,
    },
  })

  map.addLayer({
    id: 'story-vehicles-active',
    type: 'symbol',
    source: 'story-vehicles',
    filter: ['==', ['get', 'status'], 'active'],
    layout: {
      'icon-image': 'diamond-active',
      'icon-size': 0.9,
      'icon-allow-overlap': true,
    },
  })

  map.addLayer({
    id: 'story-vehicles-idling',
    type: 'symbol',
    source: 'story-vehicles',
    filter: ['==', ['get', 'status'], 'idling'],
    layout: {
      'icon-image': 'diamond-idling',
      'icon-size': 0.9,
      'icon-allow-overlap': true,
    },
  })

  map.setLayoutProperty('story-utilization', 'visibility', layers.utilization ? 'visible' : 'none')
  map.setLayoutProperty(
    'story-vehicles-active',
    'visibility',
    layers.vehiclesActive ? 'visible' : 'none',
  )
  map.setLayoutProperty(
    'story-vehicles-idling',
    'visibility',
    layers.vehiclesIdling ? 'visible' : 'none',
  )
}

/** Full Mapbox story canvas with map-legend demo overlays. */
export function StoryMap({
  className,
  layers = DEFAULT_LAYERS,
  styleUrl = STORY_MAP_STYLE,
}: StoryMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const handleRef = useRef<InteractiveMapHandle | null>(null)
  const [ready, setReady] = useState(false)
  const layersRef = useRef(layers)
  const appliedStyleRef = useRef(styleUrl)

  useEffect(() => {
    layersRef.current = layers
  }, [layers])

  useEffect(() => {
    const el = containerRef.current
    if (!el || mapRef.current) return

    mapboxgl.accessToken = MAPBOX_TOKEN
    const map = new mapboxgl.Map({
      container: el,
      style: styleUrl,
      center: CENTER,
      zoom: ZOOM,
      pitch: PITCH,
      bearing: BEARING,
      attributionControl: false,
      dragPan: true,
      scrollZoom: true,
      touchZoomRotate: true,
      doubleClickZoom: true,
      keyboard: true,
    })
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right')
    mapRef.current = map

    const observer = new ResizeObserver(() => map.resize())
    observer.observe(el)

    map.on('load', () => {
      void mountStoryLayers(map, layersRef.current).then(() => setReady(true))
    })

    handleRef.current = {
      zoomIn: () => map.zoomIn({ duration: 280 }),
      zoomOut: () => map.zoomOut({ duration: 280 }),
      resetNorth: () => map.easeTo({ bearing: BEARING, pitch: PITCH, duration: 420 }),
    }

    return () => {
      observer.disconnect()
      map.remove()
      mapRef.current = null
      handleRef.current = null
      setReady(false)
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    map.setLayoutProperty('story-utilization', 'visibility', layers.utilization ? 'visible' : 'none')
    map.setLayoutProperty(
      'story-vehicles-active',
      'visibility',
      layers.vehiclesActive ? 'visible' : 'none',
    )
    map.setLayoutProperty(
      'story-vehicles-idling',
      'visibility',
      layers.vehiclesIdling ? 'visible' : 'none',
    )
  }, [layers, ready])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready || appliedStyleRef.current === styleUrl) return
    appliedStyleRef.current = styleUrl
    setReady(false)
    map.once('style.load', () => {
      void mountStoryLayers(map, layersRef.current).then(() => setReady(true))
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
