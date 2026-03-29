import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, ntDemo } from '@/lib/supabase/server'
import { CAMPAIGN_ID } from '@/lib/supabase/config'

export async function POST(req: NextRequest) {
  const { member_id, code } = await req.json()
  if (!member_id || !code) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const sb = createServerClient()
  const nt = ntDemo(sb)

  // Find latest unverified code for this member
  const { data: codeRecord } = await nt.from('portal_verification_codes')
    .select('*').eq('campaign_id', CAMPAIGN_ID).eq('member_id', member_id)
    .is('verified_at', null).order('created_at', { ascending: false }).limit(1).single()

  if (!codeRecord) return NextResponse.json({ error: 'No pending code. Please request a new one.' }, { status: 404 })
  if (codeRecord.code !== code) return NextResponse.json({ error: 'Invalid code. Please try again.' }, { status: 400 })
  if (new Date(codeRecord.expires_at) < new Date()) return NextResponse.json({ error: 'Code expired. Please request a new one.' }, { status: 400 })

  // Mark code verified
  await nt.from('portal_verification_codes').update({ verified_at: new Date().toISOString() }).eq('id', codeRecord.id)

  // Get swimmer
  const { data: swimmer } = await nt.from('nt_swimmers')
    .select('*').eq('id', codeRecord.swimmer_id).single()

  // Create session
  const { data: session } = await nt.from('portal_sessions').insert({
    campaign_id: CAMPAIGN_ID,
    swimmer_id: codeRecord.swimmer_id,
    member_id,
    email: codeRecord.email,
    verified: true,
  }).select().single()

  return NextResponse.json({ token: session?.token, swimmer })
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) return NextResponse.json({ valid: false })

  const sb = createServerClient()
  const nt = ntDemo(sb)

  const { data: session } = await nt.from('portal_sessions')
    .select('*, swimmer:nt_swimmers(*)').eq('token', token).eq('verified', true).single()

  if (!session || new Date(session.expires_at) < new Date()) {
    return NextResponse.json({ valid: false })
  }

  return NextResponse.json({ valid: true, swimmer: session.swimmer })
}
