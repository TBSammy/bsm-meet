import { getEntries, getRelays, getCampaign, getSplits, getSwimmerMap } from '@/lib/supabase/queries'
import { eventName, relayEventName } from '@/lib/eventCodes'
import { ResultsClient } from './ResultsClient'

export const revalidate = 30

/** Extract starting age number from age group string (e.g. "25-29" → 25, "120" → 120) */
function ageGroupNum(ag: string | null | undefined): number {
  if (!ag) return 999
  const m = ag.match(/^(\d+)/)
  return m ? parseInt(m[1]) : 999
}

export default async function ResultsPage() {
  const [entries, relays, campaign, splits, swimmerMap] = await Promise.all([
    getEntries(), getRelays(), getCampaign(), getSplits(), getSwimmerMap()
  ])

  // Build splits map: entry_id -> splits[]
  const splitsMap: Record<string, any[]> = {}
  // Build relay leg splits map: relay_leg_id -> splits[]
  const relayLegSplitsMap: Record<string, any[]> = {}
  for (const sp of splits) {
    if (sp.entry_id) {
      if (!splitsMap[sp.entry_id]) splitsMap[sp.entry_id] = []
      splitsMap[sp.entry_id].push(sp)
    }
    if (sp.relay_leg_id) {
      if (!relayLegSplitsMap[sp.relay_leg_id]) relayLegSplitsMap[sp.relay_leg_id] = []
      relayLegSplitsMap[sp.relay_leg_id].push(sp)
    }
  }

  // Filter to entries that have results OR a DQ/NS status (exclude scratched only)
  const withResults = entries.filter((e: any) => !e.scratched && (e.result_time || e.result_place || e.result_dq))

  // Group by event — track event_gender for mixed-event sorting
  const eventMap = new Map<number, { name: string, eventGender: string, results: any[] }>()
  for (const e of withResults) {
    const num = e.event_number
    if (!eventMap.has(num)) {
      eventMap.set(num, { name: eventName(e.event_code || ''), eventGender: e.event_gender || '', results: [] })
    }
    eventMap.get(num)!.results.push({
      ...e,
      splits: splitsMap[e.id] || [],
    })
  }

  // Add relay results (include DQ/NS relays)
  const relaysWithResults = relays.filter((r: any) => r.result_time || r.result_place || r.result_dq)
  for (const r of relaysWithResults) {
    const num = parseInt(r.event_number) || 0
    if (!eventMap.has(num)) {
      eventMap.set(num, { name: relayEventName(r.event_code || ''), eventGender: r.event_gender || '', results: [] })
    }

    // Build legs with splits and swimmer identity
    const sortedLegs = ((r.legs || []) as any[])
      .sort((a: any, b: any) => (a.leg_number || 0) - (b.leg_number || 0))
    const legs = sortedLegs.map((leg: any, idx: number) => {
        const swimmer = leg.member_id ? swimmerMap.get(leg.member_id) : null
        // Keep original cumulative markers (relay positions like 175m, 200m)
        const raw = relayLegSplitsMap[leg.id] || []
        const legSplits = [...raw].sort((a: any, b: any) => a.marker - b.marker)
        // For the last leg, add the relay finish time as the final split
        // (HY3 files often omit the final G1 record — the finish is the result_time)
        if (idx === sortedLegs.length - 1 && r.result_time && legSplits.length > 0) {
          const lastTime = legSplits[legSplits.length - 1].time
          if (lastTime !== r.result_time) {
            const lastMarker = legSplits[legSplits.length - 1].marker
            legSplits.push({ marker: lastMarker + 1, time: r.result_time })
          }
        }
        return {
          id: leg.id,
          leg_number: leg.leg_number,
          member_id: leg.member_id,
          given_name: leg.given_name || swimmer?.given_name || null,
          surname: leg.surname || swimmer?.surname || null,
          age_group: leg.age_group || swimmer?.age_group || null,
          splits: legSplits,
        }
      })

    eventMap.get(num)!.results.push({
      ...r,
      isRelay: true,
      result_heat: r.heat,
      result_lane: r.lane,
      splits: [],
      legs,
      swimmer: { given_name: r.team_name || r.team_code || '', surname: '', club_code: r.team_code || '', club_name: r.team_name || '', gender: null, age_group: r.age || null },
    })
  }

  // Sort results within each event:
  // Mixed events: women first → age group asc → placing asc
  // Non-mixed: age group asc → placing asc
  for (const ev of eventMap.values()) {
    const isMixed = ev.eventGender === 'Mixed'
    ev.results.sort((a: any, b: any) => {
      // Gender sort for mixed individual events only (F/W first)
      if (isMixed && !a.isRelay && !b.isRelay) {
        const gA = a.swimmer?.gender === 'F' ? 0 : 1
        const gB = b.swimmer?.gender === 'F' ? 0 : 1
        if (gA !== gB) return gA - gB
      }
      // Age group ascending
      const ageA = ageGroupNum(a.swimmer?.age_group)
      const ageB = ageGroupNum(b.swimmer?.age_group)
      if (ageA !== ageB) return ageA - ageB
      // DQ/NS sort after placed swimmers
      const dqA = a.result_dq ? 1 : 0
      const dqB = b.result_dq ? 1 : 0
      if (dqA !== dqB) return dqA - dqB
      // Placing ascending
      return (parseInt(a.result_place) || 999) - (parseInt(b.result_place) || 999)
    })
  }

  const sortedEvents = [...eventMap.entries()].sort(([a], [b]) => a - b)

  if (campaign && !campaign.results_live) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="font-display font-bold text-3xl text-navy-900 mb-2">Results</h1>
        <div className="text-center py-20 bg-navy-50/50 rounded-2xl">
          <h2 className="font-display font-bold text-xl text-navy-700 mb-2">Results Not Yet Available</h2>
          <p className="text-navy-500">Results will be published once the meet begins. Check back during the event!</p>
          <p className="text-navy-400 text-sm mt-2">This page auto-refreshes every 30 seconds</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="font-display font-bold text-3xl text-navy-900 mb-2">Results</h1>
      <p className="text-navy-500 mb-8">
        {campaign?.has_results
          ? 'Live results — updates as results are imported'
          : 'Results will appear here once the meet begins. Check back during the event!'
        }
      </p>

      {sortedEvents.length === 0 ? (
        <div className="text-center py-20 bg-navy-50/50 rounded-2xl">
          <h2 className="font-display font-bold text-xl text-navy-700 mb-2">No Results Yet</h2>
          <p className="text-navy-500">Results will be published as each event is completed on meet day.</p>
          <p className="text-navy-400 text-sm mt-2">This page auto-refreshes every 30 seconds</p>
        </div>
      ) : (
        <ResultsClient events={sortedEvents} meetCourse={campaign?.meet_course || 'S'} pointsVisible={campaign?.points_visible ?? false} />
      )}
    </div>
  )
}
