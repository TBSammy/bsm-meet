import { getSwimmers, getCampaign } from '@/lib/supabase/queries'
import { CompetitorsClient } from './CompetitorsClient'

export const revalidate = 60

export default async function CompetitorsPage() {
  const [swimmers, campaign] = await Promise.all([getSwimmers(), getCampaign()])

  if (campaign && !campaign.entries_closed) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="font-display font-bold text-3xl text-dark-900 mb-2">Competitors</h1>
        <div className="text-center py-20 bg-bsm-50/50 rounded-2xl">
          <h2 className="font-display font-bold text-xl text-dark-700 mb-2">Competitors Not Yet Available</h2>
          <p className="text-dark-500">The competitors list will be published once entries close. Check back soon!</p>
        </div>
      </div>
    )
  }

  // Group swimmers by club
  const clubMap = new Map<string, { code: string; clubName: string; swimmers: any[] }>()
  for (const s of swimmers) {
    const code = s.club_code || 'UNK'
    if (!clubMap.has(code)) {
      clubMap.set(code, { code, clubName: s.club_name || code, swimmers: [] })
    }
    clubMap.get(code)!.swimmers.push(s)
  }

  const clubRows = Array.from(clubMap.values()).map(c => ({
    code: c.code,
    clubName: c.clubName,
    female: c.swimmers.filter((s: any) => s.gender === 'F').length,
    male: c.swimmers.filter((s: any) => s.gender === 'M').length,
    total: c.swimmers.length,
    swimmers: c.swimmers.map((s: any) => ({
      id: s.id,
      given_name: s.given_name,
      surname: s.surname,
      gender: s.gender,
      age: s.age,
      age_group: s.age_group,
    })).sort((a: any, b: any) => a.surname.localeCompare(b.surname) || a.given_name.localeCompare(b.given_name)),
  }))

  const cutoff = (campaign as any)?.club_size_cutoff ?? 9

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="font-display font-bold text-3xl text-dark-900 mb-2">Competitors</h1>
      <p className="text-dark-500 mb-8">
        {swimmers.length} swimmers &bull; {clubRows.length} clubs
      </p>
      <CompetitorsClient clubs={clubRows} cutoff={cutoff} />
    </div>
  )
}
