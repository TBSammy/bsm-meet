import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, ntDemo } from '@/lib/supabase/server'
import { CAMPAIGN_ID } from '@/lib/supabase/config'

/**
 * Register endpoint — saves member contact details only, does NOT send anything.
 * After registering, the user must call /api/auth/send-code separately.
 * This separation prevents the send-code endpoint from ever accepting user-provided emails.
 */
export async function POST(req: NextRequest) {
  const { member_id, email, phone } = await req.json()

  if (!member_id || !email) {
    return NextResponse.json({ error: 'Member ID and email are required' }, { status: 400 })
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return NextResponse.json({ error: 'Invalid email address.' }, { status: 400 })
  }

  const sb = createServerClient()
  const nt = ntDemo(sb)

  // Verify swimmer exists in this meet
  const { data: swimmer } = await nt.from('nt_swimmers')
    .select('given_name, surname')
    .eq('campaign_id', CAMPAIGN_ID)
    .eq('member_id', member_id)
    .single()

  if (!swimmer) {
    return NextResponse.json({ error: 'Swimmer not found in this meet.' }, { status: 404 })
  }

  // Check if member_preferences already exists — INSERT only, never overwrite
  const { data: existing } = await sb.from('member_preferences')
    .select('member_id')
    .eq('member_id', member_id)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'Contact details already on file. Use Continue to log in.' }, { status: 409 })
  }

  // Insert new record
  const { error: insertError } = await sb.from('member_preferences').insert({
    member_id,
    customer_email: email.trim().toLowerCase(),
    customer_phone: phone?.trim() || '',
    customer_name: `${swimmer.given_name} ${swimmer.surname}`,
    given_name: swimmer.given_name,
    surname: swimmer.surname,
    source: 'swimfast_register',
  })

  if (insertError) {
    console.error('[SWIMFAST AUTH] Register failed:', insertError)
    return NextResponse.json({ error: 'Failed to save your details. Please try again.' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
