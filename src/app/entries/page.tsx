import { getEntries, getCampaign, getRelays } from '@/lib/supabase/queries'
import { EntryListClient } from './EntryListClient'

export const revalidate = 60

export default async function EntriesPage() {
  const [entries, campaign, relays] = await Promise.all([getEntries(), getCampaign(), getRelays()])
  const showHeatLane = campaign?.heat_lane_visible ?? false

  // Group by club then swimmer (use swimmer.id as key to avoid name collisions)
  const clubMap = new Map<string, { club: string, code: string, swimmers: Map<string, any> }>()
  for (const e of entries) {
    const s = e.swimmer
    if (!s) continue
    const clubKey = s.club_name || 'Unknown'
    if (!clubMap.has(clubKey)) {
      clubMap.set(clubKey, { club: clubKey, code: s.club_code || '', swimmers: new Map() })
    }
    const swimmerKey = s.id
    const clubData = clubMap.get(clubKey)!
    if (!clubData.swimmers.has(swimmerKey)) {
      clubData.swimmers.set(swimmerKey, { ...s, entries: [], relays: [] })
    }
    clubData.swimmers.get(swimmerKey)!.entries.push(e)
  }

  // Build member_id → swimmer location map for relay matching
  const memberIdMap = new Map<string, { clubKey: string, swimmerKey: string }>()
  for (const [clubKey, clubData] of clubMap) {
    for (const [swimmerKey, swimmer] of clubData.swimmers) {
      if (swimmer.member_id) {
        memberIdMap.set(swimmer.member_id, { clubKey, swimmerKey })
      }
    }
  }

  // Attach relay appearances to each swimmer
  let totalRelayAppearances = 0
  for (const r of relays) {
    if (!r.legs) continue
    for (const leg of r.legs) {
      if (!leg.member_id) continue
      const loc = memberIdMap.get(leg.member_id)
      if (!loc) continue // swimmer not in individual entries — skip for now
      const swimmer = clubMap.get(loc.clubKey)?.swimmers.get(loc.swimmerKey)
      if (!swimmer) continue
      swimmer.relays.push({
        relayId: r.id,
        eventCode: r.event_code,
        eventGender: r.event_gender || '',
        eventNumber: r.event_number || '',
        heat: r.heat || '',
        lane: r.lane || '',
        seedTime: r.seed_time,
        legNumber: leg.leg_number,
      })
      totalRelayAppearances++
    }
  }

  const clubList = [...clubMap.values()]
    .sort((a, b) => a.club.localeCompare(b.club))
    .map(c => ({
      ...c,
      swimmers: [...c.swimmers.values()].sort((a, b) => a.surname.localeCompare(b.surname)),
    }))

  const totalSwimmers = new Set(entries.filter(e => e.swimmer).map(e => e.swimmer.id)).size
  const totalClubs = clubList.length
  const totalRelayTeams = relays.length

  if (campaign && !campaign.entries_closed) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="font-display font-bold text-3xl text-navy-900 mb-2">Entry List</h1>
        <div className="text-center py-20 bg-navy-50/50 rounded-2xl">
          <h2 className="font-display font-bold text-xl text-navy-700 mb-2">Entry List Not Yet Available</h2>
          <p className="text-navy-500">The entry list will be published once entries close. Check back soon!</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="font-display font-bold text-3xl text-navy-900 mb-2">Entry List</h1>
      <p className="text-navy-500 mb-8">
        {totalSwimmers} swimmers &bull; {entries.length} entries &bull; {totalClubs} clubs
        {totalRelayTeams > 0 && <> &bull; {totalRelayTeams} relay teams</>}
      </p>
      <EntryListClient clubs={clubList} showHeatLane={showHeatLane} />
    </div>
  )
}
