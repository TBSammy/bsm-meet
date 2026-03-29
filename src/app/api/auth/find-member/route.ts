import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, ntDemo } from '@/lib/supabase/server'
import { CAMPAIGN_ID } from '@/lib/supabase/config'

// GET: Search swimmers by name for "Find my Member ID" feature
export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get('name')?.trim()
  if (!name || name.length < 2) {
    return NextResponse.json({ error: 'Please enter at least 2 characters' }, { status: 400 })
  }

  const sb = createServerClient()
  const nt = ntDemo(sb)

  // Escape SQL wildcards in user input
  const escape = (s: string) => s.replace(/%/g, '\\%').replace(/_/g, '\\_')

  const words = name.split(/\s+/).filter(Boolean)

  let query = nt
    .from('nt_swimmers')
    .select('member_id, given_name, surname, club_name, age_group')
    .eq('campaign_id', CAMPAIGN_ID)

  if (words.length === 1) {
    // Single word — match against given_name OR surname
    const w = escape(words[0])
    query = query.or(`given_name.ilike.%${w}%,surname.ilike.%${w}%`)
  } else {
    // Multiple words — try first+last in both orderings
    const first = escape(words[0])
    const last = escape(words[words.length - 1])
    query = query.or(
      `and(given_name.ilike.%${first}%,surname.ilike.%${last}%),and(given_name.ilike.%${last}%,surname.ilike.%${first}%)`
    )
  }

  const { data, error } = await query.order('surname').order('given_name').limit(20)

  if (error) {
    console.error('[SWIMFAST FIND] Search error:', error)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }

  return NextResponse.json({ swimmers: data || [] })
}
