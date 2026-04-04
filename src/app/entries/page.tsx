import { getEntries } from '@/lib/supabase/queries'
import { EntryListClient } from './EntryListClient'

export const revalidate = 60

export default async function EntriesPage() {
  const entries = await getEntries()

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
    .sort((a, b) => b.swimmers.size - a.swimmers.size)
    .map(c => ({
      ...c,
      swimmers: [...c.swimmers.values()].sort((a, b) => a.surname.localeCompare(b.surname)),
    }))

  const totalSwimmers = new Set(entries.filter(e => e.swimmer).map(e => e.swimmer.id)).size
  const totalClubs = clubList.length

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="font-display font-bold text-3xl text-dark-900 mb-2">Entry List</h1>
      <p className="text-dark-500 mb-8">{totalSwimmers} swimmers &bull; {entries.length} entries &bull; {totalClubs} clubs</p>
      <EntryListClient clubs={clubList} />
    </div>
  )
}
