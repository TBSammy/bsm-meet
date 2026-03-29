import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, ntDemo } from '@/lib/supabase/server'
import { CAMPAIGN_ID } from '@/lib/supabase/config'
import { computeHeatStartTimes, deriveSessionDefs } from '@/lib/sessions'
import { getSessionPlan } from '@/lib/supabase/queries'
import type { TimingOptions } from '@/lib/sessions'

export async function GET(req: NextRequest) {
  const memberId = req.nextUrl.searchParams.get('member_id')
  if (!memberId) return NextResponse.json({ entries: [] })

  const sb = createServerClient()

  // Fetch swimmer's entries, all entries (for timing), session plan, and campaign settings
  const [{ data: myEntries }, { data: allEntries }, sessionPlan, { data: campaign }] = await Promise.all([
    ntDemo(sb).from('nt_entries')
      .select('*').eq('campaign_id', CAMPAIGN_ID).eq('member_id', memberId),
    ntDemo(sb).from('nt_entries')
      .select('event_number,event_code,result_heat,original_time,result_time')
      .eq('campaign_id', CAMPAIGN_ID),
    getSessionPlan(),
    ntDemo(sb).from('nt_campaigns')
      .select('self_scratch_enabled,self_scratch_cutoff_min,check_in_enabled,check_in_cutoff_min')
      .eq('id', CAMPAIGN_ID).single(),
  ])

  // Build timing options from session plan
  let timingOptions: TimingOptions | undefined
  if (sessionPlan) {
    const allNums = new Set<number>((allEntries || []).map((e: any) => parseInt(e.event_number) || 0))
    allNums.delete(0)
    const derived = deriveSessionDefs(sessionPlan, [...allNums])
    timingOptions = {
      sessionDefs: derived.sessions,
      breaks: derived.breaks,
      settings: sessionPlan.settings,
    }
  }

  // Compute per-event-per-heat start times (scheduled + live)
  const heatTimes = computeHeatStartTimes(allEntries || [], timingOptions)

  // Attach timing to each of the swimmer's entries
  const sorted = (myEntries || [])
    .sort((a: any, b: any) => (parseInt(a.event_number) || 0) - (parseInt(b.event_number) || 0))
    .map((e: any) => {
      const key = `${parseInt(e.event_number)}-${parseInt(e.result_heat || '1')}`
      const eventKey = `${parseInt(e.event_number)}`
      const timing = heatTimes.get(key) || heatTimes.get(eventKey) || null
      return {
        ...e,
        est_start: timing?.live || timing?.scheduled || null,
        scheduled_start: timing?.scheduled || null,
        delta_minutes: timing?.deltaMinutes || 0,
      }
    })

  return NextResponse.json({
    entries: sorted,
    settings: {
      self_scratch_enabled: campaign?.self_scratch_enabled ?? false,
      self_scratch_cutoff_min: campaign?.self_scratch_cutoff_min ?? 30,
      check_in_enabled: campaign?.check_in_enabled ?? false,
      check_in_cutoff_min: campaign?.check_in_cutoff_min ?? 60,
    },
  })
}
