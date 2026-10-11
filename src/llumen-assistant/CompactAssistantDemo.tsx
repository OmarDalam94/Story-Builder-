/**
 * Llumen compact assistant demo — air-quality conversation flow.
 * Integration: theme tokens in src/styles/tokens.css; icons in public/llumen-assets/*.svg.
 */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { CaretDown, Sparkle } from '@phosphor-icons/react'
import { MeshGradient } from '@paper-design/shaders-react'
import gsap from 'gsap'
import styles from './compact-assistant.module.css'
import LandingHomeDefault from './landing/LandingHomeDefault'
import { type LandingContextChip } from './landing/LandingChatbox'
import { HubChatbox } from './landing/HubChatbox'
import { FindingReveal } from './landing/FindingReveal'
import { FindingAuroraPanel } from './landing/FindingAuroraPanel'
import { FindingToastStack } from './landing/FindingToastStack'
import { DEFAULT_FINDING_AURORA, type FindingAuroraSettings } from './landing/findingAuroraSettings'
import {
  FINDING_TOAST_SEED_COUNT,
  isFindingSlashCommand,
  nextFindingFromPool,
  type FindingToastInstance,
  type FindingToastItem,
} from './landing/findingDemoData'
import {
  parseSlashCommand,
  slashChatTitle,
  underwayMessage,
  workUnderwayReply,
} from './slashCommands'
import type { HubChatComponent, HubWorkToast } from './landing/HubChatbox'
import type { LandingTellMeMorePayload } from './landing/LandingHomeDefault'
import { InteractionModelSwitcher } from './InteractionModelSwitcher'
import { HeaderOptionSwitcher } from './HeaderOptionSwitcher'
import {
  AI_APPROACHES,
  aiApproachOption,
  persistAiApproach,
  readAiApproach,
  type AiApproach,
} from './aiApproach'
import {
  persistChatInteractionModel,
  readChatInteractionModel,
  type ChatInteractionModel,
} from './interactionModel'
import { StoryView } from './story/StoryView'
import { MUSSAFAH_LABEL, type StoryAiSnapshot, type StoryMapCapture } from './story/storyAiScenarios'
import { StoryMapStatesContext, type StoryMapStates } from './story/storyMapStates'
import { StoryAiModeBar, type StoryAiModeStatus } from './story/StoryAiModeBar'
import { CHART_PERIOD_LABEL, isChartCard, periodPrompt, type ChatComponent } from './story/storyChartPeriod'
import { sceneAtPhase, storySceneAt } from './story/storyDemoScenes'
import { periodReply, topSchoolsReply, withMapState } from './story/storySelectionReplies'
import {
  TOP_SCHOOLS_PROMPT,
  locationAnnotation,
  locationPrompt,
  locationUsesRegion,
  topSchoolsAnnotation,
  type StoryLocation,
} from './story/storyAnnotations'
import { StoryLocationModal } from './story/StoryLocationModal'
import type { LandingStory } from './story/storyDemoData'
import {
  MESH_COLORS_DEMO_PAGE,
  MESH_FRAME_DEMO_PAGE,
  MESH_MAX_PIXEL_COUNT_DEMO_PAGE,
} from './paperMeshConstants'
import { AssistantHero } from './AssistantHero'
import { AssistantLauncher } from './AssistantLauncher'
import { AssistantPanel } from './AssistantPanel'
import { ChatComposer, type ChatComposerHandle } from './ChatComposer'
import { PanelHeader } from './PanelHeader'
import type { ChatQuestionIndexItem, ChatSearchState } from './PanelHeader'
import { useTranscriptSearch } from './useTranscriptSearch'
import { SessionsPanel } from './SessionsPanel'
import {
  conversationApproach,
  conversationSummary,
  loadConversations,
  loadStoryVersions,
  mapStateIds,
  sameStorySnapshot,
  storeConversations,
  storeStoryVersions,
  type SavedChatMessage,
  type SavedConversation,
} from './savedConversations'
import { ShareModal } from './ShareModal'
import { SourcesPanel } from './SourcesPanel'
import { sourcesForDemoConversation } from './conversationSources'
import { splitTextWithInlineMentions, getCategoryIcon, type InlineContextItem } from './inlineContextData'
import type {
  AgentResponseBlock,
  AssistantReplyPayload,
  CreatedComponent,
  SubcontextState,
} from './assistantReplyTypes'
import { AssistantTimelineReply } from './AssistantTimelineReply'
import { ComponentDetailPanel } from './ComponentDetailPanel'
import { SlidesDetailPanel } from './SlidesDetailPanel'
import {
  AIR_QUALITY_COMPONENTS,
  AIR_QUALITY_REPORT,
  TURN1_REPLY,
  TURN2_REPLY,
  detectConversationTurn,
  findComponent,
  findReport,
  replyForTurn,
} from './airQualityConversationDemo'
import type { SendVisualState } from './SendButton'
import { useRevealScrollbarOnScroll } from './useRevealScrollbarOnScroll'
import { useStickToBottomScroll } from './useStickToBottomScroll'

type ChatMessage = SavedChatMessage

const SUBCONTEXT_EXIT_MS = 280
/** How long the AI mode bar's Update button spins before the story version is stored. */
const STORY_UPDATE_MS = 1200
/** Lets the rail open and start thinking before the attached charts animate to the new period. */

/** Design-capture presets via `?preview=<name>` (used for Figma handoff). */
type FigmaPreviewMode =
  | 'empty'
  | 'conversation'
  | 'sessions'
  | 'fullscreen'
  | 'fullscreen-sessions'
  | 'detail'

function readFigmaPreviewMode(): FigmaPreviewMode | null {
  if (typeof window === 'undefined') return null
  const value = new URLSearchParams(window.location.search).get('preview')
  switch (value) {
    case 'empty':
    case 'conversation':
    case 'sessions':
    case 'fullscreen':
    case 'fullscreen-sessions':
    case 'detail':
      return value
    default:
      return null
  }
}

function buildConversationSeed(): ChatMessage[] {
  return [
    {
      id: 'preview-u1',
      role: 'user',
      text: 'What is driving the deterioration in air quality, where is it concentrated, and who may be exposed?',
    },
    {
      id: 'preview-a1',
      role: 'assistant',
      text: '',
      reply: TURN1_REPLY,
    },
    {
      id: 'preview-u2',
      role: 'user',
      text: 'Are elevated NO₂ and PM₂.₅ more consistent with traffic or industrial activity?',
    },
    {
      id: 'preview-a2',
      role: 'assistant',
      text: '',
      reply: TURN2_REPLY,
    },
  ]
}

const SESSIONS_SIDEBAR_BREAKPOINT_PX = 1536

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function truncateTitle(text: string, max = 52) {
  const cleaned = text.replace(/\s+/g, ' ').trim()
  if (cleaned.length <= max) return cleaned
  const slice = cleaned.slice(0, max - 1)
  const lastSpace = slice.lastIndexOf(' ')
  return `${(lastSpace > 24 ? slice.slice(0, lastSpace) : slice).trim()}…`
}

function titleFromReply(reply: AssistantReplyPayload) {
  if (reply.headline?.trim()) return truncateTitle(reply.headline)
  const firstText = reply.blocks?.find((b) => b.type === 'text')
  if (firstText?.type === 'text' && firstText.content.trim()) return truncateTitle(firstText.content)
  if (reply.confirmation?.trim()) return truncateTitle(reply.confirmation)
  return 'New chat'
}

function UserMessageBubble({
  messageId,
  text,
  questions,
  onJumpToQuestion,
}: {
  messageId: string
  text: string
  questions: ChatQuestionIndexItem[]
  onJumpToQuestion: (questionId: string) => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const showJump = questions.length > 1

  useEffect(() => {
    if (!menuOpen) return
    const onPointer = (e: MouseEvent) => {
      if (menuRef.current?.contains(e.target as Node)) return
      setMenuOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('mousedown', onPointer)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onPointer)
      window.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  return (
    <div data-message-id={messageId} className={styles.msgUserRow}>
      <div className={styles.msgUser}>
        <span className={styles.msgUserText}>
          {splitTextWithInlineMentions(text).map((segment, index) => {
            if (segment.type !== 'mention') {
              return <span key={`t-${index}`}>{segment.value}</span>
            }
            const Icon = getCategoryIcon(segment.categoryId)
            return (
              <span key={`m-${index}`} className={styles.inlineMention}>
                <Icon className={styles.inlineMentionIcon} size={12} weight="bold" aria-hidden />
                <span className={styles.inlineMentionLabel}>{segment.name}</span>
              </span>
            )
          })}
        </span>
        {showJump ? (
          <div className={styles.msgUserJumpWrap} ref={menuRef}>
            <button
              type="button"
              className={styles.msgUserJumpBtn}
              aria-label="Jump to another message"
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              onClick={() => setMenuOpen((v) => !v)}
            >
              <CaretDown size={14} weight="bold" aria-hidden />
            </button>
            {menuOpen ? (
              <div className={styles.msgUserJumpMenu} role="menu" aria-label="Your messages in this chat">
                {questions.map((item, index) => (
                  <button
                    key={item.id}
                    type="button"
                    role="menuitem"
                    className={`${styles.msgUserJumpItem}${
                      item.id === messageId ? ` ${styles.msgUserJumpItemActive}` : ''
                    }`}
                    onClick={() => {
                      onJumpToQuestion(item.id)
                      setMenuOpen(false)
                    }}
                  >
                    <span className={styles.msgUserJumpItemNum}>{index + 1}</span>
                    <span className={styles.msgUserJumpItemText}>{item.question}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function FindingNotificationLayer({
  toasts,
  toastIndex,
  stackVisible,
  auroraPanelOpen,
  aurora,
  replayKey,
  onReady,
  onIndexChange,
  onDismiss,
  onTellMeMore,
}: {
  toasts: FindingToastInstance[]
  toastIndex: number
  stackVisible: boolean
  auroraPanelOpen: boolean
  aurora: FindingAuroraSettings
  replayKey: number
  onReady: () => void
  onIndexChange: (index: number) => void
  onDismiss: () => void
  onTellMeMore: (item: LandingTellMeMorePayload) => void
}) {
  const showStack = stackVisible && toasts.length > 0 && !auroraPanelOpen
  const showReveal = auroraPanelOpen || (toasts.length > 0 && !stackVisible)
  return (
    <>
      {showStack ? (
        <FindingToastStack
          items={toasts}
          activeIndex={toastIndex}
          onActiveIndexChange={onIndexChange}
          onDismiss={onDismiss}
          onTellMeMore={onTellMeMore}
        />
      ) : null}
      {showReveal ? (
        <FindingReveal
          key={replayKey}
          count={toasts.length || FINDING_TOAST_SEED_COUNT}
          settings={aurora}
          hold={auroraPanelOpen}
          onReady={onReady}
        />
      ) : null}
    </>
  )
}

type StoryApplyStage = { visualId: string | null; snapshot: StoryAiSnapshot }

/** Map screenshot for the reply's map-state card, taken once the last change has animated in. */
type StoryMapCaptureRequest = { stateId: string; delay: number }

type PendingStoryApply = {
  messageId: string
  storyId: string | null
  conversationId: string
  stages: StoryApplyStage[]
  applied: number
  capture: StoryMapCaptureRequest | null
}

/** Period re-plots leave the map as is; annotations fly the camera, and Mussafah also grows its region. */
const PERIOD_CAPTURE_DELAY_MS = 700
const ANNOTATION_CAPTURE_DELAY_MS = 3400
const REGION_ANNOTATION_CAPTURE_DELAY_MS = 4900

export function CompactAssistantDemo() {
  const previewMode = useMemo(() => readFigmaPreviewMode(), [])
  const previewForceInstant = previewMode != null
  const [interactionModel, setInteractionModel] = useState<ChatInteractionModel>(() =>
    readChatInteractionModel(previewMode != null),
  )
  const isHub = interactionModel === 'hub'
  const [aiApproach, setAiApproach] = useState<AiApproach>(readAiApproach)
  const aiFeatures = aiApproachOption(aiApproach).features
  const [open, setOpen] = useState(() => previewMode != null)
  const [expanded, setExpanded] = useState(
    () => previewMode === 'fullscreen' || previewMode === 'fullscreen-sessions',
  )
  const [draft, setDraft] = useState('')
  const [subcontext, setSubcontext] = useState<SubcontextState>(() =>
    previewMode === 'detail'
      ? { view: 'map', componentId: 'air-quality-monitoring-map' }
      : { view: 'closed' },
  )
  const [subcontextClosing, setSubcontextClosing] = useState(false)
  const [sessionsOpen, setSessionsOpen] = useState(
    () => previewMode === 'sessions' || previewMode === 'fullscreen-sessions',
  )
  const [shareOpen, setShareOpen] = useState(false)
  const [activeStoryId, setActiveStoryId] = useState<string | null>(null)
  const [storySelectMode, setStorySelectMode] = useState(false)
  /** Story changes owned by the current conversation; a new token makes the story animate to them. */
  const [storyAi, setStoryAi] = useState<{
    token: number
    snapshot: StoryAiSnapshot | null
    storyId: string | null
    /** Conversation whose prompts produced `snapshot`; reopened from the AI mode bar. */
    conversationId: string | null
    capture?: StoryMapCaptureRequest | null
  }>({ token: 0, snapshot: null, storyId: null, conversationId: null })
  const [storyVersions, setStoryVersions] = useState<Record<string, StoryAiSnapshot>>(loadStoryVersions)
  /** Update in progress: the bar spins before `snapshot` becomes the story's saved version. */
  const [storyUpdate, setStoryUpdate] = useState<{ conversationId: string; snapshot: StoryAiSnapshot } | null>(null)
  /** Story whose AI mode bar is showing; it stays up until the story is closed. */
  const [aiBarStoryId, setAiBarStoryId] = useState<string | null>(null)
  /** Map screenshots + cameras behind each reply's map-state card. */
  const [mapCaptures, setMapCaptures] = useState<Record<string, StoryMapCapture>>({})
  const [activeMapStateId, setActiveMapStateId] = useState<string | null>(null)
  const [conversations, setConversations] = useState<SavedConversation[]>(loadConversations)
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  /** Replies loaded from a saved conversation render finished instead of replaying their reveal. */
  const [settledReplyIds, setSettledReplyIds] = useState<ReadonlySet<string>>(() => new Set())
  const [landingChips, setLandingChips] = useState<LandingContextChip[]>([])
  const [landingFocusToken, setLandingFocusToken] = useState(0)
  const [findingToasts, setFindingToasts] = useState<FindingToastInstance[]>([])
  const [findingToastIndex, setFindingToastIndex] = useState(0)
  const [findingStackVisible, setFindingStackVisible] = useState(false)
  const [findingAurora, setFindingAurora] = useState<FindingAuroraSettings>(DEFAULT_FINDING_AURORA)
  const [auroraPanelOpen, setAuroraPanelOpen] = useState(false)
  const [auroraReplayKey, setAuroraReplayKey] = useState(0)
  const findingPoolIndexRef = useRef(0)
  const [hubWorkToast, setHubWorkToast] = useState<HubWorkToast | null>(null)
  const hubWorkUserTextRef = useRef('')
  const [hubStoryOpen, setHubStoryOpen] = useState(false)
  const [hubMorphFrom, setHubMorphFrom] = useState<DOMRect | null>(null)
  /** Approach 2: story chart cards attached to the hub chatbox via "Add to chat". */
  const [storyChatComponents, setStoryChatComponents] = useState<ChatComponent[]>([])
  const pendingStoryApplyRef = useRef<PendingStoryApply | null>(null)
  const [storySlideIndex, setStorySlideIndex] = useState(0)
  const [hubRailMode, setHubRailMode] = useState<'thread' | 'sessions'>('thread')
  const [chatSearch, setChatSearch] = useState<ChatSearchState>({ open: false, query: '' })
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    previewMode === 'conversation' ||
    previewMode === 'sessions' ||
    previewMode === 'fullscreen' ||
    previewMode === 'fullscreen-sessions' ||
    previewMode === 'detail'
      ? buildConversationSeed()
      : [],
  )
  const [sources, setSources] = useState(() =>
    sourcesForDemoConversation(
      previewMode === 'conversation' ||
        previewMode === 'sessions' ||
        previewMode === 'fullscreen' ||
        previewMode === 'fullscreen-sessions' ||
        previewMode === 'detail',
    ),
  )
  const [sourcesPanelDismissed, setSourcesPanelDismissed] = useState(false)
  const [streaming, setStreaming] = useState(false)
  const [replyRendering, setReplyRendering] = useState(false)
  const [chatTitle, setChatTitle] = useState(() =>
    previewMode && previewMode !== 'empty' ? 'Air quality corridor review' : 'New chat',
  )
  const titleEditedRef = useRef(false)
  const streamTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const assistantMsgId = useRef<string | null>(null)
  const assistantPanelRef = useRef<HTMLDivElement>(null)
  const subcontextCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const chatMiddleRef = useRef<HTMLDivElement>(null)
  const pendingPanelAnimRef = useRef<{ width: number; height: number; top: number; left: number } | null>(
    null,
  )
  const revealSessionsAfterExpandRef = useRef(false)
  const subcontextViewRef = useRef(subcontext.view)
  subcontextViewRef.current = subcontext.view
  const transcriptRevealRef = useRevealScrollbarOnScroll()
  const composerRef = useRef<ChatComposerHandle>(null)
  const transcriptContentKey = `${messages.length}:${streaming ? '1' : '0'}`
  const { ref: transcriptStickRef, releaseStick } = useStickToBottomScroll(transcriptContentKey)
  const transcriptElRef = useRef<HTMLDivElement | null>(null)

  const syncTranscriptScrollbarInset = useCallback(() => {
    const middle = chatMiddleRef.current
    if (!middle) return
    const tokenPx =
      Number.parseFloat(getComputedStyle(middle).getPropertyValue('--lc-scrollbar-size')) || 4
    // Keep a fixed reserve (token) in empty + filled states. Measuring the live
    // scrollbar/gutter made the composer shrink when the first answer appeared.
    middle.style.setProperty('--lc-transcript-scrollbar-inset', `${tokenPx}px`)
  }, [])

  const transcriptScrollRef = useCallback(
    (el: HTMLDivElement | null) => {
      transcriptElRef.current = el
      transcriptRevealRef(el)
      transcriptStickRef(el)
      syncTranscriptScrollbarInset()
    },
    [transcriptRevealRef, transcriptStickRef, syncTranscriptScrollbarInset],
  )

  const searchQueryActive = chatSearch.open ? chatSearch.query : ''
  const {
    matchCount: searchMatchCount,
    activeIndex: searchActiveMatch,
    goNext: goNextSearchMatch,
    goPrev: goPrevSearchMatch,
  } = useTranscriptSearch({
    rootRef: transcriptElRef,
    query: searchQueryActive,
    revision: transcriptContentKey,
    hitClass: styles.searchHit,
    activeHitClass: styles.searchHitActive,
  })

  const onChatSearchChange = useCallback((state: ChatSearchState) => {
    setChatSearch(state)
  }, [])

  const onSearchMatchNavigate = useCallback(
    (direction: 'prev' | 'next') => {
      releaseStick()
      if (direction === 'prev') goPrevSearchMatch()
      else goNextSearchMatch()
    },
    [releaseStick, goPrevSearchMatch, goNextSearchMatch],
  )

  useEffect(() => {
    const transcript = transcriptElRef.current
    syncTranscriptScrollbarInset()
    if (!transcript) return
    const ro = new ResizeObserver(() => syncTranscriptScrollbarInset())
    ro.observe(transcript)
    window.addEventListener('resize', syncTranscriptScrollbarInset)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', syncTranscriptScrollbarInset)
    }
  }, [syncTranscriptScrollbarInset, transcriptContentKey])

  useLayoutEffect(() => {
    const start = pendingPanelAnimRef.current
    if (!start) return
    pendingPanelAnimRef.current = null
    const el = assistantPanelRef.current
    if (!el) return

    const vw = window.innerWidth
    const vh = window.innerHeight

    gsap.killTweensOf(el)

    if (expanded) {
      const end = { top: 0, left: 0, width: vw, height: vh }
      gsap.set(el, {
        position: 'fixed',
        top: start.top,
        left: start.left,
        width: start.width,
        height: start.height,
        margin: 0,
        right: 'auto',
        bottom: 'auto',
      })
      const tween = gsap.to(el, {
        top: end.top,
        left: end.left,
        width: end.width,
        height: end.height,
        duration: 0.62,
        ease: 'power3.inOut',
        onComplete: () => {
          gsap.set(el, { clearProps: 'top,left,width,height,margin,right,bottom,position' })
          if (revealSessionsAfterExpandRef.current && subcontextViewRef.current === 'closed') {
            setSessionsOpen(true)
          }
          revealSessionsAfterExpandRef.current = false
        },
      })
      return () => {
        tween.kill()
        gsap.set(el, { clearProps: 'top,left,width,height,margin,right,bottom,position' })
      }
    }

    const endRect = el.getBoundingClientRect()
    gsap.set(el, {
      position: 'fixed',
      top: start.top,
      left: start.left,
      width: start.width,
      height: start.height,
      margin: 0,
      right: 'auto',
      bottom: 'auto',
    })
    const tween = gsap.to(el, {
      top: endRect.top,
      left: endRect.left,
      width: endRect.width,
      height: endRect.height,
      duration: 0.62,
      ease: 'power3.inOut',
      onComplete: () => {
        gsap.set(el, { clearProps: 'top,left,width,height,margin,right,bottom,position' })
      },
    })
    return () => {
      tween.kill()
      gsap.set(el, { clearProps: 'top,left,width,height,margin,right,bottom,position' })
    }
  }, [expanded])

  const clearStream = useCallback(() => {
    if (streamTimer.current) {
      clearTimeout(streamTimer.current)
      streamTimer.current = null
    }
    assistantMsgId.current = null
    setStreaming(false)
    setReplyRendering(false)
  }, [])

  useEffect(() => {
    return () => clearStream()
  }, [clearStream])

  const openSubcontext = useCallback((next: SubcontextState) => {
    if (subcontextCloseTimerRef.current != null) {
      clearTimeout(subcontextCloseTimerRef.current)
      subcontextCloseTimerRef.current = null
    }
    setSubcontextClosing(false)
    setSubcontext(next)
  }, [])

  const closeSubcontext = useCallback(() => {
    if (subcontext.view === 'closed' || subcontextCloseTimerRef.current != null) return
    setSubcontextClosing(true)
    subcontextCloseTimerRef.current = setTimeout(() => {
      subcontextCloseTimerRef.current = null
      setSubcontext({ view: 'closed' })
      setSubcontextClosing(false)
    }, SUBCONTEXT_EXIT_MS)
  }, [subcontext.view])

  const closeSubcontextImmediately = useCallback(() => {
    if (subcontextCloseTimerRef.current != null) {
      clearTimeout(subcontextCloseTimerRef.current)
      subcontextCloseTimerRef.current = null
    }
    setSubcontextClosing(false)
    setSubcontext({ view: 'closed' })
  }, [])

  useEffect(() => {
    return () => {
      if (subcontextCloseTimerRef.current != null) clearTimeout(subcontextCloseTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (subcontext.view !== 'closed') setSessionsOpen(false)
  }, [subcontext.view])

  /** Applies the reply's story changes up to `count` stages; the last stage lands when the reply finishes. */
  const applyStoryStages = useCallback((messageId: string, upTo: number) => {
    const pending = pendingStoryApplyRef.current
    if (!pending || pending.messageId !== messageId) return
    const count = Math.min(upTo, pending.stages.length)
    if (count <= pending.applied) return
    pending.applied = count
    const last = count >= pending.stages.length
    if (last) pendingStoryApplyRef.current = null
    const { snapshot } = pending.stages[count - 1]
    setStoryAi((current) => ({
      token: current.token + 1,
      snapshot,
      storyId: pending.storyId,
      conversationId: pending.conversationId,
      capture: last ? pending.capture : null,
    }))
  }, [])

  const flushStoryApply = useCallback(() => {
    const pending = pendingStoryApplyRef.current
    if (pending) applyStoryStages(pending.messageId, pending.stages.length)
  }, [applyStoryStages])

  /** A story change shows up on the story when its visual appears in the chat. */
  const onReplyVisual = useCallback(
    (messageId: string, componentId: string) => {
      const index = pendingStoryApplyRef.current?.stages.findIndex((stage) => stage.visualId === componentId) ?? -1
      if (index >= 0) applyStoryStages(messageId, index + 1)
    },
    [applyStoryStages],
  )

  /** Hiding the rail unmounts the thread; mark replies finished so reopening doesn't replay them. */
  const settleReplies = useCallback(() => {
    flushStoryApply()
    setSettledReplyIds((current) => {
      const ids = messages.filter((msg) => msg.role === 'assistant' && !current.has(msg.id)).map((msg) => msg.id)
      return ids.length > 0 ? new Set([...current, ...ids]) : current
    })
  }, [flushStoryApply, messages])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (shareOpen) return
      if (isHub && hubStoryOpen && !open) {
        e.preventDefault()
        setHubStoryOpen(false)
        setHubMorphFrom(null)
        return
      }
      if (!open) return
      e.preventDefault()
      if (subcontext.view !== 'closed') {
        closeSubcontext()
        return
      }
      if (isHub && hubRailMode === 'sessions') {
        setOpen(false)
        setSessionsOpen(false)
        setHubRailMode('thread')
        return
      }
      if (sessionsOpen) {
        setSessionsOpen(false)
        return
      }
      if (expanded) {
        const el = assistantPanelRef.current
        if (el) {
          const rect = el.getBoundingClientRect()
          pendingPanelAnimRef.current = {
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
          }
        }
        setExpanded(false)
        return
      }
      settleReplies()
      setOpen(false)
      setExpanded(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, subcontext.view, closeSubcontext, expanded, sessionsOpen, shareOpen, isHub, hubStoryOpen, hubRailMode, settleReplies])

  const startAssistantReply = useCallback((reply: AssistantReplyPayload) => {
    const aid = uid()
    assistantMsgId.current = aid
    setMessages((m) => [...m, { id: aid, role: 'assistant', text: '', reply }])
    setStreaming(true)
    setReplyRendering(true)

    const thinkingMs = Math.max(900, (reply.timeline.length || 1) * 540)
    streamTimer.current = setTimeout(() => {
      streamTimer.current = null
      assistantMsgId.current = null
      setStreaming(false)
    }, thinkingMs)
    return aid
  }, [])

  const pushFindingToast = useCallback(() => {
    // First `/finding` seeds a Z-stack; later calls add one more on top.
    const seeding = findingToasts.length === 0
    const count = seeding ? FINDING_TOAST_SEED_COUNT : 1
    const batch: FindingToastInstance[] = []
    for (let i = 0; i < count; i++) {
      const template = nextFindingFromPool(findingPoolIndexRef.current)
      findingPoolIndexRef.current += 1
      batch.push({ ...template, instanceId: uid() })
    }
    setFindingToasts((prev) => [...prev, ...batch].slice(-6))
    setFindingToastIndex(Math.min(findingToasts.length + batch.length - 1, 5))
    if (seeding) setFindingStackVisible(false)
  }, [findingToasts.length])

  const onFindingRevealReady = useCallback(() => {
    setFindingStackVisible(true)
  }, [])

  const dismissFindingToasts = useCallback(() => {
    setFindingToasts([])
    setFindingToastIndex(0)
    setFindingStackVisible(false)
  }, [])

  const sendText = useCallback(
    (raw: string) => {
      const t = raw.trim()
      if (!t || streaming) return
      if (isFindingSlashCommand(t)) {
        setDraft('')
        pushFindingToast()
        return
      }
      const slash = parseSlashCommand(t)
      if (slash) {
        setDraft('')
        const priorAssistant = messages.filter((msg) => msg.role === 'assistant').length
        if (!titleEditedRef.current && priorAssistant === 0) {
          setChatTitle(truncateTitle(slashChatTitle(slash)))
        }
        setActiveConversationId((id) => id ?? uid())
        setMessages((m) => [...m, { id: uid(), role: 'user', text: t }])
        startAssistantReply(workUnderwayReply(slash))
        return
      }
      setDraft('')
      const priorAssistant = messages.filter((msg) => msg.role === 'assistant').length
      const turn = detectConversationTurn(t, priorAssistant)
      const reply = replyForTurn(turn)
      if (!titleEditedRef.current && priorAssistant === 0) {
        setChatTitle(titleFromReply(reply))
      }
      if (priorAssistant === 0) {
        setSources((prev) => (prev.length > 0 ? prev : sourcesForDemoConversation(true)))
        setSourcesPanelDismissed(false)
      }
      setActiveConversationId((id) => id ?? uid())
      setMessages((m) => [...m, { id: uid(), role: 'user', text: t }])
      startAssistantReply(reply)
    },
    [streaming, messages, startAssistantReply, pushFindingToast],
  )

  /** Story select mode already applied its map/panel changes; show the exchange in the rail. */
  const submitStorySelection = useCallback(
    ({ prompt, reply, snapshot }: { prompt: string; reply: AssistantReplyPayload; snapshot: StoryAiSnapshot }) => {
      const conversationId = activeConversationId ?? uid()
      setStoryAi((current) => ({ ...current, snapshot, storyId: activeStoryId, conversationId }))
      setActiveMapStateId(
        mapStateIds([{ id: '', role: 'assistant', text: '', reply }])[0] ?? null,
      )
      setActiveConversationId(conversationId)
      clearStream()
      setStorySelectMode(false)
      setLandingChips([])
      setHubRailMode('thread')
      setSessionsOpen(false)
      setOpen(true)
      setExpanded(false)
      if (!titleEditedRef.current && !messages.some((msg) => msg.role === 'assistant')) {
        setChatTitle(titleFromReply(reply))
      }
      setMessages((m) => [...m, { id: uid(), role: 'user', text: prompt }])
      startAssistantReply(reply)
    },
    [activeConversationId, activeStoryId, clearStream, messages, startAssistantReply],
  )

  /** Approach 2: attach a hovered chart card to the story chatbox. */
  const addStoryComponentToChat = useCallback(
    (component: ChatComponent, sourceRect: DOMRect) => {
      if (open) {
        settleReplies()
        setOpen(false)
        setSessionsOpen(false)
        setHubRailMode('thread')
      }
      setStoryChatComponents((prev) => (prev.some((item) => item.id === component.id) ? prev : [...prev, component]))
      if (open || !hubStoryOpen) setHubMorphFrom(sourceRect)
      setHubStoryOpen(true)
    },
    [hubStoryOpen, open, settleReplies],
  )

  /** Approach 2: each attached chart is re-plotted for 2024–2025 as its chart appears in the reply. */
  const submitStoryComponents = useCallback(
    (text: string, components: HubChatComponent[]) => {
      const attached = components.flatMap((item): ChatComponent[] =>
        isChartCard(item.id) ? [{ id: item.id, label: item.label }] : [],
      )
      if (attached.length === 0) return
      const prompt = text.trim() || periodPrompt(attached.map((item) => item.label))
      const conversationId = activeConversationId ?? uid()
      const baseReply = periodReply(attached, sceneAtPhase(storySceneAt(0), 0))
      const previous = storyAi.storyId === null || storyAi.storyId === activeStoryId ? storyAi.snapshot : null
      const stages = attached.map((_, index): StoryApplyStage => ({
        visualId: baseReply.createdComponents?.[index]?.id ?? null,
        snapshot: {
          cards: previous?.cards ?? null,
          region: previous?.region ?? false,
          areaEffect: previous?.areaEffect ?? null,
          filterLabels: previous?.filterLabels ?? {},
          periodCards: [
            ...new Set([...(previous?.periodCards ?? []), ...attached.slice(0, index + 1).map((card) => card.id)]),
          ],
          annotation: previous?.annotation,
        },
      }))
      const stateId = `map-state-${Date.now()}`
      const reply = aiFeatures.mapStateCards
        ? withMapState(baseReply, {
            stateId,
            snapshot: stages[stages.length - 1].snapshot,
            title: `${attached.map((item) => item.label).join(' · ')} · ${CHART_PERIOD_LABEL}`,
            tag: previous?.region ? MUSSAFAH_LABEL : 'Abu Dhabi',
            meta: `${attached.length} ${attached.length === 1 ? 'chart' : 'charts'} re-plotted`,
          })
        : baseReply
      if (aiFeatures.mapStateCards) setActiveMapStateId(stateId)
      setActiveConversationId(conversationId)
      clearStream()
      setStoryChatComponents([])
      setLandingChips([])
      setHubRailMode('thread')
      setSessionsOpen(false)
      setOpen(true)
      setExpanded(false)
      if (!titleEditedRef.current && !messages.some((msg) => msg.role === 'assistant')) {
        setChatTitle(titleFromReply(reply))
      }
      setMessages((m) => [...m, { id: uid(), role: 'user', text: prompt }])
      const messageId = startAssistantReply(reply)
      pendingStoryApplyRef.current = {
        messageId,
        storyId: activeStoryId,
        conversationId,
        stages,
        applied: 0,
        capture: aiFeatures.mapStateCards ? { stateId, delay: PERIOD_CAPTURE_DELAY_MS } : null,
      }
    },
    [activeConversationId, activeStoryId, aiFeatures.mapStateCards, clearStream, messages, startAssistantReply, storyAi],
  )

  const ownsStoryAi = storyAi.storyId === null || storyAi.storyId === activeStoryId
  const [storyLocation, setStoryLocation] = useState<StoryLocation | null>(null)
  const [locationPickerOpen, setLocationPickerOpen] = useState(false)
  const storyPrompts = activeStoryId != null && aiFeatures.addToChat
  /** The picked location's pill is still in the rail composer. */
  const locationInDraft = storyLocation !== null && draft.includes(`@${storyLocation.name}`)
  /** Approach 2's prompts, offered in the rail composer: per location, or city-wide until the map is annotated. */
  const storyAnnotationPrompt = !storyPrompts
    ? undefined
    : storyLocation && locationInDraft
      ? locationPrompt(storyLocation)
      : !(ownsStoryAi && storyAi.snapshot?.annotation)
        ? TOP_SCHOOLS_PROMPT
        : undefined

  /** Approach 2: the top 10 schools (in a picked location, when set) are annotated as the reply's chart appears. */
  const submitStoryAnnotation = useCallback(
    () => {
      if (streaming) return
      const slide = storySlideIndex
      const location = locationInDraft ? storyLocation : null
      const region = location ? locationUsesRegion(location) : null
      const annotation = location ? locationAnnotation(slide, location) : topSchoolsAnnotation(slide)
      const conversationId = activeConversationId ?? uid()
      const previous = ownsStoryAi ? storyAi.snapshot : null
      const filterLabels = previous?.filterLabels ?? {}
      const snapshot: StoryAiSnapshot = {
        cards: previous?.cards ?? null,
        region: region ?? previous?.region ?? false,
        areaEffect: previous?.areaEffect ?? null,
        filterLabels: region ? { ...filterLabels, loc: MUSSAFAH_LABEL } : filterLabels,
        periodCards: previous?.periodCards,
        annotation: location ? { slide, location } : { slide },
      }
      const stateId = `map-state-${Date.now()}`
      const place = location?.name ?? 'Abu Dhabi'
      const baseReply = topSchoolsReply(annotation)
      const reply = aiFeatures.mapStateCards
        ? withMapState(baseReply, {
            stateId,
            snapshot,
            title: location
              ? `Schools exposed to factory emissions · ${place}`
              : `Top ${annotation.schools.length} schools by traffic · ${place}`,
            tag: place,
            meta: `${annotation.schools.length} schools annotated`,
          })
        : baseReply
      if (aiFeatures.mapStateCards) setActiveMapStateId(stateId)
      setDraft('')
      setStoryLocation(null)
      setActiveConversationId(conversationId)
      if (!titleEditedRef.current && !messages.some((msg) => msg.role === 'assistant')) {
        setChatTitle(titleFromReply(reply))
      }
      const prompt = location ? locationPrompt(location) : TOP_SCHOOLS_PROMPT
      setMessages((m) => [...m, { id: uid(), role: 'user', text: prompt }])
      const messageId = startAssistantReply(reply)
      pendingStoryApplyRef.current = {
        messageId,
        storyId: activeStoryId,
        conversationId,
        stages: [{ visualId: baseReply.createdComponents?.[0]?.id ?? null, snapshot }],
        applied: 0,
        capture: aiFeatures.mapStateCards
          ? { stateId, delay: region ? REGION_ANNOTATION_CAPTURE_DELAY_MS : ANNOTATION_CAPTURE_DELAY_MS }
          : null,
      }
    },
    [
      activeConversationId,
      activeStoryId,
      aiFeatures.mapStateCards,
      locationInDraft,
      messages,
      ownsStoryAi,
      startAssistantReply,
      storyAi.snapshot,
      storyLocation,
      storySlideIndex,
      streaming,
    ],
  )

  const openLocationPicker = useCallback(() => setLocationPickerOpen(true), [])
  const closeLocationPicker = useCallback(() => setLocationPickerOpen(false), [])
  const applyStoryLocation = useCallback((location: StoryLocation) => {
    setLocationPickerOpen(false)
    setStoryLocation(location)
    composerRef.current?.insertMention({ id: location.id, name: location.name, categoryId: 'location' })
  }, [])

  const send = useCallback(() => {
    sendText(draft)
  }, [draft, sendText])

  useEffect(() => {
    if (!activeConversationId || streaming || !messages.some((msg) => msg.role === 'assistant')) return
    const captures = Object.fromEntries(
      mapStateIds(messages).flatMap((id) => (mapCaptures[id] ? [[id, mapCaptures[id]]] : [])),
    )
    setConversations((list) => {
      const existing = list.find((item) => item.id === activeConversationId)
      if (
        existing &&
        existing.messages === messages &&
        existing.title === chatTitle &&
        existing.story === storyAi.snapshot &&
        conversationApproach(existing) === aiApproach &&
        Object.keys(existing.mapCaptures ?? {}).length === Object.keys(captures).length
      ) {
        return list
      }
      const saved: SavedConversation = {
        id: activeConversationId,
        title: chatTitle,
        updatedAt: Date.now(),
        messages,
        storyId: storyAi.snapshot ? storyAi.storyId : null,
        story: storyAi.snapshot,
        mapCaptures: captures,
        approach: aiApproach,
      }
      return [saved, ...list.filter((item) => item.id !== activeConversationId)]
    })
  }, [activeConversationId, streaming, messages, chatTitle, storyAi, mapCaptures, aiApproach])

  useEffect(() => {
    storeConversations(conversations)
  }, [conversations])

  const sessionSummaries = useMemo(
    () =>
      conversations
        .filter((item) => conversationApproach(item) === aiApproach)
        .map((item) => conversationSummary(item)),
    [conversations, aiApproach],
  )

  const viewHubWorkInChat = useCallback(() => {
    const text = hubWorkUserTextRef.current
    setHubWorkToast(null)
    hubWorkUserTextRef.current = ''
    setHubRailMode('thread')
    setSessionsOpen(false)
    setOpen(true)
    setExpanded(false)
    if (text) sendText(text)
  }, [sendText])

  const dismissHubWork = useCallback(() => {
    setHubWorkToast(null)
    hubWorkUserTextRef.current = ''
  }, [])

  const questionIndex = useMemo((): ChatQuestionIndexItem[] => {
    const items: ChatQuestionIndexItem[] = []
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i]
      if (msg.role !== 'user') continue
      items.push({
        id: msg.id,
        question: msg.text,
        responseId: msg.id,
      })
    }
    return items
  }, [messages])

  const jumpToQuestion = useCallback((questionId: string) => {
    releaseStick()
    const root = chatMiddleRef.current
    const target = root?.querySelector(`[data-message-id="${CSS.escape(questionId)}"]`)
    if (target instanceof HTMLElement) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [releaseStick])

  const showInConversation = useCallback((target: { componentId?: string; reportId?: string }) => {
    releaseStick()
    const root = chatMiddleRef.current
    if (!root) return
    const selector = target.componentId
      ? `[data-component-id="${CSS.escape(target.componentId)}"]`
      : target.reportId
        ? `[data-report-id="${CSS.escape(target.reportId)}"]`
        : null
    if (!selector) return
    const el = root.querySelector(selector)
    if (el instanceof HTMLElement) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [releaseStick])

  const onChatTitleChange = useCallback((title: string) => {
    titleEditedRef.current = true
    setChatTitle(title)
  }, [])

  const lastAssistantMessageId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') return messages[i].id
    }
    return null
  }, [messages])

  const selectedComponent = useMemo((): CreatedComponent | null => {
    if (subcontext.view !== 'map' && subcontext.view !== 'chart') return null
    return findComponent(subcontext.componentId) ?? null
  }, [subcontext])

  const activeReport = useMemo(() => {
    if (subcontext.view !== 'slides') return null
    return findReport(subcontext.reportId) ?? AIR_QUALITY_REPORT
  }, [subcontext])

  const handleSessionsOpenChange = useCallback(
    (nextOpen: boolean) => {
      setSessionsOpen(nextOpen)
      if (
        nextOpen &&
        expanded &&
        subcontext.view !== 'closed' &&
        window.innerWidth < SESSIONS_SIDEBAR_BREAKPOINT_PX
      ) {
        closeSubcontext()
      }
    },
    [expanded, subcontext.view, closeSubcontext],
  )

  const sourcesFloatOpen =
    expanded &&
    subcontext.view === 'closed' &&
    !subcontextClosing &&
    sources.length > 0 &&
    !sourcesPanelDismissed

  const splitOpen = subcontext.view !== 'closed'

  const removeSource = useCallback((id: string) => {
    setSources((prev) => prev.filter((s) => s.id !== id))
  }, [])

  const addSource = useCallback((item: InlineContextItem) => {
    setSources((prev) =>
      prev.some((s) => s.id === item.id)
        ? prev
        : [...prev, { id: item.id, label: item.name, categoryId: item.categoryId }],
    )
    composerRef.current?.insertMention(item)
  }, [])

  const dismissSourcesPanel = useCallback(() => {
    setSourcesPanelDismissed(true)
  }, [])

  useEffect(() => {
    if (expanded) setSourcesPanelDismissed(false)
  }, [expanded])

  const onComponentSelect = useCallback((component: CreatedComponent) => {
    if (streaming) return
    const isMap = component.preview?.kind === 'image' && component.preview.detailView === 'map'
    openSubcontext({
      view: isMap ? 'map' : 'chart',
      componentId: component.id,
    })
  }, [streaming, openSubcontext])

  const onReportOpen = useCallback((reportId: string) => {
    setSessionsOpen(false)
    openSubcontext({ view: 'slides', reportId, activeSlide: 0 })
  }, [openSubcontext])

  const onOpenSubcontext = useCallback((block: AgentResponseBlock) => {
    if (block.type === 'visual' && block.openSubcontext) {
      openSubcontext({
        view: block.visualType === 'map' ? 'map' : 'chart',
        componentId: block.componentId,
      })
      return
    }
    if (block.type === 'report' && block.openSubcontext) {
      setSessionsOpen(false)
      openSubcontext({ view: 'slides', reportId: block.reportId, activeSlide: 0 })
    }
  }, [openSubcontext])

  const stop = useCallback(() => {
    pendingStoryApplyRef.current = null
    clearStream()
  }, [clearStream])

  const onReplyComplete = useCallback(() => {
    setReplyRendering(false)
  }, [])

  const sendVisual: SendVisualState = streaming ? 'stop' : draft.trim() ? 'active' : 'inactive'

  const resetConversation = useCallback(() => {
    clearStream()
    setMessages([])
    setSources([])
    setSourcesPanelDismissed(false)
    setDraft('')
    closeSubcontextImmediately()
    setChatTitle('New chat')
    titleEditedRef.current = false
    setStorySelectMode(false)
    setActiveConversationId(null)
    setActiveMapStateId(null)
    pendingStoryApplyRef.current = null
    setStoryAi((current) => ({ token: current.token + 1, snapshot: null, storyId: null, conversationId: null }))
  }, [clearStream, closeSubcontextImmediately])

  /** Approaches don't share chats or story changes: switching starts a new chat on the original story. */
  const changeAiApproach = useCallback(
    (next: AiApproach) => {
      persistAiApproach(next)
      setAiApproach(next)
      resetConversation()
      setStoryUpdate(null)
      setAiBarStoryId(null)
      setStoryChatComponents([])
    },
    [resetConversation],
  )

  /** Puts a saved conversation in the rail without touching the story. */
  const loadConversation = useCallback(
    (saved: SavedConversation) => {
      clearStream()
      setMessages(saved.messages)
      setSettledReplyIds(new Set(saved.messages.filter((msg) => msg.role === 'assistant').map((msg) => msg.id)))
      setSources([])
      setSourcesPanelDismissed(false)
      setDraft('')
      closeSubcontextImmediately()
      setChatTitle(saved.title)
      titleEditedRef.current = true
      setStorySelectMode(false)
      setActiveConversationId(saved.id)
      if (saved.mapCaptures) setMapCaptures((current) => ({ ...current, ...saved.mapCaptures }))
      if (isHub) {
        setHubRailMode('thread')
        setSessionsOpen(false)
        setLandingChips([])
      }
    },
    [clearStream, closeSubcontextImmediately, isHub],
  )

  const openSession = useCallback(
    (id: string) => {
      const saved = conversations.find((item) => item.id === id)
      if (!saved) return
      loadConversation(saved)
      setActiveMapStateId(saved.story ? (mapStateIds(saved.messages).at(-1) ?? null) : null)
      if (saved.storyId) setActiveStoryId(saved.storyId)
      setStoryAi((current) => ({
        token: current.token + 1,
        snapshot: saved.story,
        storyId: saved.storyId,
        conversationId: saved.id,
      }))
    },
    [conversations, loadConversation],
  )

  const storeMapCapture = useCallback((stateId: string, capture: StoryMapCapture) => {
    setMapCaptures((current) => ({ ...current, [stateId]: capture }))
  }, [])

  const mapStates = useMemo<StoryMapStates>(
    () => ({
      captures: mapCaptures,
      activeStateId: activeMapStateId,
      restore: (stateId, snapshot) => {
        const storyId = activeStoryId ?? storyAi.storyId
        if (!storyId) return
        if (!activeStoryId) setActiveStoryId(storyId)
        setStorySelectMode(false)
        setActiveMapStateId(stateId)
        setStoryAi((current) => ({
          token: current.token + 1,
          snapshot: { ...snapshot, camera: mapCaptures[stateId]?.camera },
          storyId,
          conversationId: activeConversationId ?? current.conversationId,
        }))
      },
    }),
    [mapCaptures, activeMapStateId, activeStoryId, activeConversationId, storyAi.storyId],
  )

  useEffect(() => {
    storeStoryVersions(storyVersions)
  }, [storyVersions])

  /** Back to the story as authored; detaching the conversation also drops its updated version. */
  const resetStoryAi = useCallback(() => {
    pendingStoryApplyRef.current = null
    settleReplies()
    setOpen(false)
    setSessionsOpen(false)
    setHubRailMode('thread')
    setStorySelectMode(false)
    setActiveMapStateId(null)
    setStoryUpdate(null)
    setAiBarStoryId(null)
    setStoryAi((current) => ({ token: current.token + 1, snapshot: null, storyId: null, conversationId: null }))
  }, [settleReplies])

  const updateStoryAi = useCallback(() => {
    const { snapshot, conversationId } = storyAi
    if (!snapshot || !conversationId) return
    setStoryUpdate({ conversationId, snapshot })
  }, [storyAi])

  useEffect(() => {
    if (!storyUpdate) return
    const timer = window.setTimeout(() => {
      setStoryVersions((current) => ({ ...current, [storyUpdate.conversationId]: storyUpdate.snapshot }))
      setStoryUpdate(null)
    }, STORY_UPDATE_MS)
    return () => window.clearTimeout(timer)
  }, [storyUpdate])

  /** Home cards always open the story as authored; AI versions come back only through their conversation. */
  const openStoryFromHome = useCallback((storyId: string) => {
    setStorySelectMode(false)
    setActiveMapStateId(null)
    setStoryAi((current) => ({ token: current.token + 1, snapshot: null, storyId: null, conversationId: null }))
    setActiveStoryId(storyId)
  }, [])

  const storyConversationOpen = open && hubRailMode === 'thread' && messages.length > 0

  const toggleStoryConversation = useCallback(() => {
    if (storyConversationOpen) {
      settleReplies()
      setOpen(false)
      return
    }
    if (messages.length === 0 && storyAi.conversationId) {
      const saved = conversations.find((item) => item.id === storyAi.conversationId)
      if (saved) loadConversation(saved)
    }
    setLandingChips([])
    setHubRailMode('thread')
    setSessionsOpen(false)
    setOpen(true)
    setExpanded(false)
  }, [storyConversationOpen, settleReplies, messages.length, storyAi.conversationId, conversations, loadConversation])

  const deleteSession = useCallback(
    (id: string) => {
      setConversations((list) => list.filter((item) => item.id !== id))
      if (id === activeConversationId) resetConversation()
    },
    [activeConversationId, resetConversation],
  )

  const deleteActiveConversation = useCallback(() => {
    if (activeConversationId) setConversations((list) => list.filter((item) => item.id !== activeConversationId))
    resetConversation()
  }, [activeConversationId, resetConversation])

  const closePanel = useCallback(() => {
    setOpen(false)
    setExpanded(false)
    closeSubcontextImmediately()
    setSessionsOpen(false)
    setHubRailMode('thread')
    clearStream()
    setMessages([])
    setSources([])
    setSourcesPanelDismissed(false)
    setDraft('')
    setChatTitle('New chat')
    titleEditedRef.current = false
    setActiveConversationId(null)
  }, [clearStream, closeSubcontextImmediately])

  // Docked left rail: close only via header control (not outside click).

  const landingChipToMention = useCallback(
    (chip: LandingContextChip): InlineContextItem => ({
      id: chip.id,
      name: chip.label,
      categoryId: chip.categoryId ?? 'briefings',
      description: chip.domain,
    }),
    [],
  )

  const closeHubSessionsRail = useCallback(() => {
    setOpen(false)
    setSessionsOpen(false)
    setHubRailMode('thread')
  }, [])

  const onInteractionModelChange = useCallback(
    (next: ChatInteractionModel) => {
      persistChatInteractionModel(next)
      setInteractionModel(next)
      closePanel()
      setHubStoryOpen(false)
      setHubMorphFrom(null)
      setLandingChips([])
      setHubWorkToast(null)
      hubWorkUserTextRef.current = ''
    },
    [closePanel],
  )

  const openLauncher = useCallback(() => {
    setOpen(true)
    setExpanded(false)
  }, [])

  const openHubSessions = useCallback(() => {
    setHubRailMode('sessions')
    setSessionsOpen(true)
    setOpen(true)
    setExpanded(false)
  }, [])

  const openStoryAsk = useCallback(
    ({
      story,
      slideIndex,
      sourceRect,
    }: {
      story: LandingStory
      slideIndex: number
      sourceRect: DOMRect
    }) => {
      const slide = story.slides[slideIndex]
      const chipLabel = slide?.title ?? story.storyTitle
      if (isHub) {
        // Approach 2 attaches charts via "Add to chat" instead of the slide pill.
        if (!aiFeatures.addToChat) {
          const chip: LandingContextChip = {
            id: `story-${story.id ?? chipLabel}-${slideIndex}`,
            label: chipLabel,
            categoryId: 'briefings',
          }
          setLandingChips((prev) => (prev.some((c) => c.id === chip.id) ? prev : [...prev, chip]))
        }
        setHubMorphFrom(sourceRect)
        setHubStoryOpen(true)
        setLandingFocusToken((n) => n + 1)
        return
      }
      setDraft((prev) => {
        const mention = `@${chipLabel}`
        if (!prev.trim()) return `Tell me more about ${mention}`
        if (prev.includes(mention)) return prev
        return `${prev.trim()} ${mention}`
      })
      setOpen(true)
      setExpanded(false)
    },
    [aiFeatures.addToChat, isHub],
  )

  const submitLandingAsk = useCallback(
    (text: string, chips: LandingContextChip[]) => {
      if (isFindingSlashCommand(text)) {
        setLandingChips([])
        pushFindingToast()
        return
      }
      const slash = parseSlashCommand(text)
      if (slash && isHub) {
        setLandingChips([])
        hubWorkUserTextRef.current = slash.userText
        setHubWorkToast({ message: underwayMessage(slash) })
        return
      }
      const chipLine =
        chips.length > 0
          ? `Context: ${chips.map((c) => (c.domain ? `${c.domain} — ${c.label}` : c.label)).join('; ')}`
          : ''
      const composed = [chipLine, text.trim()].filter(Boolean).join('\n\n')
      const fallback =
        chips.length === 1
          ? `Tell me more about ${chips[0].label}`
          : chips.length > 1
            ? 'Tell me more about these findings'
            : ''
      // Clear before open so the transfer effect does not re-insert into the composer
      setLandingChips([])
      setHubRailMode('thread')
      setSessionsOpen(false)
      setOpen(true)
      setExpanded(false)
      sendText(composed || fallback)
    },
    [sendText, pushFindingToast, isHub],
  )

  const onTellMeMore = useCallback(
    (item: LandingTellMeMorePayload) => {
      const chip: LandingContextChip = {
        id: item.id,
        label: item.title,
        domain: item.domain,
        categoryId: 'briefings',
      }
      const hubSessionsRail = isHub && open && hubRailMode === 'sessions'
      if (open && !hubSessionsRail) {
        composerRef.current?.insertMention(landingChipToMention(chip))
        return
      }
      setLandingChips((prev) => {
        if (prev.some((c) => c.id === item.id)) return prev
        return [...prev, chip]
      })
      if (!isHub) {
        setOpen(true)
        setExpanded(false)
        return
      }
      setLandingFocusToken((n) => n + 1)
    },
    [open, landingChipToMention, isHub, hubRailMode],
  )

  const openFinding = useCallback(
    (finding: FindingToastItem) => {
      onTellMeMore({
        id: finding.id,
        title: finding.title,
        domain: finding.domain,
        finding: `${finding.before}${finding.highlight}${finding.after}`,
      })
    },
    [onTellMeMore],
  )

  // Opening the rail with chips on the landing chatbox → move them into ChatComposer
  useEffect(() => {
    if (!open || landingChips.length === 0 || isHub) return
    const pending = landingChips
    setLandingChips([])
    let cancelled = false
    let tries = 0
    const insert = () => {
      if (cancelled) return
      if (!composerRef.current) {
        if (tries++ < 30) window.requestAnimationFrame(insert)
        return
      }
      for (const chip of pending) {
        composerRef.current.insertMention(landingChipToMention(chip))
      }
    }
    window.requestAnimationFrame(insert)
    return () => {
      cancelled = true
    }
  }, [open, landingChips, landingChipToMention, isHub])

  useEffect(() => {
    if (!(isHub && open && hubRailMode === 'thread' && hubStoryOpen)) return
    const id = window.setTimeout(() => {
      setHubStoryOpen(false)
      setHubMorphFrom(null)
    }, 360)
    return () => window.clearTimeout(id)
  }, [isHub, open, hubRailMode, hubStoryOpen])

  const isNewChat = messages.length === 0
  const hasAssistantReply = messages.some((m) => m.role === 'assistant')

  /** Pair each user message with the following assistant reply. */
  const turns = useMemo(() => {
    const grouped: {
      user: Extract<ChatMessage, { role: 'user' }>
      assistant?: Extract<ChatMessage, { role: 'assistant' }>
    }[] = []
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i]
      if (msg.role !== 'user') {
        if (msg.role === 'assistant' && grouped.length === 0) {
          grouped.push({
            user: { id: `orphan-${msg.id}`, role: 'user', text: '' },
            assistant: msg,
          })
        }
        continue
      }
      const next = messages[i + 1]
      const assistant = next?.role === 'assistant' ? next : undefined
      if (assistant) i += 1
      grouped.push({ user: msg, assistant })
    }
    return grouped
  }, [messages])

  const storyActive = activeStoryId != null
  const ownsActiveStory = storyAi.storyId === null || storyAi.storyId === activeStoryId
  const savedStoryVersion =
    ownsActiveStory && storyAi.conversationId ? (storyVersions[storyAi.conversationId] ?? null) : null
  const storyAiSnapshot = ownsActiveStory ? (storyAi.snapshot ?? savedStoryVersion) : null
  const storyAiState = useMemo(
    () => ({ token: storyAi.token, snapshot: storyAiSnapshot, capture: storyAi.capture ?? null }),
    [storyAi.token, storyAiSnapshot, storyAi.capture],
  )
  const storyHasUnsavedAi =
    ownsActiveStory && storyAi.snapshot !== null && !sameStorySnapshot(storyAi.snapshot, savedStoryVersion)
  if (activeStoryId && aiBarStoryId !== activeStoryId && (storyHasUnsavedAi || savedStoryVersion)) {
    setAiBarStoryId(activeStoryId)
  } else if (aiBarStoryId !== null && aiBarStoryId !== activeStoryId) {
    setAiBarStoryId(null)
  }
  const storyBarStatus: StoryAiModeStatus | null =
    !activeStoryId || aiBarStoryId !== activeStoryId
      ? null
      : storyUpdate && storyUpdate.conversationId === storyAi.conversationId
        ? 'updating'
        : storyHasUnsavedAi
          ? 'unsaved'
          : storyAiSnapshot
            ? 'saved'
            : 'original'
  const showLauncher = !isHub && !open
  const hubSessionsRail = isHub && open && hubRailMode === 'sessions'
  const hubThreadRail = isHub && open && hubRailMode === 'thread'
  const railComposerOpen = open && !hubSessionsRail
  const hubChatComponents = storyActive && aiFeatures.addToChat ? storyChatComponents : []
  const showHub =
    isHub &&
    (hubSessionsRail ||
      (!open && (!storyActive || hubStoryOpen)) ||
      (hubThreadRail && storyActive && hubStoryOpen))
  const showHubFindings =
    !railComposerOpen && (showHub || findingToasts.length > 0 || auroraPanelOpen)
  const showRailFindings = railComposerOpen && (findingToasts.length > 0 || auroraPanelOpen)

  const findingChrome = showRailFindings ? (
    <FindingNotificationLayer
      toasts={findingToasts}
      toastIndex={findingToastIndex}
      stackVisible={findingStackVisible}
      auroraPanelOpen={auroraPanelOpen}
      aurora={findingAurora}
      replayKey={auroraReplayKey}
      onReady={onFindingRevealReady}
      onIndexChange={setFindingToastIndex}
      onDismiss={dismissFindingToasts}
      onTellMeMore={onTellMeMore}
    />
  ) : null

  const chatMiddle = (
    <div ref={chatMiddleRef} className={`${styles.middle} ${isNewChat ? styles.middleEmpty : ''}`}>
      {isNewChat ? (
        <AssistantHero />
      ) : (
        <div ref={transcriptScrollRef} className={styles.transcript}>
          {turns.map(({ user, assistant }) => (
            <div key={user.id} className={styles.msgTurn}>
              {user.text ? (
                <UserMessageBubble
                  messageId={user.id}
                  text={user.text}
                  questions={questionIndex}
                  onJumpToQuestion={jumpToQuestion}
                />
              ) : null}
              {assistant?.reply ? (
                <div data-message-id={assistant.id} className={styles.msgAssistantTimeline}>
                  <AssistantTimelineReply
                    key={assistant.id}
                    reply={assistant.reply}
                    streamingText={assistant.text}
                    isAnswerStreaming={streaming && assistantMsgId.current === assistant.id}
                    onComponentSelect={onComponentSelect}
                    onReportOpen={onReportOpen}
                    onOpenSubcontext={onOpenSubcontext}
                    onReplyComplete={() => {
                      onReplyComplete()
                      applyStoryStages(assistant.id, Number.POSITIVE_INFINITY)
                    }}
                    onVisualReveal={(componentId) => onReplyVisual(assistant.id, componentId)}
                    selectedComponentId={
                      subcontext.view === 'map' || subcontext.view === 'chart'
                        ? subcontext.componentId
                        : null
                    }
                    instantTimeline={
                      previewForceInstant ||
                      assistant.id !== lastAssistantMessageId ||
                      assistant.id.startsWith('demo-') ||
                      settledReplyIds.has(assistant.id)
                    }
                    conversationPanelRef={chatMiddleRef}
                  />
                </div>
              ) : assistant ? (
                <div data-message-id={assistant.id} className={styles.msgAssistant}>
                  {assistant.text || '\u00a0'}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
      <ChatComposer
        ref={composerRef}
        value={draft}
        onChange={setDraft}
        onSend={send}
        onStop={stop}
        sendState={sendVisual}
        showParameters
        onAttachClick={() => {}}
        findingSlot={findingChrome}
        selectMode={storySelectMode}
        onSelectModeChange={storyActive && aiFeatures.selectTool ? setStorySelectMode : undefined}
        suggestedPrompt={streaming ? undefined : storyAnnotationPrompt}
        onSendSuggested={submitStoryAnnotation}
        onPickLocation={storyPrompts ? openLocationPicker : undefined}
      />
      {locationPickerOpen ? (
        <StoryLocationModal onApply={applyStoryLocation} onClose={closeLocationPicker} />
      ) : null}
    </div>
  )

  const replayFindingAurora = useCallback(() => {
    setFindingStackVisible(false)
    setAuroraReplayKey((k) => k + 1)
  }, [])

  const onAuroraPanelOpenChange = useCallback((next: boolean) => {
    setAuroraPanelOpen(next)
    if (next) {
      setFindingStackVisible(false)
      setAuroraReplayKey((k) => k + 1)
    } else if (findingToasts.length > 0) {
      setFindingStackVisible(true)
    }
  }, [findingToasts.length])

  const uxSwitcher = (
    <div className={styles.headerTools}>
      <FindingAuroraPanel
        open={auroraPanelOpen}
        onOpenChange={onAuroraPanelOpenChange}
        settings={findingAurora}
        onChange={setFindingAurora}
        onReplay={replayFindingAurora}
      />
      <InteractionModelSwitcher value={interactionModel} onChange={onInteractionModelChange} />
    </div>
  )

  return (
    <StoryMapStatesContext.Provider value={mapStates}>
      <div
        className={`${styles.demoPage}${open ? ` ${styles.demoPageRailOpen}` : ''}${
          storyActive ? ` ${styles.demoPageStory}` : ''
        }`}
      >
        <div className={styles.demoPageShader} aria-hidden>
          <MeshGradient
            speed={open || storyActive ? 0 : 0.4}
            scale={1}
            distortion={0.09}
            swirl={0}
            frame={MESH_FRAME_DEMO_PAGE}
            colors={[...MESH_COLORS_DEMO_PAGE]}
            maxPixelCount={MESH_MAX_PIXEL_COUNT_DEMO_PAGE}
            className={styles.demoPageShaderCanvas}
          />
        </div>
        <div className={styles.demoLandingLayer}>
          {storyActive ? (
            <StoryView
              storyId={activeStoryId}
              onBack={() => {
                setActiveStoryId(null)
                setStorySelectMode(false)
                setHubStoryOpen(false)
                setHubMorphFrom(null)
                setLandingChips([])
                setStoryChatComponents([])
                // Landing hub should reopen idle (orb + placeholder), not focused/engaged.
                setLandingFocusToken(0)
              }}
              onAsk={isHub ? openStoryAsk : undefined}
              agentOpen={open || hubStoryOpen}
              selectMode={aiFeatures.selectTool && storySelectMode}
              onSelectModeChange={setStorySelectMode}
              onSelectionPrompt={aiFeatures.selectTool ? submitStorySelection : undefined}
              aiState={storyAiState}
              onMapCapture={aiFeatures.mapStateCards ? storeMapCapture : undefined}
              aiModeBar={
                aiFeatures.aiModeBar && storyBarStatus ? (
                  <StoryAiModeBar
                    status={storyBarStatus}
                    conversationOpen={storyConversationOpen}
                    onReset={resetStoryAi}
                    onUpdate={updateStoryAi}
                    onToggleConversation={toggleStoryConversation}
                  />
                ) : null
              }
              headerEnd={
                <HeaderOptionSwitcher
                  kicker={<Sparkle size={16} weight="regular" aria-hidden />}
                  label="Llumen AI approach"
                  options={AI_APPROACHES}
                  value={aiApproach}
                  onChange={changeAiApproach}
                  variant="filter"
                />
              }
              onAddToChat={isHub && aiFeatures.addToChat ? addStoryComponentToChat : undefined}
              onSlideIndexChange={setStorySlideIndex}
            />
          ) : (
            <LandingHomeDefault
              onOpenStory={openStoryFromHome}
              onTellMeMore={onTellMeMore}
              headerEnd={uxSwitcher}
              reserveComposer={isHub}
            />
          )}
        </div>
        {(showHub || showHubFindings) ? (
          <div
            className={`${styles.composerDock}${storyActive ? ` ${styles.composerDockStory}` : ''}${
              hubSessionsRail ? ` ${styles.composerDockShifted}` : ''
            }`}
          >
            {showHubFindings ? (
              <FindingNotificationLayer
                toasts={findingToasts}
                toastIndex={findingToastIndex}
                stackVisible={findingStackVisible}
                auroraPanelOpen={auroraPanelOpen}
                aurora={findingAurora}
                replayKey={auroraReplayKey}
                onReady={onFindingRevealReady}
                onIndexChange={setFindingToastIndex}
                onDismiss={dismissFindingToasts}
                onTellMeMore={onTellMeMore}
              />
            ) : null}
            {showHub ? (
              <HubChatbox
                // Remount when leaving a story so draft/focus/files don't carry over engaged.
                key={storyActive ? `story-${activeStoryId}` : 'landing'}
                onSubmit={submitLandingAsk}
                chips={landingChips}
                onRemoveChip={(id) => setLandingChips((prev) => prev.filter((c) => c.id !== id))}
                onOpenSessions={openHubSessions}
                focusToken={landingFocusToken}
                exiting={hubThreadRail}
                placement={storyActive ? 'story' : 'landing'}
                morphFrom={storyActive ? hubMorphFrom : null}
                onCollapse={
                  storyActive
                    ? () => {
                        setHubStoryOpen(false)
                        setHubMorphFrom(null)
                        setStoryChatComponents([])
                        if (hubSessionsRail) {
                          setOpen(false)
                          setSessionsOpen(false)
                          setHubRailMode('thread')
                        }
                      }
                    : undefined
                }
                workToast={hubWorkToast}
                onViewWorkInChat={viewHubWorkInChat}
                onDismissWork={dismissHubWork}
                selectMode={storySelectMode}
                onSelectModeChange={storyActive && aiFeatures.selectTool ? setStorySelectMode : undefined}
                components={hubChatComponents}
                onRemoveComponent={(id) => setStoryChatComponents((prev) => prev.filter((item) => item.id !== id))}
                componentPrompt={
                  hubChatComponents.length > 0 ? periodPrompt(hubChatComponents.map((item) => item.label)) : undefined
                }
                onSubmitComponents={submitStoryComponents}
              />
            ) : null}
          </div>
        ) : null}
        <div
          className={`${styles.fabColumn}${open ? ` ${styles.fabColumnDocked}` : ''}${
            !showLauncher && !open ? ` ${styles.fabColumnHidden}` : ''
          }`}
        >
          <div
            className={`${styles.panelWrap} ${open ? '' : styles.panelWrapHidden}`}
            aria-hidden={!open}
          >
            {open && (
              <AssistantPanel
                ref={assistantPanelRef}
                expanded={false}
                splitView={splitOpen}
                allowOverflow={sessionsOpen || hubSessionsRail || showRailFindings}
                thinking={replyRendering}
              >
                <div className={styles.splitBody}>
                  {expanded && sessionsOpen ? (
                    <aside
                      className={styles.sessionsSidebar}
                      aria-label="Conversations"
                      data-lc-sessions-sidebar
                    >
                      <SessionsPanel
                        variant="fullscreen"
                        sessions={sessionSummaries}
                        activeSessionId={activeConversationId}
                        onOpenSession={openSession}
                        onDeleteSession={deleteSession}
                        onOpenFinding={openFinding}
                        onShareSession={() => setShareOpen(true)}
                      />
                    </aside>
                  ) : null}
                  <div className={`${styles.chatColumn} ${splitOpen ? styles.chatColumnSplit : ''}`}>
                    {hubSessionsRail ? (
                      <div className={styles.hubSessionsFill}>
                        <SessionsPanel
                          variant="fullscreen"
                          sessions={sessionSummaries}
                          activeSessionId={activeConversationId}
                          onOpenSession={openSession}
                          onDeleteSession={deleteSession}
                          onOpenFinding={openFinding}
                          onShareSession={() => setShareOpen(true)}
                          onClose={closeHubSessionsRail}
                        />
                      </div>
                    ) : (
                    <div className={styles.panelViewStack}>
                      <PanelHeader
                        onClose={closePanel}
                        expanded={false}
                        chatTitle={chatTitle}
                        onChatTitleChange={onChatTitleChange}
                        onOpenSession={openSession}
                        sessions={sessionSummaries}
                        activeSessionId={activeConversationId}
                        onDeleteSession={deleteSession}
                        onOpenFinding={openFinding}
                        onNewSession={resetConversation}
                        onDeleteConversation={deleteActiveConversation}
                        onShareConversation={() => setShareOpen(true)}
                        hasAssistantReply={hasAssistantReply}
                        sessionsOpen={sessionsOpen}
                        sessionsFullscreen={false}
                        onSessionsOpenChange={handleSessionsOpenChange}
                        onChatSearchChange={onChatSearchChange}
                        searchMatchCount={searchMatchCount}
                        searchActiveMatch={searchActiveMatch}
                        onSearchMatchNavigate={onSearchMatchNavigate}
                        sources={sources}
                        onRemoveSource={removeSource}
                        onAddSource={addSource}
                        sourcesPanelOpen={sourcesFloatOpen}
                        onToggleSourcesPanel={() => setSourcesPanelDismissed((v) => !v)}
                        subcontextOpen={subcontext.view !== 'closed'}
                      />
                      <div className={styles.separator} />
                      {chatMiddle}
                    </div>
                    )}
                  </div>
                  {sourcesFloatOpen ? (
                      <SourcesPanel
                        sources={sources}
                        onRemove={removeSource}
                        onAdd={addSource}
                        onClose={dismissSourcesPanel}
                      />
                  ) : null}
                </div>
              </AssistantPanel>
            )}
          </div>
          {showLauncher ? <AssistantLauncher onOpen={openLauncher} /> : null}
        </div>
        {/* Subcontext overlays the page beside the rail (outside rail overflow/transform). */}
        {open && selectedComponent ? (
          <div
            className={`${styles.detailOverlay} ${
              subcontextClosing ? styles.detailColumnExit : styles.detailColumnEnter
            }`}
          >
            <ComponentDetailPanel
              component={selectedComponent}
              onClose={closeSubcontext}
              onShowInConversation={() =>
                showInConversation({ componentId: selectedComponent.id })
              }
            />
          </div>
        ) : null}
        {open && activeReport && subcontext.view === 'slides' ? (
          <div
            className={`${styles.detailOverlay} ${
              subcontextClosing ? styles.detailColumnExit : styles.detailColumnEnter
            }`}
          >
            <SlidesDetailPanel
              report={activeReport}
              components={AIR_QUALITY_COMPONENTS}
              activeSlide={subcontext.activeSlide}
              onSlideChange={(index) =>
                setSubcontext({ view: 'slides', reportId: activeReport.id, activeSlide: index })
              }
              onClose={closeSubcontext}
              onShowInConversation={() => showInConversation({ reportId: activeReport.id })}
              onHome={() =>
                setSubcontext({ view: 'slides', reportId: activeReport.id, activeSlide: 0 })
              }
            />
          </div>
        ) : null}
        <ShareModal
          open={shareOpen}
          title={`Share “${chatTitle}”`}
          onClose={() => setShareOpen(false)}
        />
      </div>
    </StoryMapStatesContext.Provider>
  )
}
