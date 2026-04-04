import { getEntries, getCampaign } from '@/lib/supabase/queries'
import { EntryListClient } from './EntryListClient'

export const revalidate = 60

export default async function EntriesPage() {
  const [entries, campaign] = await Promise.all([getEntries(), getCampaign()])
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
      clubData.swimmers.set(swimmerKey, { ...s, entries: [] })
    }
    clubData.swimmers.get(swimmerKey)!.entries.push(e)
  }

  const clubList = [...clubMap.values()]
    .sort((a, b) => a.club.localeCompare(b.club))
    .map(c => ({
      ...c,
      swimmers: [...c.swimmers.values()].sort((a, b) => a.surname.localeCompare(b.surname)),
    }))

  const totalSwimmers = new Set(entries.filter(e => e.swimmer).map(e => e.swimmer.id)).size
  const totalClubs = clubList.length

  if (campaign && !campaign.entries_closed) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="font-display font-bold text-3xl text-dark-900 mb-2">Entry List</h1>
        <div className="text-center py-20 bg-navy-50/50 rounded-2xl">
          <h2 className="font-display font-bold text-xl text-navy-700 mb-2">Entry List Not Yet Available</h2>
          <p className="text-navy-500">The entry list will be published once entries close. Check back soon!</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="font-display font-bold text-3xl text-dark-900 mb-2">Entry List</h1>
      <p className="text-dark-500 mb-8">{totalSwimmers} swimmers &bull; {entries.length} entries &bull; {totalClubs} clubs</p>
      <EntryListClient clubs={clubList} showHeatLane={showHeatLane} />
    </div>
  )
}
