import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, ntDemo } from '@/lib/supabase/server'
import { CAMPAIGN_ID } from '@/lib/supabase/config'

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'Token required' }, { status: 401 })

  const sb = createServerClient()
  const nt = ntDemo(sb)

  // Validate session
  const { data: session } = await nt.from('portal_sessions')
    .select('*, swimmer:nt_swimmers(*)')
    .eq('token', token)
    .single()

  if (!session?.swimmer) return NextResponse.json({ error: 'Invalid session' }, { status: 401 })

  const memberId = session.swimmer.member_id

  // Check if waitlist is enabled
  const { data: campaign } = await nt.from('nt_campaigns')
    .select('waitlist_enabled, total_lanes, lane_zero_position')
    .eq('id', CAMPAIGN_ID)
    .single()

  if (!campaign?.waitlist_enabled) {
    return NextResponse.json({ enabled: false, events: [], myNominations: [] })
  }

  // Fetch entries, swimmer's entries, and existing nominations in parallel
  const [{ data: allEntries }, { data: myEntries }, { data: myNominations }] = await Promise.all([
    nt.from('nt_entries')
      .select('event_code, event_gender, scratched')
      .eq('campaign_id', CAMPAIGN_ID),
    nt.from('nt_entries')
      .select('event_code, event_gender')
      .eq('campaign_id', CAMPAIGN_ID)
      .eq('member_id', memberId)
      .is('scratched', null),
    nt.from('nt_waitlist_items')
      .select('*')
      .eq('campaign_id', CAMPAIGN_ID)
      .eq('member_id', memberId),
  ])

  // Calculate available spots per event
  const effectiveLanes = campaign.total_lanes - (campaign.lane_zero_position === 'none' ? 1 : 0)
  const eventMap = new Map<string, { eventCode: string; eventGender: string | null; count: number }>()

  for (const entry of (allEntries || [])) {
    if (entry.scratched) continue
    const key = `${entry.event_code}|${entry.event_gender || ''}`
    if (!eventMap.has(key)) {
      eventMap.set(key, { eventCode: entry.event_code, eventGender: entry.event_gender, count: 0 })
    }
    eventMap.get(key)!.count++
  }

  // Exclude events the swimmer is already in or has a pending/approved nomination for
  const myEntryKeys = new Set((myEntries || []).map((e: any) => `${e.event_code}|${e.event_gender || ''}`))
  const myNomKeys = new Set(
    (myNominations || [])
      .filter((n: any) => n.status === 'pending' || n.status === 'approved')
      .map((n: any) => `${n.event_code}|${n.event_gender || ''}`)
  )

  const events = []
  for (const [key, info] of eventMap) {
    const heats = Math.ceil(info.count / effectiveLanes)
    const totalSlots = heats * effectiveLanes
    const available = totalSlots - info.count
    if (available > 0 && !myEntryKeys.has(key) && !myNomKeys.has(key)) {
      events.push({
        eventCode: info.eventCode,
        eventGender: info.eventGender,
        entered: info.count,
        available,
      })
    }
  }

  return NextResponse.json({
    enabled: true,
    events,
    myNominations: myNominations || [],
    swimmer: {
      given_name: session.swimmer.given_name,
      surname: session.swimmer.surname,
      member_id: memberId,
      club_code: session.swimmer.club_code,
      club_name: session.swimmer.club_name,
    },
  })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { token, event_code, event_gender, seed_time, notes } = body

  if (!token) return NextResponse.json({ error: 'Token required' }, { status: 401 })
  if (!event_code) return NextResponse.json({ error: 'Event code required' }, { status: 400 })

  const sb = createServerClient()
  const nt = ntDemo(sb)

  // Validate session
  const { data: session } = await nt.from('portal_sessions')
    .select('*, swimmer:nt_swimmers(*)')
    .eq('token', token)
    .single()

  if (!session?.swimmer) return NextResponse.json({ error: 'Invalid session' }, { status: 401 })

  const swimmer = session.swimmer

  // Check not already entered
  const { data: existing } = await nt.from('nt_entries')
    .select('id')
    .eq('campaign_id', CAMPAIGN_ID)
    .eq('member_id', swimmer.member_id)
    .eq('event_code', event_code)
    .is('scratched', null)
    .limit(1)

  if (existing && existing.length > 0) {
    return NextResponse.json({ error: 'Already entered in this event' }, { status: 409 })
  }

  // Check not already nominated (pending/approved)
  const { data: existingNom } = await nt.from('nt_waitlist_items')
    .select('id')
    .eq('campaign_id', CAMPAIGN_ID)
    .eq('member_id', swimmer.member_id)
    .eq('event_code', event_code)
    .in('status', ['pending', 'approved'])
    .limit(1)

  if (existingNom && existingNom.length > 0) {
    return NextResponse.json({ error: 'Already nominated for this event' }, { status: 409 })
  }

  // Get max queue position
  const { data: maxQ } = await nt.from('nt_waitlist_items')
    .select('queue_position')
    .eq('campaign_id', CAMPAIGN_ID)
    .order('queue_position', { ascending: false })
    .limit(1)

  const queuePos = ((maxQ?.[0]?.queue_position) ?? 0) + 1

  // Insert nomination
  const { data: item, error: insertErr } = await nt.from('nt_waitlist_items')
    .insert({
      campaign_id: CAMPAIGN_ID,
      member_id: swimmer.member_id,
      swimmer_name: `${swimmer.given_name} ${swimmer.surname}`,
      club_code: swimmer.club_code || null,
      club_name: swimmer.club_name || null,
      event_code,
      event_gender: event_gender || null,
      seed_time: seed_time || null,
      status: 'pending',
      email: null,
      notes: notes || null,
      queue_position: queuePos,
      source: 'portal',
    })
    .select()
    .single()

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })

  return NextResponse.json({ item })
}
