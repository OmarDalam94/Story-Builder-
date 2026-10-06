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
