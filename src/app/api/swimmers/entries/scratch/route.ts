import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, ntDemo } from '@/lib/supabase/server'
import { CAMPAIGN_ID } from '@/lib/supabase/config'
import { computeHeatStartTimes, deriveSessionDefs } from '@/lib/sessions'
import { getSessionPlan } from '@/lib/supabase/queries'
import type { TimingOptions } from '@/lib/sessions'

export async function POST(req: NextRequest) {
  const { token, entry_id, action, reason } = await req.json()
  if (!token || !entry_id || !action) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }
  if (action !== 'scratch' && action !== 'unscratch') {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  const sb = createServerClient()
  const nt = ntDemo(sb)

  // Verify session
  const { data: session } = await nt.from('portal_sessions')
    .select('*, swimmer:nt_swimmers(*)').eq('token', token).eq('verified', true).single()

  if (!session || new Date(session.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 })
  }

  const memberId = session.member_id

  // Fetch the entry — verify it belongs to this swimmer
  const { data: entry } = await nt.from('nt_entries')
    .select('*').eq('id', entry_id).eq('campaign_id', CAMPAIGN_ID).eq('member_id', memberId).single()

  if (!entry) {
    return NextResponse.json({ error: 'Entry not found or not yours' }, { status: 404 })
  }

  // Fetch campaign settings
  const { data: campaign } = await nt.from('nt_campaigns')
    .select('self_scratch_enabled, self_scratch_cutoff_min, session_plan')
    .eq('id', CAMPAIGN_ID).single()

  if (!campaign?.self_scratch_enabled) {
    return NextResponse.json({ error: 'Self-scratch is not currently enabled' }, { status: 403 })
  }

  // Cutoff check: compare current time to event estimated start
  const cutoffMin = campaign.self_scratch_cutoff_min ?? 30
  if (entry.event_number) {
    const eventStart = await getEventStartTime(sb, entry.event_number, entry.result_heat, campaign.session_plan)
    if (eventStart) {
      const now = new Date()
      const msUntilEvent = eventStart.getTime() - now.getTime()
      const minUntilEvent = msUntilEvent / 60000
      if (minUntilEvent < cutoffMin) {
        return NextResponse.json({
          error: `Too late to ${action}. Cutoff is ${cutoffMin} minutes before your event.`,
        }, { status: 403 })
      }
    }
  }

  // Perform the scratch/unscratch
  const now = new Date().toISOString()
  if (action === 'scratch') {
    if (entry.scratched) {
      return NextResponse.json({ error: 'Already scratched' }, { status: 400 })
    }
    await nt.from('nt_entries').update({
      scratched: true,
      scratched_at: now,
      scratched_by: `swimmer:${memberId}`,
      scratch_reason: reason || null,
    }).eq('id', entry_id)
  } else {
    if (!entry.scratched) {
      return NextResponse.json({ error: 'Not scratched' }, { status: 400 })
    }
    await nt.from('nt_entries').update({
      scratched: false,
      scratched_at: null,
      scratched_by: null,
      scratch_reason: null,
    }).eq('id', entry_id)
  }

  // Audit log
  await nt.from('entry_status_log').insert({
    entry_id,
    campaign_id: CAMPAIGN_ID,
    member_id: memberId,
    action,
    performed_by: `swimmer:${memberId}`,
    reason: reason || null,
  })

  return NextResponse.json({ ok: true })
}

async function getEventStartTime(
  sb: ReturnType<typeof createServerClient>,
  eventNumber: string,
  resultHeat: string | null,
  sessionPlan: any,
): Promise<Date | null> {
  try {
    if (!sessionPlan) return null
    const { data: allEntries } = await ntDemo(sb).from('nt_entries')
      .select('event_number,event_code,result_heat,original_time,result_time')
      .eq('campaign_id', CAMPAIGN_ID)

    const allNums = new Set<number>((allEntries || []).map((e: any) => parseInt(e.event_number) || 0))
    allNums.delete(0)
    const derived = deriveSessionDefs(sessionPlan, [...allNums])
    const timingOptions: TimingOptions = {
      sessionDefs: derived.sessions,
      breaks: derived.breaks,
      settings: sessionPlan.settings,
    }

    const heatTimes = computeHeatStartTimes(allEntries || [], timingOptions)
    const key = `${parseInt(eventNumber)}-${parseInt(resultHeat || '1')}`
    const timing = heatTimes.get(key)
    if (!timing) return null

    // Parse the time string (e.g. "09:30 AM") into a Date for today
    const timeStr = timing.live || timing.scheduled
    if (!timeStr) return null

    const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
    if (!match) return null
    let hours = parseInt(match[1])
    const minutes = parseInt(match[2])
    const ampm = match[3].toUpperCase()
    if (ampm === 'PM' && hours !== 12) hours += 12
    if (ampm === 'AM' && hours === 12) hours = 0

    const today = new Date()
    today.setHours(hours, minutes, 0, 0)
    return today
  } catch {
    return null
  }
}
