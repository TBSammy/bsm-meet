import { getEntries, getRelays, getBioProfiles, getSessionPlan, getCampaign } from '@/lib/supabase/queries'
import { eventName, relayEventName } from '@/lib/eventCodes'
import { ProgramContent } from './ProgramContent'
import { SESSION_DEFS, computeHeatStartTimes, deriveSessionDefs } from '@/lib/sessions'
import type { TimingOptions, BreakDef } from '@/lib/sessions'

export const revalidate = 60

export default async function ProgramPage() {
  const campaign = await getCampaign()
  if (!campaign?.program_live) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <h1 className="font-display font-bold text-3xl text-gray-900 mb-4">Program Not Yet Available</h1>
        <p className="text-gray-500">The meet program will be published here once it is finalised.</p>
      </div>
    )
  }

  const [entries, relays, bios, sessionPlan] = await Promise.all([
    getEntries(), getRelays(), getBioProfiles(), getSessionPlan()
  ])

  // Derive session structure from DB plan or fall back to hardcoded
  let sessionsForDisplay: Array<{ session: number; events: number[]; start: string; label: string }>
  let timingOptions: TimingOptions | undefined
  let breakDefs: BreakDef[] = []

  if (sessionPlan) {
    // Collect all event numbers from entries + relays
    const allEventNums = new Set<number>()
    for (const e of entries) allEventNums.add(parseInt(e.event_number) || 0)
    for (const r of relays) allEventNums.add(parseInt(r.event_number) || 0)
    allEventNums.delete(0)

    const derived = deriveSessionDefs(sessionPlan, [...allEventNums])
    sessionsForDisplay = derived.sessions.map(s => ({
      ...s,
      label: s.label || `Session ${s.session}`,
    }))
    breakDefs = derived.breaks
    timingOptions = {
      sessionDefs: derived.sessions,
      breaks: derived.breaks,
      settings: sessionPlan.settings,
    }
  } else {
    sessionsForDisplay = SESSION_DEFS.map((s, i) => ({
      ...s,
      label: `Session ${i + 1}`,
    }))
  }

  // Group entries by event
  const eventMap = new Map<number, { entries: any[], eventCode: string, eventGender: string, isRelay: boolean }>()
  for (const e of entries) {
    const num = parseInt(e.event_number) || 0
    if (!eventMap.has(num)) {
      eventMap.set(num, { entries: [], eventCode: e.event_code || '', eventGender: e.event_gender || '', isRelay: false })
    }
    eventMap.get(num)!.entries.push(e)
  }

  // Group relays by event
  for (const r of relays) {
    const num = parseInt(r.event_number) || 0
    if (!eventMap.has(num)) {
      eventMap.set(num, { entries: [], eventCode: r.event_code || '', eventGender: r.event_gender || '', isRelay: true })
    }
    const ev = eventMap.get(num)!
    ev.isRelay = true
    if (!ev.eventGender && r.event_gender) ev.eventGender = r.event_gender
    ev.entries.push({ ...r, isRelay: true, result_heat: r.heat, result_lane: r.lane })
  }

  const sortedEvents = [...eventMap.entries()].sort(([a], [b]) => a - b)

  // Build flat entry list for timing computation (individual + relay entries)
  const allFlatEntries = [
    ...entries.map((e: any) => ({ event_number: e.event_number, event_code: e.event_code, result_heat: e.result_heat, original_time: e.original_time, result_time: e.result_time })),
    ...relays.map((r: any) => ({ event_number: r.event_number, event_code: r.event_code, result_heat: r.heat, original_time: r.seed_time, result_time: r.result_time })),
  ]
  const heatStartTimes = computeHeatStartTimes(allFlatEntries, timingOptions)

  // Transform into serializable data for client component
  const processedEvents = sortedEvents.map(([eventNum, eventData]) => {
    const displayName = eventData.isRelay
      ? relayEventName(eventData.eventCode)
      : eventName(eventData.eventCode)
    const genderLabel = eventData.eventGender === 'Female' ? 'Women' : eventData.eventGender === 'Male' ? 'Men' : eventData.eventGender === 'Mixed' ? 'Mixed' : ''

    // Group by heat
    const heatMap = new Map<number, any[]>()
    for (const e of eventData.entries) {
      const h = parseInt(e.result_heat) || 1
      if (!heatMap.has(h)) heatMap.set(h, [])
      heatMap.get(h)!.push(e)
    }
    const totalHeats = heatMap.size

    // Check if event is complete
    const lastHeatNum = Math.max(...heatMap.keys())
    const lastHeatEntries = heatMap.get(lastHeatNum) || []
    const activeLastHeat = lastHeatEntries.filter((s: any) => !s.scratched && s.result_dq !== 'R')
    const isComplete = activeLastHeat.length > 0 && activeLastHeat.every((s: any) => (s.result_time && Number(s.result_time) > 0) || s.result_dq === 'Q')

    const heats = [...heatMap.entries()].sort(([a], [b]) => a - b).map(([heatNum, swimmers]) => ({
      num: heatNum,
      total: totalHeats,
      estTime: heatStartTimes.get(`${eventNum}-${heatNum}`)?.live,
      scheduledTime: heatStartTimes.get(`${eventNum}-${heatNum}`)?.scheduled,
      deltaMinutes: heatStartTimes.get(`${eventNum}-${heatNum}`)?.deltaMinutes || 0,
      swimmers: swimmers.sort((a: any, b: any) => {
        const aLane = parseInt(a.result_lane) || 0;
        const bLane = parseInt(b.result_lane) || 0;
        if (aLane || bLane) return (aLane || 99) - (bLane || 99);
        const aTime = a.original_time ?? a.seed_time ?? Infinity;
        const bTime = b.original_time ?? b.seed_time ?? Infinity;
        if (aTime !== bTime) return aTime - bTime;
        if (a.isRelay && b.isRelay) {
          const aAge = parseInt(a.age || '') || 0;
          const bAge = parseInt(b.age || '') || 0;
          if (aAge !== bAge) return aAge - bAge;
          return (a.team_letter || 'A').localeCompare(b.team_letter || 'A');
        }
        return 0;
      }).map((s: any, i: number) => ({
        key: `${eventNum}-${heatNum}-${i}`,
        lane: s.result_lane || '',
        isRelay: !!s.isRelay,
        swimmerId: s.swimmer?.id || undefined,
        swimmerName: s.isRelay ? undefined : `${s.swimmer?.given_name || ''} ${s.swimmer?.surname || ''}`.trim(),
        age: s.isRelay ? (s.age || '') : (s.swimmer?.age_group || ''),
        clubCode: s.swimmer?.club_code || '',
        teamName: s.isRelay ? (s.team_name || s.club_name || '') : undefined,
        teamLetter: s.isRelay ? (s.team_letter || 'A') : undefined,
        legs: s.isRelay ? ((s.legs || []) as any[]).sort((a: any, b: any) => a.leg_number - b.leg_number).map((l: any) => ({
          legNumber: l.leg_number as number,
          swimmerName: `${l.given_name || ''} ${l.surname || ''}`.trim(),
          age: String(l.age || l.age_group || ''),
        })) : undefined,
        originalTime: s.original_time,
        eventCode: eventData.eventCode,
        scratched: !!s.scratched,
        checkedIn: !!s.checked_in,
        resultDq: s.result_dq || null,
        resultTime: s.result_time ?? null,
      })),
    }))

    return {
      eventNum,
      displayName,
      genderLabel,
      eventCode: eventData.eventCode,
      estTime: heatStartTimes.get(`${eventNum}`)?.live,
      scheduledTime: heatStartTimes.get(`${eventNum}`)?.scheduled,
      deltaMinutes: heatStartTimes.get(`${eventNum}`)?.deltaMinutes || 0,
      entryCount: eventData.entries.length,
      isComplete,
      heats,
    }
  })

  // Build bio map keyed by swimmer_id
  const bioMap: Record<string, any> = {}
  for (const b of bios) {
    bioMap[b.swimmer_id] = b
  }

  // Build entry count record keyed by swimmer_id (for bio modal "Entered X events" display)
  const entryCountRecord: Record<string, number> = {}
  for (const e of entries) {
    const sid = (e as any).swimmer?.id
    if (sid) entryCountRecord[sid] = (entryCountRecord[sid] || 0) + 1
  }

  // Override session start times with computed first-event times (handles auto-start drift)
  const correctedSessions = sessionsForDisplay.map(s => {
    const firstEvent = s.events.find(ev => heatStartTimes.has(String(ev)))
    if (firstEvent) {
      const timing = heatStartTimes.get(String(firstEvent))
      if (timing) return { ...s, start: timing.scheduled }
    }
    return s
  })

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="font-display font-bold text-3xl text-gray-900 mb-2">Meet Program</h1>
      <p className="text-gray-500 mb-8">Brisbane Southside Masters SC Meet — Sleeman Sports Complex, Chandler</p>

      <ProgramContent
        sessions={correctedSessions}
        events={processedEvents}
        bioMap={bioMap}
        breaks={breakDefs}
        entryCountMap={entryCountRecord}
        heatLaneVisible={!!campaign?.heat_lane_visible}
      />
    </div>
  )
}
