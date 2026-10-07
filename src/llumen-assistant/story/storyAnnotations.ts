/**
 * Demo-only map annotations for the Approach 2 "top 10 schools" prompts. Annotations are
 * geographic (GeoJSON-style lng/lat geometry) and reference the column features they describe,
 * so the map can redraw them as the camera moves and drop them when that data isn't shown.
 */
import { DEMO_COLUMNS, DEMO_JUNCTIONS } from './storyDemoMapData'
import {
  MUSSAFAH_LABEL,
  MUSSAFAH_MAX_HEIGHT_M,
  MUSSAFAH_REGION,
  pointInPolygon,
  regionColumnHeights,
} from './storyAiScenarios'
import { COLUMN_MAX_HEIGHT_M, sceneAtPhase, sceneState, storySceneAt } from './storyDemoScenes'

export const TOP_SCHOOLS_COUNT = 10
export const TOP_SCHOOLS_PERIOD = 'the last 2 months'
export const TOP_SCHOOLS_PROMPT =
  'Show me the top 10 schools with the highest traffic around them over the last 2 months, and annotate them on the map.'
export const ANNOTATION_COLOR = '#ffb547'

export function locationPrompt(name: string) {
  return `Show me the top 10 schools with the highest traffic around them in ${name} over the last 2 months, and annotate them on the map.`
}

/** Columns closer than this join the same annotated area. */
const CLUSTER_KM = 1.7
/** Padding around the columns of an area, so the outline doesn't cut through them. */
const AREA_PADDING_M = 380
const DISTRICT_RADIUS_M = 900
const MUSSAFAH_PADDING_M = 260
const KM_PER_DEG_LNG = 101.3
const KM_PER_DEG_LAT = 110.8

const SCHOOL_NAMES = [
  'Al Nahda Model School',
  'Al Khalidiyah Girls School',
  'Sheikh Khalifa Primary',
  'Al Bateen Secondary',
  'Al Manhal Cycle 2 School',
  'Corniche Boys School',
  'Al Danah Academy',
  'Al Ittihad National School',
  'Al Hisn Girls School',
  'Al Markaziyah Cycle 1 School',
  'Al Zahiyah Model School',
  'Al Wahdah Academy',
  'Al Mina Secondary',
  'Al Mushrif Primary',
  'Al Nahyan Girls School',
  'Qasr Al Bahr School',
]

const MUSSAFAH_SCHOOL_NAMES = [
  'Mussafah Model School',
  'Al Mussafah Girls School',
  'M-10 Cycle 2 School',
  'Shabiya Primary',
  'Mussafah Boys Secondary',
  'Al Fajr Academy',
  'ICAD Community School',
  'Al Muna Cycle 1 School',
  'M-26 National School',
  'Al Salam Girls School',
  'Mussafah Industrial Academy',
  'Al Rawda Primary',
  'Al Noor Secondary',
  'M-4 Cycle 3 School',
]

const DISTRICTS: { name: string; at: [number, number] }[] = [
  { name: 'Al Khalidiyah', at: [54.347, 24.468] },
  { name: 'Al Manhal', at: [54.362, 24.466] },
  { name: 'Al Hisn', at: [54.355, 24.481] },
  { name: 'Al Markaziyah', at: [54.357, 24.492] },
  { name: 'Al Danah', at: [54.366, 24.484] },
  { name: 'Al Bateen', at: [54.334, 24.458] },
  { name: 'Al Khubeirat', at: [54.326, 24.474] },
  { name: 'Al Zahiyah', at: [54.382, 24.495] },
  { name: 'Al Mina', at: [54.372, 24.517] },
  { name: 'Al Wahdah', at: [54.376, 24.471] },
  { name: 'Al Nahyan', at: [54.388, 24.462] },
  { name: 'Al Mushrif', at: [54.385, 24.444] },
  { name: MUSSAFAH_LABEL, at: [54.516, 24.346] },
]

const SCHOOL_TYPES = ['Public', 'Private'] as const
const SCHOOL_LEVELS = ['Cycle 1', 'Cycle 2', 'Cycle 3'] as const

/** An area picked from the location search or drawn on the map. */
export type StoryLocation = {
  id: string
  name: string
  kind: 'district' | 'drawn'
  /** Outline ring (unclosed), lng/lat. */
  polygon: [number, number][]
}

export type StoryLocationOption = StoryLocation & { description: string }

export type AnnotatedSchool = {
  /** Index into the annotated layer's columns: the feature this annotation is anchored to. */
  column: number
  rank: number
  name: string
  district: string
  type: (typeof SCHOOL_TYPES)[number]
  level: (typeof SCHOOL_LEVELS)[number]
  /** Peak-hour vehicles within 500 m of the school. */
  peak: number
  /** Change vs the 2 months before, in percent. */
  change: number
  students: number
  coordinates: [number, number]
}

export type AnnotatedArea = {
  id: string
  label: string
  district: string
  /** Outline ring (unclosed), lng/lat. */
  polygon: [number, number][]
  /** Where the area label sits: the outline's northernmost point. */
  anchor: [number, number]
  columns: number[]
  junctions: number
}

export type StoryMapAnnotation = {
  /** Slide whose data the annotation was created from. */
  slide: number
  /** Which columns the annotation refers to: the story's own, or the Mussafah focus region's. */
  layer: 'main' | 'region'
  /** Set when the prompt was scoped to a picked or drawn area. */
  location: string | null
  color: string
  schools: AnnotatedSchool[]
  areas: AnnotatedArea[]
}

function hash01(index: number, seed: number) {
  const s = Math.sin(index * 127.1 + seed * 311.7) * 43758.5453
  return s - Math.floor(s)
}

function distanceKm(a: [number, number], b: [number, number]) {
  return Math.hypot((a[0] - b[0]) * KM_PER_DEG_LNG, (a[1] - b[1]) * KM_PER_DEG_LAT)
}

export function nearestDistrict(point: [number, number]) {
  let best = DISTRICTS[0]
  for (const district of DISTRICTS) {
    if (distanceKm(point, district.at) < distanceKm(point, best.at)) best = district
  }
  return best.name
}

export function polygonCenter(polygon: [number, number][]): [number, number] {
  return [
    polygon.reduce((sum, point) => sum + point[0], 0) / polygon.length,
    polygon.reduce((sum, point) => sum + point[1], 0) / polygon.length,
  ]
}

/** Single-linkage clusters of the given points. */
function clusters(points: [number, number][]) {
  const groups = points.map((_, index) => index)
  const root = (index: number): number => (groups[index] === index ? index : root(groups[index]))
  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      if (distanceKm(points[i], points[j]) <= CLUSTER_KM) groups[root(j)] = root(i)
    }
  }
  const byRoot = new Map<number, number[]>()
  points.forEach((_, index) => {
    const key = root(index)
    byRoot.set(key, [...(byRoot.get(key) ?? []), index])
  })
  return [...byRoot.values()]
}

function cross(o: [number, number], a: [number, number], b: [number, number]) {
  return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
}

function convexHull(points: [number, number][]) {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const half = (list: [number, number][]) => {
    const out: [number, number][] = []
    for (const point of list) {
      while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], point) <= 0) out.pop()
      out.push(point)
    }
    out.pop()
    return out
  }
  return [...half(sorted), ...half([...sorted].reverse())]
}

/** Rounded outline around the points: the convex hull of a circle drawn around each one. */
function paddedOutline(points: [number, number][], paddingM = AREA_PADDING_M) {
  const sides = 20
  const ring: [number, number][] = []
  for (const [lng, lat] of points) {
    const dLat = paddingM / 111320
    const dLng = paddingM / (111320 * Math.cos((lat * Math.PI) / 180))
    for (let i = 0; i < sides; i += 1) {
      const t = (i / sides) * Math.PI * 2
      ring.push([lng + Math.cos(t) * dLng, lat + Math.sin(t) * dLat])
    }
  }
  return convexHull(ring)
}

const islandDistricts = DISTRICTS.filter((district) => district.name !== MUSSAFAH_LABEL)

export function locationColumnCount(polygon: [number, number][]) {
  return (
    DEMO_COLUMNS.filter(([lng, lat]) => pointInPolygon([lng, lat], polygon)).length +
    MUSSAFAH_REGION.columns.filter(([lng, lat]) => pointInPolygon([lng, lat], polygon)).length
  )
}

/** Areas the location search knows about; Mussafah's outline follows its columns. */
export const STORY_LOCATIONS: StoryLocationOption[] = [
  {
    id: 'mussafah',
    name: MUSSAFAH_LABEL,
    kind: 'district' as const,
    polygon: paddedOutline(
      MUSSAFAH_REGION.columns.map(([lng, lat]) => [lng, lat]),
      MUSSAFAH_PADDING_M,
    ),
    description: 'Industrial district',
  },
  ...islandDistricts.map((district) => ({
    id: district.name.toLowerCase().replace(/\s+/g, '-'),
    name: district.name,
    kind: 'district' as const,
    polygon: paddedOutline([district.at], DISTRICT_RADIUS_M),
    description: 'Abu Dhabi Island',
  })),
].map((location) => ({
  ...location,
  description: `${location.description} · ${locationColumnCount(location.polygon)} columns`,
}))

export function drawnLocation(polygon: [number, number][]): StoryLocation {
  return {
    id: `drawn-${Date.now()}`,
    name: `Drawn area near ${nearestDistrict(polygonCenter(polygon))}`,
    kind: 'drawn',
    polygon,
  }
}

type Candidate = { index: number; height: number; coordinates: [number, number] }

function rankSchools(candidates: Candidate[], maxHeight: number, names: string[]): AnnotatedSchool[] {
  const schools = [...candidates]
    .sort((a, b) => b.height - a.height)
    .slice(0, TOP_SCHOOLS_COUNT)
    .map(({ height, index, coordinates }, order): AnnotatedSchool => {
      const share = Math.min(1, height / maxHeight)
      return {
        column: index,
        rank: order + 1,
        name: names[Math.floor(hash01(index, 7) * names.length)],
        district: nearestDistrict(coordinates),
        type: SCHOOL_TYPES[hash01(index, 8) < 0.62 ? 0 : 1],
        level: SCHOOL_LEVELS[Math.floor(hash01(index, 9) * SCHOOL_LEVELS.length)],
        peak: Math.round((620 + share * 2280) / 10) * 10,
        change: Math.round(4 + hash01(index, 10) * 22),
        students: Math.round((480 + hash01(index, 11) * 1300) / 10) * 10,
        coordinates,
      }
    })
  // Two picks can share a name; keep each label unique within the top 10.
  const used = new Set<string>()
  for (const school of schools) {
    let offset = 0
    while (used.has(school.name)) {
      offset += 1
      school.name = names[(names.indexOf(school.name) + offset) % names.length]
    }
    used.add(school.name)
  }
  return schools
}

function areaFrom(
  id: string,
  name: string,
  polygon: [number, number][],
  schools: AnnotatedSchool[],
  junctions: [number, number, number][],
): AnnotatedArea {
  return {
    id,
    label: `${name} · ${schools.length} ${schools.length === 1 ? 'school' : 'schools'}`,
    district: name,
    polygon,
    anchor: polygon.reduce((best, point) => (point[1] > best[1] ? point : best), polygon[0]),
    columns: schools.map((school) => school.column),
    junctions: junctions.filter(([lng, lat]) => pointInPolygon([lng, lat], polygon)).length,
  }
}

/** The slide's 10 tallest columns, read as the 10 schools with the most traffic around them. */
export function topSchoolsAnnotation(slide: number): StoryMapAnnotation {
  const heights = sceneState(sceneAtPhase(storySceneAt(slide), 0)).heights
  const schools = rankSchools(
    heights.map((height, index) => ({ index, height, coordinates: [DEMO_COLUMNS[index][0], DEMO_COLUMNS[index][1]] })),
    COLUMN_MAX_HEIGHT_M,
    SCHOOL_NAMES,
  )
  const areas = clusters(schools.map((school) => school.coordinates))
    .sort((a, b) => b.length - a.length || Math.min(...a) - Math.min(...b))
    .map((members, order) => {
      const group = members.map((member) => schools[member])
      const polygon = paddedOutline(group.map((school) => school.coordinates))
      return areaFrom(`area-${order + 1}`, nearestDistrict(polygonCenter(polygon)), polygon, group, DEMO_JUNCTIONS)
    })
  return { slide, layer: 'main', location: null, color: ANNOTATION_COLOR, schools, areas }
}

/** Whether a location's columns come from the Mussafah focus region rather than the island overlay. */
export function locationUsesRegion(location: StoryLocation) {
  const inside = (columns: [number, number, number][]) =>
    columns.filter(([lng, lat]) => pointInPolygon([lng, lat], location.polygon)).length
  const region = inside(MUSSAFAH_REGION.columns)
  return region > 0 && region >= inside(DEMO_COLUMNS)
}

/** The 10 tallest columns inside a picked or drawn area; the area itself is the outline. */
export function locationAnnotation(slide: number, location: StoryLocation): StoryMapAnnotation {
  const region = locationUsesRegion(location)
  const columns = region ? MUSSAFAH_REGION.columns : DEMO_COLUMNS
  const heights = region
    ? regionColumnHeights(MUSSAFAH_REGION, 0)
    : sceneState(sceneAtPhase(storySceneAt(slide), 0)).heights
  const candidates = columns.flatMap(([lng, lat], index): Candidate[] =>
    pointInPolygon([lng, lat], location.polygon) ? [{ index, height: heights[index] ?? 0, coordinates: [lng, lat] }] : [],
  )
  const schools = rankSchools(
    candidates,
    region ? MUSSAFAH_MAX_HEIGHT_M : COLUMN_MAX_HEIGHT_M,
    region ? MUSSAFAH_SCHOOL_NAMES : SCHOOL_NAMES,
  )
  const junctions = region ? MUSSAFAH_REGION.junctions : DEMO_JUNCTIONS
  return {
    slide,
    layer: region ? 'region' : 'main',
    location: location.name,
    color: ANNOTATION_COLOR,
    schools,
    areas: [areaFrom('area-location', location.name, location.polygon, schools, junctions)],
  }
}
