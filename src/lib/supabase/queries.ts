import { createServerClient } from './server'
import { CAMPAIGN_ID } from './config'
import type { SessionPlanJson } from '../sessions'

// Supabase PostgREST max-rows = 1000. Fetch all pages.
async function fetchAllPages(sb: ReturnType<typeof createServerClient>, schema: string, table: string, filters: Record<string, string>, orders?: string[]) {
  const PAGE = 1000
  let offset = 0
  const all: any[] = []
  while (true) {
    let q = sb.schema(schema as any).from(table).select('*').range(offset, offset + PAGE - 1)
    for (const [k, v] of Object.entries(filters)) q = q.eq(k, v)
    if (orders) for (const o of orders) q = q.order(o)
    const { data } = await q
    if (!data || data.length === 0) break
    all.push(...data)
    if (data.length < PAGE) break
    offset += PAGE
  }
  return all
}

export async function getSwimmers() {
  const sb = createServerClient()
  return fetchAllPages(sb, 'nt_demo', 'nt_swimmers', { campaign_id: CAMPAIGN_ID })
}

export async function getEntries() {
  const sb = createServerClient()
  const [entries, swimmers] = await Promise.all([
    fetchAllPages(sb, 'nt_demo', 'nt_entries', { campaign_id: CAMPAIGN_ID }, ['event_number', 'result_heat', 'result_lane']),
    fetchAllPages(sb, 'nt_demo', 'nt_swimmers', { campaign_id: CAMPAIGN_ID }),
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
  return fetchAllPages(sb, 'nt_demo', 'nt_splits', {}, ['marker'])
}

export async function getSwimmerMap() {
  const sb = createServerClient()
  const data = await fetchAllPages(sb, 'nt_demo', 'nt_swimmers', { campaign_id: CAMPAIGN_ID })
  const map = new Map<string, { given_name: string; surname: string; age_group: string }>()
  for (const s of data) {
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
