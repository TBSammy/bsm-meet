import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, ntDemo } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const memberId = req.nextUrl.searchParams.get('member_id')
  if (!memberId) return NextResponse.json({ bio: null })

  const sb = createServerClient()
  const { data } = await ntDemo(sb).from('bio_swimmer_profiles')
    .select('*').eq('member_id', memberId).single()

  return NextResponse.json({ bio: data })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { token, bio_text, goals, fun_fact, years_swimming, commentator_consent, event_goals } = body

  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const sb = createServerClient()
  const nt = ntDemo(sb)

  // Validate session
  const { data: session } = await nt.from('portal_sessions')
    .select('*, swimmer:nt_swimmers(*)').eq('token', token).eq('verified', true).single()

  if (!session) return NextResponse.json({ error: 'Invalid session' }, { status: 401 })

  const swimmer = session.swimmer as any

  // Upsert bio by member_id (unique constraint handles one-per-swimmer)
  const { data: existing } = await nt.from('bio_swimmer_profiles')
    .select('id').eq('member_id', session.member_id).single()

  if (existing) {
    await nt.from('bio_swimmer_profiles').update({
      bio_text, goals, fun_fact, years_swimming, commentator_consent,
      event_goals: event_goals || {},
      first_name: swimmer.given_name,
      last_name: swimmer.surname,
      club: swimmer.club_name,
      updated_at: new Date().toISOString(),
    }).eq('id', existing.id)
  } else {
    await nt.from('bio_swimmer_profiles').insert({
      member_id: session.member_id,
      first_name: swimmer.given_name,
      last_name: swimmer.surname,
      club: swimmer.club_name,
      bio_text, goals, fun_fact, years_swimming, commentator_consent,
      event_goals: event_goals || {},
    })
  }

  return NextResponse.json({ success: true })
}
