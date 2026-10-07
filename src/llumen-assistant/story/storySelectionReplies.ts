/** Demo assistant replies for the Story select-mode prompts. */
import type {
  AgentResponseBlock,
  AssistantReplyPayload,
  CreatedComponent,
  StoryReplyChartData,
  ThinkingStep,
  TimelineStep,
} from '../assistantReplyTypes'
import {
  AREA_FILTER_LABELS,
  MUSSAFAH_BUSY,
  MUSSAFAH_LABEL,
  MUSSAFAH_REGION,
  MUSSAFAH_VOLUME_X,
  mussafahInsight,
  type AreaFilterStats,
  type StoryAiSnapshot,
} from './storyAiScenarios'
import { EMISSIONS_LINE, GROUNDWATER_LINE, warpPath } from './StoryCharts'
import {
  CHART_PERIOD_LABEL,
  PERIOD_LOAD_X,
  PERIOD_VOLUME_LEGEND,
  PERIOD_VOLUME_X,
  periodScene,
  type ChatComponent,
} from './storyChartPeriod'
import type { StoryScene } from './storyDemoScenes'
import { TOP_SCHOOLS_COUNT, TOP_SCHOOLS_PERIOD, type StoryMapAnnotation } from './storyAnnotations'

function timeline(steps: ThinkingStep[]): TimelineStep[] {
  return steps
    .filter((step) => step.kind !== 'done')
    .map((step) => ({
      id: step.id,
      kind: step.kind === 'search' ? ('tool' as const) : ('reasoning' as const),
      title: step.title,
      titleInProgress: step.title.endsWith('…') ? step.title : `${step.title}…`,
    }))
}

function chartComponent(id: string, chart: StoryReplyChartData, caption: string): CreatedComponent {
  return {
    id,
    label: chart.title,
    type: 'visual',
    title: chart.title,
    description: caption,
    caption,
    inlineSize: 'full',
    preview: { kind: 'story-chart', chart },
  }
}

function visual(component: CreatedComponent): AgentResponseBlock {
  return {
    type: 'visual',
    componentId: component.id,
    visualType: 'chart',
    title: component.title,
    caption: component.caption ?? component.description,
    displayMode: 'inline',
  }
}

/** Adds a map-state thumbnail right after the reply's opening paragraph; clicking it restores this view. */
export function withMapState(
  reply: AssistantReplyPayload,
  state: { stateId: string; snapshot: StoryAiSnapshot; title: string; tag: string; meta: string },
): AssistantReplyPayload {
  const component: CreatedComponent = {
    id: state.stateId,
    label: state.title,
    type: 'visual',
    title: state.title,
    description: 'Map view after this prompt',
    inlineSize: 'full',
    preview: { kind: 'story-map-state', stateId: state.stateId, snapshot: state.snapshot, tag: state.tag, meta: state.meta },
  }
  const block: AgentResponseBlock = {
    type: 'visual',
    componentId: component.id,
    visualType: 'map',
    title: component.title,
    caption: component.description,
    displayMode: 'inline',
  }
  const blocks = reply.blocks ?? []
  const firstText = blocks.findIndex((item) => item.type === 'text')
  const at = firstText === -1 ? blocks.length : firstText + 1
  return {
    ...reply,
    createdComponents: [component, ...(reply.createdComponents ?? [])],
    blocks: [...blocks.slice(0, at), block, ...blocks.slice(at)],
  }
}

function list(labels: string[]) {
  if (labels.length <= 1) return labels[0] ?? 'the selected components'
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`
}

export function mussafahReply(labels: string[]): AssistantReplyPayload {
  const insight = mussafahInsight(0)
  const columns = MUSSAFAH_REGION.columns.length
  const junctions = MUSSAFAH_REGION.junctions.length
  const steps: ThinkingStep[] = [
    {
      id: 'mussafah-intent',
      kind: 'reasoning',
      title: `The user selected ${list(labels)} and wants them for 2023–2024, with the map focused on ${MUSSAFAH_LABEL}…`,
    },
    {
      id: 'mussafah-query',
      kind: 'search',
      title: `Querying junction counts and value distribution for ${MUSSAFAH_LABEL}, Jan 2023 – Dec 2024…`,
    },
    {
      id: 'mussafah-rebuild',
      kind: 'search',
      title: 'Rebuilding the selected components and the executive summary…',
    },
    {
      id: 'mussafah-map',
      kind: 'reasoning',
      title: `Moving the camera to ${MUSSAFAH_LABEL} and growing the new columns and disks…`,
    },
    { id: 'mussafah-done', kind: 'done', title: 'Story updated' },
  ]

  const volume = chartComponent(
    'story-mussafah-volume',
    {
      type: 'trend',
      title: 'Traffic Volume vs Typical Pattern',
      value: '11.8k',
      unit: 'veh/h peak',
      legend: ['2024', '2023'],
      yLabels: insight.volumeLabels,
      xLabels: MUSSAFAH_VOLUME_X,
      line: insight.volumeLine,
      color: '#7dcea0',
      dashed: true,
    },
    '2024 ran above the 2023 pattern from March onward, with the widest gap in the Q4 freight season.',
  )
  const load = chartComponent(
    'story-mussafah-load',
    {
      type: 'bars',
      title: 'Average Junction Load by Corridor',
      value: `${insight.load}`,
      unit: '% average',
      color: '#ee7b93',
      rows: [
        { label: 'E30 approach', value: 96, display: '96%' },
        { label: 'M-10 / M-12', value: 91, display: '91%' },
        { label: 'Mussafah–ICAD link', value: 84, display: '84%' },
        { label: 'M-26 industrial', value: 72, display: '72%' },
        { label: 'Sheikh Zayed St', value: 63, display: '63%' },
      ],
    },
    `${MUSSAFAH_BUSY} of ${junctions} junctions ran above capacity at the 06:00–09:00 peak.`,
  )

  return {
    headline: `Refocused the story on ${MUSSAFAH_LABEL} for 2023–2024.`,
    headlineDetail: `Kept ${list(labels)}, regenerated the executive summary and moved the map to ${MUSSAFAH_LABEL}.`,
    thinkingSteps: steps,
    timeline: timeline(steps),
    createdComponents: [volume, load],
    blocks: [
      { type: 'heading', content: 'What changed in the story' },
      {
        type: 'text',
        content: `I filtered the story to ${MUSSAFAH_LABEL} and 2023–2024. The left panel now shows only ${list(labels)} under a new executive summary, and the map flew to ${MUSSAFAH_LABEL}, where ${columns} value columns and ${junctions} monitored junctions grew in.`,
      },
      { type: 'heading', content: 'Traffic volume' },
      {
        type: 'text',
        content:
          'Traffic volume grew 14% year over year. Freight movements around the industrial sectors drive most of the increase, and the morning shift change is now the sharpest peak of the day.',
      },
      visual(volume),
      { type: 'heading', content: 'Junction load' },
      {
        type: 'text',
        content: `Average junction load reached ${insight.load}% across ${MUSSAFAH_LABEL}. The E30 approach and the M-10 / M-12 junctions carry the heaviest load.`,
      },
      visual(load),
      { type: 'heading', content: 'Recommendation' },
      {
        type: 'text',
        content:
          'Prioritize signal retiming on the E30 approach and the M-10 / M-12 junctions for the 06:00–09:00 window; together they account for most of the overloaded intersections in the area.',
      },
    ],
  }
}

/** Approach 2: the attached chart cards re-scoped to 2024–2025; the map is left as is. */
export function periodReply(components: ChatComponent[], scene: StoryScene): AssistantReplyPayload {
  const labels = components.map((item) => item.label)
  const now = scene.insight
  const past = periodScene(scene).insight
  const steps: ThinkingStep[] = [
    {
      id: 'period-intent',
      kind: 'reasoning',
      title: `The user attached ${list(labels)} and wants the data from 2024 to 2025, without changing the map…`,
    },
    {
      id: 'period-query',
      kind: 'search',
      title: 'Querying junction counts and load history, Jan 2024 – Dec 2025…',
    },
    {
      id: 'period-rebuild',
      kind: 'search',
      title: `Re-plotting ${list(labels)} for ${CHART_PERIOD_LABEL}…`,
    },
    { id: 'period-done', kind: 'done', title: 'Charts updated' },
  ]

  const createdComponents: CreatedComponent[] = []
  const blocks: AgentResponseBlock[] = [
    {
      type: 'text',
      content: `I re-plotted ${list(labels)} for ${CHART_PERIOD_LABEL}. The ${
        components.length === 1 ? 'chart' : 'charts'
      } in the story panel now show the same period; the map and its filters are unchanged.`,
    },
  ]
  const add = (heading: string, text: string, component: CreatedComponent) => {
    createdComponents.push(component)
    blocks.push({ type: 'heading', content: heading }, { type: 'text', content: text }, visual(component))
  }

  for (const { id, label } of components) {
    if (id === 'emissions') {
      add(
        'Traffic volume',
        'Volume climbed through 2024 and peaked in Q3 2025, 11% above the 2024 pattern. The gap opened in spring and held through the summer freight season.',
        chartComponent(
          'story-period-volume',
          {
            type: 'trend',
            title: label,
            value: '9.4k',
            unit: 'veh/h peak',
            legend: PERIOD_VOLUME_LEGEND,
            yLabels: past.emissionsLabels,
            xLabels: PERIOD_VOLUME_X,
            fromLine: warpPath(EMISSIONS_LINE, now.emissionsWarp),
            line: warpPath(EMISSIONS_LINE, past.emissionsWarp),
            color: '#7dcea0',
            dashed: true,
          },
          '2025 ran above the 2024 pattern from March onward.',
        ),
      )
    } else if (id === 'groundwater') {
      add(
        'Junction load',
        `Average junction load ran at ${past.groundwaterValue}% across ${CHART_PERIOD_LABEL}, ${
          past.groundwaterValue - now.groundwaterValue
        } points above today's ${now.groundwaterValue}%. Load eased after the Q3 2025 signal retiming.`,
        chartComponent(
          'story-period-load',
          {
            type: 'trend',
            title: label,
            value: `${past.groundwaterValue}`,
            unit: '% average',
            yLabels: ['100', '50', '0'],
            xLabels: PERIOD_LOAD_X,
            fromLine: warpPath(GROUNDWATER_LINE, now.groundwaterWarp),
            line: warpPath(GROUNDWATER_LINE, past.groundwaterWarp),
            color: '#ee7b93',
          },
          'Quarterly average load, Q1 2024 – Q4 2025.',
        ),
      )
    } else if (id === 'biodiversity') {
      add(
        'Junction status',
        `${past.marine} junctions were congested in ${CHART_PERIOD_LABEL}, ${past.marine - now.marine} more than today. Most of them sit on the freight corridors that were widened in late 2025.`,
        chartComponent(
          'story-period-status',
          {
            type: 'status',
            title: label,
            terrestrial: past.terrestrial,
            marine: past.marine,
            from: { terrestrial: now.terrestrial, marine: now.marine },
          },
          `Junction status, current period vs ${CHART_PERIOD_LABEL}.`,
        ),
      )
    } else {
      add(
        'Live junction data',
        `${past.online} of ${past.sites} junctions reported over ${CHART_PERIOD_LABEL} (${past.uptime}% coverage). Coverage has improved since the sensor upgrade in 2025.`,
        chartComponent(
          'story-period-sites',
          {
            type: 'sites',
            title: label,
            online: past.online,
            sites: past.sites,
            uptime: past.uptime,
            offlineBars: past.offlineBars,
            from: { online: now.online, uptime: now.uptime, offlineBars: now.offlineBars },
          },
          `Reporting junctions, current period vs ${CHART_PERIOD_LABEL}.`,
        ),
      )
    }
  }

  return {
    headline: `Updated ${list(labels)} to ${CHART_PERIOD_LABEL}.`,
    headlineDetail: 'Only the selected charts changed; the map is unchanged.',
    thinkingSteps: steps,
    timeline: timeline(steps),
    createdComponents,
    blocks,
  }
}

/** Approach 2: the top 10 schools annotated on the map (highlighted columns, areas, tooltips). */
export function topSchoolsReply(annotation: StoryMapAnnotation): AssistantReplyPayload {
  const { schools, areas, location } = annotation
  const count = schools.length
  const scope = location ? ` in ${location}` : ''
  const steps: ThinkingStep[] = [
    {
      id: 'schools-intent',
      kind: 'reasoning',
      title: `The user wants the ${TOP_SCHOOLS_COUNT} schools with the most traffic around them${scope} over ${TOP_SCHOOLS_PERIOD}, annotated on the map…`,
    },
    ...(location
      ? [
          {
            id: 'schools-location',
            kind: 'reasoning' as const,
            title: `Limiting the columns to the ${location} outline from the location context…`,
          },
        ]
      : []),
    {
      id: 'schools-query',
      kind: 'search',
      title: `Ranking schools${scope} by peak-hour traffic within 500 m, last 2 months…`,
    },
    {
      id: 'schools-areas',
      kind: 'reasoning',
      title: location
        ? `Outlining ${location} and pinning the ${count} columns inside it…`
        : `Grouping the ${TOP_SCHOOLS_COUNT} columns by distance and outlining the areas they cover…`,
    },
    { id: 'schools-done', kind: 'done', title: 'Map annotated' },
  ]

  if (count === 0) {
    return {
      headline: `No schools found${scope}.`,
      headlineDetail: 'Outlined the area on the map; it has no monitored columns.',
      thinkingSteps: steps,
      timeline: timeline(steps),
      blocks: [
        {
          type: 'text',
          content: `I outlined ${location ?? 'the area'} on the map, but none of the monitored school columns fall inside it. Try a larger area, or pick a district from the location search.`,
        },
      ],
    }
  }

  const top = schools[0]
  const ranking = chartComponent(
    'story-top-schools',
    {
      type: 'bars',
      title: `Top ${count} schools${scope} by nearby traffic`,
      value: top.peak.toLocaleString('en-US'),
      unit: 'veh/h peak at #1',
      color: annotation.color,
      rows: schools.map((school) => ({
        label: `${school.rank}. ${school.name}`,
        value: (school.peak / top.peak) * 100,
        display: school.peak.toLocaleString('en-US'),
      })),
    },
    `Peak-hour vehicles within 500 m of each school${scope}, last 2 months.`,
  )
  const areaText = areas
    .map((area) => `${area.label} (${area.junctions} monitored ${area.junctions === 1 ? 'junction' : 'junctions'})`)
    .join('; ')
  const average = Math.round(schools.reduce((sum, school) => sum + school.change, 0) / count)
  const rising = [...schools].sort((a, b) => b.change - a.change)[0]
  const area = areas[0]

  return {
    headline: `Annotated the top ${count} schools${scope} on the map.`,
    headlineDetail: location
      ? `Outlined ${location}, highlighted the ${count} columns inside it and added a tooltip to each school.`
      : `Highlighted their columns, outlined ${areas.length} ${areas.length === 1 ? 'area' : 'areas'} and added a tooltip to each school.`,
    thinkingSteps: steps,
    timeline: timeline(steps),
    createdComponents: [ranking],
    blocks: [
      {
        type: 'text',
        content: `I ranked schools${scope} by peak-hour traffic within 500 m over ${TOP_SCHOOLS_PERIOD} and annotated the top ${count} on the map. Their columns are now highlighted, the rest of the map is dimmed, and each column has a numbered pin — hover one to see the school's details.`,
      },
      { type: 'heading', content: 'Ranking' },
      {
        type: 'text',
        content: `${top.name} in ${top.district} leads with ${top.peak.toLocaleString('en-US')} vehicles an hour at peak. Traffic around the ${count} schools rose ${average}% on average compared with the 2 months before.`,
      },
      visual(ranking),
      { type: 'heading', content: location ? 'The area' : 'Where they cluster' },
      {
        type: 'text',
        content: location
          ? `${location} is outlined on the map: ${area.junctions} monitored ${area.junctions === 1 ? 'junction' : 'junctions'} sit inside it, and the disks outside it are faded.`
          : `The ${count} schools fall into ${areas.length} ${areas.length === 1 ? 'area' : 'areas'}, outlined on the map: ${areaText}.`,
      },
      { type: 'heading', content: 'Insights' },
      {
        type: 'text',
        content: `${rising.name} saw the sharpest rise (+${rising.change}%). Staggered drop-off times and signal priority at the junctions inside the ${area.district} area would relieve the most schools at once.`,
      },
    ],
  }
}

const FILTER_TEXT = `${AREA_FILTER_LABELS.type} · ${AREA_FILTER_LABELS.gender} · ${AREA_FILTER_LABELS.level}`

export function areaFilterReply(stats: AreaFilterStats): AssistantReplyPayload {
  const steps: ThinkingStep[] = [
    {
      id: 'area-intent',
      kind: 'reasoning',
      title: `The user drew an area on the map and wants to see the columns and disks for one school type, gender and level…`,
    },
    {
      id: 'area-query',
      kind: 'search',
      title: `Filtering ${stats.columns} columns and ${stats.junctions} junctions in the selected area to ${FILTER_TEXT}…`,
    },
    {
      id: 'area-compare',
      kind: 'reasoning',
      title: 'Comparing the filtered values with the full population…',
    },
    { id: 'area-done', kind: 'done', title: 'Map updated' },
  ]

  if (stats.columns === 0 && stats.junctions === 0) {
    return {
      headline: `No columns or disks in the selected area.`,
      thinkingSteps: steps,
      timeline: timeline(steps),
      blocks: [
        {
          type: 'text',
          content: `The area you drew doesn't contain any value columns or monitored junctions, so the ${FILTER_TEXT} filter didn't change the map. Try drawing around a cluster of columns.`,
        },
      ],
    }
  }

  const valueChange = stats.valueBefore === 0 ? 0 : Math.round((1 - stats.valueAfter / stats.valueBefore) * 100)
  const compare = chartComponent(
    'story-area-compare',
    {
      type: 'compare',
      title: 'Selected area · before vs after filter',
      value: `−${valueChange}`,
      unit: '% value',
      legend: ['All schools', FILTER_TEXT],
      rows: [
        {
          label: 'Value index',
          before: stats.valueBefore,
          after: stats.valueAfter,
          beforeDisplay: `${stats.valueBefore}`,
          afterDisplay: `${stats.valueAfter}`,
        },
        {
          label: 'Average junction load',
          before: stats.loadBefore,
          after: stats.loadAfter,
          beforeDisplay: `${stats.loadBefore}%`,
          afterDisplay: `${stats.loadAfter}%`,
        },
        {
          label: 'Busy junctions',
          before: stats.busyBefore,
          after: stats.busyAfter,
          beforeDisplay: `${stats.busyBefore}`,
          afterDisplay: `${stats.busyAfter}`,
        },
      ],
    },
    `Everything outside the selected area is unchanged.`,
  )
  const distribution = chartComponent(
    'story-area-distribution',
    {
      type: 'histogram',
      title: 'Column value distribution',
      value: `${stats.columns}`,
      unit: 'columns in area',
      legend: ['All schools', FILTER_TEXT],
      bins: stats.bins,
      before: stats.binsBefore,
      after: stats.binsAfter,
    },
    'Column heights (value) per band, before and after the filter.',
  )

  const resilientText =
    stats.resilient === 0
      ? 'No column kept more than 70% of its value, so this school segment is spread thinly across the area.'
      : `${stats.resilient} ${stats.resilient === 1 ? 'column kept' : 'columns kept'} more than 70% of ${stats.resilient === 1 ? 'its' : 'their'} value — that's where ${AREA_FILTER_LABELS.type.toLowerCase()} girls' ${AREA_FILTER_LABELS.level} schools concentrate.`

  return {
    headline: `Filtered the selected area to ${FILTER_TEXT}.`,
    headlineDetail: `${stats.columns} columns and ${stats.junctions} disks were recalculated; value dropped ${valueChange}%.`,
    thinkingSteps: steps,
    timeline: timeline(steps),
    createdComponents: [compare, distribution],
    blocks: [
      { type: 'heading', content: 'What changed on the map' },
      {
        type: 'text',
        content: `I applied one school type (${AREA_FILTER_LABELS.type}), one gender (${AREA_FILTER_LABELS.gender}) and one school level (${AREA_FILTER_LABELS.level}) to the ${stats.columns} columns and ${stats.junctions} disks inside the area you drew. The value index fell ${valueChange}% and the columns shrank to match; average junction load eased from ${stats.loadBefore}% to ${stats.loadAfter}%.`,
      },
      visual(compare),
      { type: 'heading', content: 'Distribution shift' },
      {
        type: 'text',
        content: `Most columns moved into the lower value bands. ${resilientText}`,
      },
      visual(distribution),
      { type: 'heading', content: 'Insights' },
      {
        type: 'text',
        content: `Busy junctions in the area drop from ${stats.busyBefore} to ${stats.busyAfter}, so traffic tied to this school segment is a small share of peak demand. Target drop-off management at the remaining tall columns rather than area-wide changes.`,
      },
    ],
  }
}
