import { createServerClient } from './server'
import { CAMPAIGN_ID } from './config'
import type { SessionPlanJson } from '../sessions'

export async function getSwimmers() {
  const sb = createServerClient()
  const { data } = await sb.schema('nt_demo').from('nt_swimmers')
    .select('*').eq('campaign_id', CAMPAIGN_ID).order('surname')
  return data || []
}

export async function getEntries() {
  const sb = createServerClient()
  const [{ data: entries }, { data: swimmers }] = await Promise.all([
    sb.schema('nt_demo').from('nt_entries')
      .select('*')
      .eq('campaign_id', CAMPAIGN_ID)
      .order('event_number').order('result_heat').order('result_lane'),
    sb.schema('nt_demo').from('nt_swimmers')
      .select('*')
      .eq('campaign_id', CAMPAIGN_ID),
  ])
  // Join in code — no FK between nt_entries and nt_swimmers
  const swimmerMap = new Map((swimmers || []).map((s: any) => [s.member_id, s]))
  return (entries || []).map((e: any) => ({
    ...e,
    swimmer: swimmerMap.get(e.member_id) || null,
  }))
}

export async function getRelays() {
  const sb = createServerClient()
  const { data } = await sb.schema('nt_demo').from('nt_relays')
    .select('*, legs:nt_relay_legs(*)')
    .eq('campaign_id', CAMPAIGN_ID)
    .order('event_number').order('heat').order('lane')
  return data || []
}

export async function getCampaign() {
  const sb = createServerClient()
  const { data } = await sb.schema('nt_demo').from('nt_campaigns')
    .select('*').eq('id', CAMPAIGN_ID).single()
  return data
}

export async function getSessionPlan(): Promise<SessionPlanJson | null> {
  const sb = createServerClient()
  const { data } = await sb.schema('nt_demo').from('nt_campaigns')
    .select('session_plan').eq('id', CAMPAIGN_ID).single()
  return (data?.session_plan as SessionPlanJson) || null
}

export async function getSplits() {
  const sb = createServerClient()
  const { data } = await sb.schema('nt_demo').from('nt_splits')
    .select('*')
    .order('marker')
  return data || []
}

export async function getSwimmerMap() {
  const sb = createServerClient()
  const { data } = await sb.schema('nt_demo').from('nt_swimmers')
    .select('member_id, given_name, surname, age_group')
    .eq('campaign_id', CAMPAIGN_ID)
  const map = new Map<string, { given_name: string; surname: string; age_group: string }>()
  for (const s of data || []) {
    map.set(s.member_id, s)
  }
  return map
}

export async function getBioProfiles() {
  const sb = createServerClient()
  const { data } = await sb.schema('nt_demo').from('bio_swimmer_profiles')
    .select('*')
    .eq('commentator_consent', true)
  return data || []
}
