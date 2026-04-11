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

  // Check if waitlist is enabled + get limits + session plan + pricing
  const { data: campaign } = await nt.from('nt_campaigns')
    .select('waitlist_enabled, total_lanes, lane_zero_position, max_individual_events, max_events_per_day, session_plan, waitlist_cost_enabled, waitlist_individual_fee_cents, waitlist_relay_fee_cents, waitlist_late_fee_cents, waitlist_late_fee_date')
    .eq('id', CAMPAIGN_ID)
    .single()

  if (!campaign?.waitlist_enabled) {
    return NextResponse.json({ enabled: false, events: [], myNominations: [] })
  }

  // Fetch entries, swimmer's entries, existing nominations, and all pending/approved nominations
  const [{ data: allEntries }, { data: myEntries }, { data: myNominations }, { data: allPendingNoms }] = await Promise.all([
    nt.from('nt_entries')
      .select('event_code, event_gender, event_number, scratched')
      .eq('campaign_id', CAMPAIGN_ID),
    nt.from('nt_entries')
      .select('event_code, event_gender')
      .eq('campaign_id', CAMPAIGN_ID)
      .eq('member_id', memberId)
      .or('scratched.is.null,scratched.eq.false'),
    nt.from('nt_waitlist_items')
      .select('*')
      .eq('campaign_id', CAMPAIGN_ID)
      .eq('member_id', memberId),
    nt.from('nt_waitlist_items')
      .select('event_code, event_gender')
      .eq('campaign_id', CAMPAIGN_ID)
      .in('status', ['pending', 'approved']),
  ])

  // Calculate current event count (entries + pending/approved nominations)
  const pendingApprovedNoms = (myNominations || []).filter(
    (n: any) => n.status === 'pending' || n.status === 'approved'
  )
  const currentEventCount = (myEntries || []).length + pendingApprovedNoms.length
  const maxIndividualEvents = campaign.max_individual_events ?? null
  const remainingSlots = maxIndividualEvents !== null
    ? Math.max(0, maxIndividualEvents - currentEventCount)
    : null

  // Calculate available spots per event
  const effectiveLanes = campaign.total_lanes - (campaign.lane_zero_position === 'none' ? 1 : 0)
  const eventMap = new Map<string, { eventCode: string; eventGender: string | null; eventNumber: string | null; count: number }>()

  for (const entry of (allEntries || [])) {
    if (entry.scratched) continue
    const key = `${entry.event_code}|${entry.event_gender || ''}`
    if (!eventMap.has(key)) {
      eventMap.set(key, { eventCode: entry.event_code, eventGender: entry.event_gender, eventNumber: entry.event_number || null, count: 0 })
    }
    eventMap.get(key)!.count++
  }

  // Count all pending/approved nominations as soft entries
  for (const nom of (allPendingNoms || [])) {
    const key = `${nom.event_code}|${nom.event_gender || ''}`
    const existing = eventMap.get(key)
    if (existing) existing.count++
  }

  // Exclude events the swimmer is already in or has a pending/approved nomination for
  const myEntryKeys = new Set((myEntries || []).map((e: any) => `${e.event_code}|${e.event_gender || ''}`))
  const myNomKeys = new Set(
    pendingApprovedNoms.map((n: any) => `${n.event_code}|${n.event_gender || ''}`)
  )

  // Filter events by swimmer gender (M -> Male + Mixed, F -> Female + Mixed)
  const swimmerGender = session.swimmer.gender as string | null
  function matchesGender(eventGender: string | null): boolean {
    if (!eventGender || eventGender === 'Mixed') return true
    if (!swimmerGender) return true
    const g = swimmerGender.toLowerCase()
    const isMale = g === 'm' || g === 'male'
    const isFemale = g === 'f' || g === 'female'
    if (isMale && eventGender === 'Male') return true
    if (isFemale && eventGender === 'Female') return true
    return false
  }

  const events = []
  for (const [key, info] of eventMap) {
    const heats = Math.ceil(info.count / effectiveLanes)
    const totalSlots = heats * effectiveLanes
    const available = totalSlots - info.count
    if (available > 0 && !myEntryKeys.has(key) && !myNomKeys.has(key) && matchesGender(info.eventGender)) {
      events.push({
        eventCode: info.eventCode,
        eventGender: info.eventGender,
        eventNumber: info.eventNumber,
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
      gender: swimmerGender,
      club_code: session.swimmer.club_code,
      club_name: session.swimmer.club_name,
    },
    maxIndividualEvents,
    currentEventCount,
    remainingSlots,
    sessionPlan: campaign.session_plan || null,
    pricing: campaign.waitlist_cost_enabled ? {
      individualFeeCents: campaign.waitlist_individual_fee_cents ?? 0,
      relayFeeCents: campaign.waitlist_relay_fee_cents ?? 0,
      lateFeeCents: campaign.waitlist_late_fee_cents ?? 0,
      lateFeeDate: campaign.waitlist_late_fee_date ?? null,
    } : null,
  })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { token } = body

  if (!token) return NextResponse.json({ error: 'Token required' }, { status: 401 })

  // Support both single and batch format
  let nominations: Array<{ event_code: string; event_gender: string | null; seed_time: number | null; notes: string | null }>
  if (body.nominations && Array.isArray(body.nominations)) {
    nominations = body.nominations
  } else if (body.event_code) {
    nominations = [{
      event_code: body.event_code,
      event_gender: body.event_gender ?? null,
      seed_time: body.seed_time ?? null,
      notes: body.notes ?? null,
    }]
  } else {
    return NextResponse.json({ error: 'No nominations provided' }, { status: 400 })
  }

  if (nominations.length === 0) {
    return NextResponse.json({ error: 'No nominations provided' }, { status: 400 })
  }

  // Validate seed time is provided for each
  for (const nom of nominations) {
    if (!nom.event_code) return NextResponse.json({ error: 'Event code required' }, { status: 400 })
    if (nom.seed_time === null || nom.seed_time === undefined || nom.seed_time <= 0) {
      return NextResponse.json({ error: `Seed time is required for event ${nom.event_code}` }, { status: 400 })
    }
  }

  const sb = createServerClient()
  const nt = ntDemo(sb)

  // Validate session
  const { data: session } = await nt.from('portal_sessions')
    .select('*, swimmer:nt_swimmers(*)')
    .eq('token', token)
    .single()

  if (!session?.swimmer) return NextResponse.json({ error: 'Invalid session' }, { status: 401 })

  const swimmer = session.swimmer

  // Check entry rules (max total, max per day, max 400m)
  const { data: campaign } = await nt.from('nt_campaigns')
    .select('max_individual_events, max_events_per_day, session_plan')
    .eq('id', CAMPAIGN_ID)
    .single()

  {
    const [{ data: existingEntries }, { data: existingNoms }] = await Promise.all([
      nt.from('nt_entries')
        .select('id, event_code, event_number')
        .eq('campaign_id', CAMPAIGN_ID)
        .eq('member_id', swimmer.member_id)
        .or('scratched.is.null,scratched.eq.false'),
      nt.from('nt_waitlist_items')
        .select('id, event_code, event_number')
        .eq('campaign_id', CAMPAIGN_ID)
        .eq('member_id', swimmer.member_id)
        .in('status', ['pending', 'approved']),
    ])

    const existing = [
      ...(existingEntries || []).map((e: any) => ({ event_code: e.event_code, event_number: e.event_number })),
      ...(existingNoms || []).map((n: any) => ({ event_code: n.event_code, event_number: n.event_number })),
    ]
    const proposed = nominations.map(n => ({ event_code: n.event_code, event_number: null as string | null }))
    const allEvents = [...existing, ...proposed]

    // Rule 1: Max total individual events
    const maxTotal = campaign?.max_individual_events ?? null
    if (maxTotal !== null && allEvents.length > maxTotal) {
      const remaining = Math.max(0, maxTotal - existing.length)
      return NextResponse.json({
        error: remaining <= 0
          ? `You have reached the maximum of ${maxTotal} individual events`
          : `You can only nominate for ${remaining} more event${remaining === 1 ? '' : 's'} (maximum ${maxTotal})`
      }, { status: 400 })
    }

    // Rule 2: Max 400m events (2)
    const max400m = 2
    const count400m = allEvents.filter(e => e.event_code.startsWith('400')).length
    if (count400m > max400m) {
      return NextResponse.json({
        error: `Maximum ${max400m} events at 400m distance allowed (would be ${count400m})`
      }, { status: 400 })
    }

    // Rule 3: Max events per day
    const maxPerDay = campaign?.max_events_per_day ?? null
    if (maxPerDay !== null && campaign?.session_plan) {
      const sp = campaign.session_plan as any
      if (sp.firstSession && sp.markers) {
        // Build event_number -> day map
        const allEventNumbers = allEvents.map(e => e.event_number).filter(Boolean) as string[]
        const sortedMarkers = [...sp.markers].sort(
          (a: any, b: any) => parseInt(a.afterEventNumber) - parseInt(b.afterEventNumber)
        )
        const dayMap: Record<string, number> = {}
        for (const evtNum of allEventNumbers) {
          let day = sp.firstSession.dayNumber
          for (const m of sortedMarkers) {
            if (parseInt(evtNum) > parseInt(m.afterEventNumber)) {
              day = m.session.dayNumber
            }
          }
          dayMap[evtNum] = day
        }
        // Count per day
        const dayBuckets = new Map<number, number>()
        for (const e of allEvents) {
          if (e.event_number) {
            const day = dayMap[e.event_number]
            if (day != null) dayBuckets.set(day, (dayBuckets.get(day) || 0) + 1)
          }
        }
        for (const [day, count] of dayBuckets) {
          if (count > maxPerDay) {
            return NextResponse.json({
              error: `Maximum ${maxPerDay} events per day - Day ${day} would have ${count} events`
            }, { status: 400 })
          }
        }
      }
    }
  }

  // Validate each nomination (not already entered, not already nominated)
  for (const nom of nominations) {
    const { data: existing } = await nt.from('nt_entries')
      .select('id')
      .eq('campaign_id', CAMPAIGN_ID)
      .eq('member_id', swimmer.member_id)
      .eq('event_code', nom.event_code)
      .is('scratched', null)
      .limit(1)

    if (existing && existing.length > 0) {
      return NextResponse.json({ error: `Already entered in event ${nom.event_code}` }, { status: 409 })
    }

    const { data: existingNom } = await nt.from('nt_waitlist_items')
      .select('id')
      .eq('campaign_id', CAMPAIGN_ID)
      .eq('member_id', swimmer.member_id)
      .eq('event_code', nom.event_code)
      .in('status', ['pending', 'approved'])
      .limit(1)

    if (existingNom && existingNom.length > 0) {
      return NextResponse.json({ error: `Already nominated for event ${nom.event_code}` }, { status: 409 })
    }
  }

  // Get max queue position
  const { data: maxQ } = await nt.from('nt_waitlist_items')
    .select('queue_position')
    .eq('campaign_id', CAMPAIGN_ID)
    .order('queue_position', { ascending: false })
    .limit(1)

  let queuePos = ((maxQ?.[0]?.queue_position) ?? 0) + 1

  // Generate a shared group ID for all items in this submission
  const submissionGroup = crypto.randomUUID()

  // Insert all nominations
  const items = []
  for (const nom of nominations) {
    const { data: item, error: insertErr } = await nt.from('nt_waitlist_items')
      .insert({
        campaign_id: CAMPAIGN_ID,
        member_id: swimmer.member_id,
        swimmer_name: `${swimmer.given_name} ${swimmer.surname}`,
        club_code: swimmer.club_code || null,
        club_name: swimmer.club_name || null,
        event_code: nom.event_code,
        event_gender: nom.event_gender || null,
        seed_time: nom.seed_time,
        status: 'pending',
        email: null,
        notes: nom.notes || null,
        queue_position: queuePos,
        source: 'portal',
        submission_group: submissionGroup,
      })
      .select()
      .single()

    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })
    items.push(item)
    queuePos++
  }

  return NextResponse.json({ items })
}

export async function DELETE(req: NextRequest) {
  const body = await req.json()
  const { token, nomination_id } = body

  if (!token) return NextResponse.json({ error: 'Token required' }, { status: 401 })
  if (!nomination_id) return NextResponse.json({ error: 'Nomination ID required' }, { status: 400 })

  const sb = createServerClient()
  const nt = ntDemo(sb)

  // Validate session
  const { data: session } = await nt.from('portal_sessions')
    .select('*, swimmer:nt_swimmers(*)')
    .eq('token', token)
    .single()

  if (!session?.swimmer) return NextResponse.json({ error: 'Invalid session' }, { status: 401 })

  // Fetch the nomination and verify ownership + status
  const { data: nomination } = await nt.from('nt_waitlist_items')
    .select('id, member_id, status')
    .eq('id', nomination_id)
    .eq('campaign_id', CAMPAIGN_ID)
    .single()

  if (!nomination) return NextResponse.json({ error: 'Nomination not found' }, { status: 404 })
  if (nomination.member_id !== session.swimmer.member_id) {
    return NextResponse.json({ error: 'Not your nomination' }, { status: 403 })
  }
  if (nomination.status !== 'pending') {
    return NextResponse.json({ error: 'Only pending nominations can be cancelled' }, { status: 400 })
  }

  const { error: deleteErr } = await nt.from('nt_waitlist_items')
    .delete()
    .eq('id', nomination_id)

  if (deleteErr) return NextResponse.json({ error: deleteErr.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
