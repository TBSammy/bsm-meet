// Session definitions — shared across program, bio, my-events

// Hardcoded fallback (used when no session plan exists in DB)
export const SESSION_DEFS = [
  { session: 1, events: [1,2,3,4,5,6,7], start: '2:30 PM' },
  { session: 2, events: [8,9,10,11,12,13,14,15], start: '3:20 PM' },
  { session: 3, events: [16,17,18,19,20,21,22], start: '4:10 PM' },
  { session: 4, events: [23,24,25,26,27,28,29], start: '5:00 PM' },
]

// Map event number → session start time (fallback only)
const eventSessionMap = new Map<number, string>()
for (const s of SESSION_DEFS) {
  for (const e of s.events) {
    eventSessionMap.set(e, s.start)
  }
}

export function getSessionStart(eventNumber: number | string): string {
  const num = typeof eventNumber === 'string' ? parseInt(eventNumber) : eventNumber
  return eventSessionMap.get(num) || ''
}

// ── DB session plan types (matches admin SessionPlanJson) ──────────────

export interface SessionPlanJson {
  settings: {
    lanes: number
    heatInterval: number
    backstrokeExtra: number
    ntDefaultTime: number
  }
  firstSession: {
    name: string
    dayNumber: number
    startTime: string
    autoStartTime?: boolean
  }
  markers: Array<{
    afterEventNumber: string
    session: {
      name: string
      dayNumber: number
      startTime: string
      autoStartTime?: boolean
    }
  }>
  breaks: Array<{
    afterEventNumber: string
    durationMinutes: number
  }>
}

export interface SessionDef {
  session: number
  events: number[]
  start: string
  label?: string
  autoStartTime?: boolean
}

export interface BreakDef {
  afterEventNumber: number
  durationMinutes: number
}

/**
 * Convert a DB session plan (markers-based) into SessionDef[] + BreakDef[].
 * Needs all event numbers so it can split them into session buckets.
 */
export function deriveSessionDefs(
  plan: SessionPlanJson,
  allEventNumbers: number[]
): { sessions: SessionDef[], breaks: BreakDef[] } {
  const sorted = [...allEventNumbers].sort((a, b) => a - b)

  // Build ordered session boundaries from markers
  const markerAfterNums = plan.markers
    .map(m => parseInt(m.afterEventNumber))
    .filter(n => !isNaN(n))
    .sort((a, b) => a - b)

  const allSessions = [plan.firstSession, ...plan.markers
    .sort((a, b) => parseInt(a.afterEventNumber) - parseInt(b.afterEventNumber))
    .map(m => m.session)]

  const sessions: SessionDef[] = []
  let currentEvents: number[] = []
  let sessionIdx = 0

  for (const evNum of sorted) {
    currentEvents.push(evNum)
    if (markerAfterNums.includes(evNum) && sessionIdx < allSessions.length - 1) {
      const sess = allSessions[sessionIdx]
      sessions.push({
        session: sessionIdx + 1,
        events: currentEvents,
        start: formatTime24to12(sess.startTime),
        label: sess.name,
      })
      sessionIdx++
      currentEvents = []
    }
  }

  // Last session (remaining events)
  if (currentEvents.length > 0) {
    const sess = allSessions[sessionIdx]
    sessions.push({
      session: sessionIdx + 1,
      events: currentEvents,
      start: formatTime24to12(sess.startTime),
      label: sess.name,
      autoStartTime: sess.autoStartTime,
    })
  }

  const breaks: BreakDef[] = plan.breaks.map(b => ({
    afterEventNumber: parseInt(b.afterEventNumber),
    durationMinutes: b.durationMinutes,
  })).filter(b => !isNaN(b.afterEventNumber))

  return { sessions, breaks }
}

function formatTime24to12(time24: string): string {
  const [h, m] = time24.split(':').map(Number)
  if (isNaN(h) || isNaN(m)) return time24
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}

// ── Timing computation ─────────────────────────────────────────────────

// Default timing constants (used when no DB plan available)
const DEFAULT_HEAT_INTERVAL = 45
const DEFAULT_BACKSTROKE_EXTRA = 15
const DEFAULT_NT_TIME = 180

function parseStartTime(timeStr: string): Date {
  const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i)
  if (!match) return new Date(2000, 0, 1, 14, 30, 0) // fallback 2:30 PM
  let hours = parseInt(match[1])
  const minutes = parseInt(match[2])
  if (match[3].toUpperCase() === 'PM' && hours < 12) hours += 12
  if (match[3].toUpperCase() === 'AM' && hours === 12) hours = 0
  return new Date(2000, 0, 1, hours, minutes, 0)
}

function isBackstroke(eventCode: string): boolean {
  return eventCode.toUpperCase().trim().endsWith('B')
}

export function formatTimeOfDay(date: Date): string {
  const h = date.getHours()
  const m = date.getMinutes()
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}

export interface EntryLike {
  event_number: string
  event_code: string
  result_heat?: string | null
  result_lane?: string | null
  original_time?: number | null
  result_time?: number | null
}

export interface HeatTiming {
  /** Estimated start time based on seed times (the original schedule) */
  scheduled: string
  /** Live estimated start time using actual results for completed heats */
  live: string
  /** Difference in minutes: positive = behind schedule, negative = ahead */
  deltaMinutes: number
}

export interface TimingOptions {
  sessionDefs?: SessionDef[]
  breaks?: BreakDef[]
  settings?: {
    heatInterval: number
    backstrokeExtra: number
    ntDefaultTime: number
  }
}

/**
 * Compute per-event-per-heat estimated start times — both scheduled and live.
 *
 * "scheduled" = based purely on seed times (never changes)
 * "live" = uses actual result_time for completed heats, seed for upcoming
 *
 * Returns a Map keyed by "eventNumber-heatNumber" and "eventNumber" (heat 1).
 */
export function computeHeatStartTimes(
  allEntries: EntryLike[],
  options?: TimingOptions
): Map<string, HeatTiming> {
  const result = new Map<string, HeatTiming>()

  const sessions: SessionDef[] = options?.sessionDefs || SESSION_DEFS
  const breakDefs = options?.breaks || []
  const heatInterval = options?.settings?.heatInterval ?? DEFAULT_HEAT_INTERVAL
  const backstrokeExtra = options?.settings?.backstrokeExtra ?? DEFAULT_BACKSTROKE_EXTRA
  const ntDefaultTime = options?.settings?.ntDefaultTime ?? DEFAULT_NT_TIME

  // Group entries by event number
  const eventMap = new Map<number, EntryLike[]>()
  for (const e of allEntries) {
    const num = parseInt(e.event_number) || 0
    if (!eventMap.has(num)) eventMap.set(num, [])
    eventMap.get(num)!.push(e)
  }

  // Run two passes: one with seed times only (scheduled), one with results (live)
  function computePass(useResults: boolean): Map<string, Date> {
    const times = new Map<string, Date>()
    let runningTime: Date | null = null

    for (const sess of sessions) {
      const planTime = parseStartTime(sess.start)
      // For auto-start sessions, use the later of plan time or running time from previous session
      let currentTime: Date
      if (sess.autoStartTime && runningTime && runningTime.getTime() > planTime.getTime()) {
        currentTime = new Date(runningTime)
      } else {
        currentTime = planTime
      }
      const sessionEventNums = sess.events.filter(n => eventMap.has(n)).sort((a, b) => a - b)

      for (const eventNum of sessionEventNums) {
        const entries = eventMap.get(eventNum)!
        const backstroke = entries.length > 0 && isBackstroke(entries[0].event_code)

        // Group by heat
        const heatMap = new Map<number, EntryLike[]>()
        for (const e of entries) {
          const h = parseInt(e.result_heat || '0') || 1
          if (!heatMap.has(h)) heatMap.set(h, [])
          heatMap.get(h)!.push(e)
        }

        const heatNums = [...heatMap.keys()].sort((a, b) => a - b)

        for (const heatNum of heatNums) {
          const heatEntries = heatMap.get(heatNum)!

          times.set(`${eventNum}-${heatNum}`, new Date(currentTime))
          if (heatNum === heatNums[0]) {
            times.set(`${eventNum}`, new Date(currentTime))
          }

          // Check if this heat is complete (all swimmers have result_time)
          const resultTimes = heatEntries
            .map(e => e.result_time)
            .filter((t): t is number => t !== null && t !== undefined && t > 0)
          const heatComplete = useResults && resultTimes.length > 0 &&
            heatEntries.every(e => (e.result_time !== null && e.result_time !== undefined && e.result_time > 0))

          let slowest: number
          if (heatComplete) {
            slowest = Math.max(...resultTimes)
          } else {
            const seedTimes = heatEntries
              .map(e => e.original_time)
              .filter((t): t is number => t !== null && t !== undefined && t > 0)
            slowest = seedTimes.length > 0 ? Math.max(...seedTimes) : ntDefaultTime
          }

          let heatDuration = slowest + heatInterval
          if (backstroke) heatDuration += backstrokeExtra
          currentTime = new Date(currentTime.getTime() + heatDuration * 1000)
        }

        // Check for a break after this event
        const breakAfter = breakDefs.find(b => b.afterEventNumber === eventNum)
        if (breakAfter) {
          currentTime = new Date(currentTime.getTime() + breakAfter.durationMinutes * 60 * 1000)
        }
      }
      runningTime = new Date(currentTime)
    }

    return times
  }

  const scheduledTimes = computePass(false)
  const liveTimes = computePass(true)

  // Merge into HeatTiming objects
  for (const [key, scheduledDate] of scheduledTimes) {
    const liveDate = liveTimes.get(key) || scheduledDate
    const deltaMs = liveDate.getTime() - scheduledDate.getTime()
    const deltaMinutes = Math.round(deltaMs / 60000)

    result.set(key, {
      scheduled: formatTimeOfDay(scheduledDate),
      live: formatTimeOfDay(liveDate),
      deltaMinutes,
    })
  }

  return result
}
