import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, ntDemo } from '@/lib/supabase/server'
import { CAMPAIGN_ID } from '@/lib/supabase/config'

// Rate limit: max codes per member per hour
const MAX_CODES_PER_MEMBER_PER_HOUR = 3
// Rate limit: max codes per IP per hour (prevents enumeration)
const MAX_CODES_PER_IP_PER_HOUR = 10

async function getGraphAccessToken(): Promise<string | null> {
  const tenantId = process.env.GRAPH_TENANT_ID
  const clientId = process.env.GRAPH_CLIENT_ID
  const clientSecret = process.env.GRAPH_CLIENT_SECRET

  if (!tenantId || !clientId || !clientSecret) return null

  const tokenResponse = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        scope: 'https://graph.microsoft.com/.default',
        grant_type: 'client_credentials',
      }),
    }
  )

  if (!tokenResponse.ok) {
    console.error('[SWIMFAST AUTH] Graph token request failed:', await tokenResponse.text())
    return null
  }

  const { access_token } = await tokenResponse.json()
  return access_token
}

async function sendEmailViaGraph(accessToken: string, toEmail: string, swimmerName: string, memberId: string, code: string): Promise<boolean> {
  const fromEmail = process.env.GRAPH_EMAIL_FROM
  if (!fromEmail) return false

  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #3da3e6 0%, #140070 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; }
        .code-box { background: #f3f4f6; border: 2px solid #3da3e6; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0; }
        .code { font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #3da3e6; font-family: 'Courier New', monospace; }
        .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; border-top: 1px solid #e5e7eb; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1 style="margin: 0; font-size: 24px;">Swimmer Portal Verification</h1>
        <p style="margin: 10px 0 0 0; opacity: 0.9;">Brisbane Southside Masters SC Meet</p>
      </div>
      <div class="content">
        <p>Hi ${swimmerName},</p>
        <p>You requested access to the Swimmer Portal for <strong>Member ID: ${memberId}</strong>.</p>
        <div class="code-box">
          <p style="margin: 0 0 10px 0; font-size: 14px; color: #6b7280;">Your verification code is:</p>
          <div class="code">${code}</div>
        </div>
        <p style="color: #6b7280; font-size: 14px;"><strong>This code expires in 15 minutes.</strong> Enter it on the verification page to access your events, heats, and bio.</p>
        <p style="margin-top: 30px; color: #6b7280; font-size: 14px;">If you didn't request this code, you can safely ignore this email.</p>
      </div>
      <div class="footer">
        <p><strong>Swim Fast Masters Twilight Prep Meet 2026</strong></p>
        <p>Sunday, March 22 &bull; Musgrave Park Aquatic Centre</p>
      </div>
    </body>
    </html>
  `

  const sendResponse = await fetch(
    `https://graph.microsoft.com/v1.0/users/${fromEmail}/sendMail`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          subject: `Your Verification Code: ${code}`,
          body: { contentType: 'HTML', content: emailHtml },
          toRecipients: [{ emailAddress: { address: toEmail } }],
        },
        saveToSentItems: false,
      }),
    }
  )

  if (!sendResponse.ok) {
    console.error('[SWIMFAST AUTH] Graph sendMail failed:', await sendResponse.text())
    return false
  }

  return true
}

async function sendSmsViaClickSend(toPhone: string, code: string): Promise<boolean> {
  const username = process.env.CLICKSEND_USERNAME
  const apiKey = process.env.CLICKSEND_API_KEY

  if (!username || !apiKey) return false

  const response = await fetch('https://rest.clicksend.com/v3/sms/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Basic ' + Buffer.from(`${username}:${apiKey}`).toString('base64'),
    },
    body: JSON.stringify({
      messages: [{
        source: 'swimfast',
        body: `Your Swim Fast Portal verification code is: ${code}. Expires in 15 minutes.`,
        to: toPhone,
      }],
    }),
  })

  if (!response.ok) {
    console.error('[SWIMFAST AUTH] ClickSend SMS failed:', await response.text())
    return false
  }

  return true
}

function getClientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'unknown'
}

// GET: Lookup only — checks swimmer exists and has contact info, doesn't send anything
export async function GET(req: NextRequest) {
  const member_id = req.nextUrl.searchParams.get('member_id')
  if (!member_id) return NextResponse.json({ error: 'Member ID required' }, { status: 400 })

  const sb = createServerClient()
  const nt = ntDemo(sb)

  const { data: swimmer } = await nt.from('nt_swimmers')
    .select('given_name, surname').eq('campaign_id', CAMPAIGN_ID).eq('member_id', member_id).single()

  if (!swimmer) return NextResponse.json({ error: 'Swimmer not found in this meet. Check your Member ID.' }, { status: 404 })

  const { data: prefs } = await sb.from('member_preferences')
    .select('customer_email, customer_phone').eq('member_id', member_id).maybeSingle()

  let email = prefs?.customer_email || null
  let phone = prefs?.customer_phone || null

  if (!email) {
    const { data: contact } = await nt.from('nt_contacts')
      .select('email, mobile').eq('member_id', member_id).maybeSingle()
    email = contact?.email || null
    phone = contact?.mobile || phone
  }

  if (!email) {
    return NextResponse.json({
      needs_register: true,
      swimmer_name: `${swimmer.given_name} ${swimmer.surname}`,
    }, { status: 400 })
  }

  const maskedEmail = email.replace(/(.{2})(.*)(@.*)/, '$1***$3')
  const maskedPhone = phone ? '****' + phone.slice(-4) : null

  return NextResponse.json({
    swimmer_name: `${swimmer.given_name} ${swimmer.surname}`,
    masked_email: maskedEmail,
    masked_phone: maskedPhone,
    has_phone: !!phone,
  })
}

// POST: Send verification code
export async function POST(req: NextRequest) {
  const { member_id, method } = await req.json()
  if (!member_id) return NextResponse.json({ error: 'Member ID required' }, { status: 400 })

  const sb = createServerClient()
  const nt = ntDemo(sb)
  const clientIp = getClientIp(req)

  // --- RATE LIMITING ---
  const RATE_LIMIT_BYPASS_IPS = ['167.179.182.96']
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

  if (!RATE_LIMIT_BYPASS_IPS.includes(clientIp)) {
  // Check per-member rate limit
  const { count: memberCount } = await nt.from('portal_verification_codes')
    .select('*', { count: 'exact', head: true })
    .eq('campaign_id', CAMPAIGN_ID)
    .eq('member_id', member_id)
    .gte('created_at', oneHourAgo)

  if ((memberCount || 0) >= MAX_CODES_PER_MEMBER_PER_HOUR) {
    return NextResponse.json({
      error: 'Too many verification attempts. Please try again in an hour.',
    }, { status: 429 })
  }

  // Check per-IP rate limit
  const { count: ipCount } = await nt.from('portal_verification_codes')
    .select('*', { count: 'exact', head: true })
    .eq('campaign_id', CAMPAIGN_ID)
    .eq('ip_address', clientIp)
    .gte('created_at', oneHourAgo)

  if ((ipCount || 0) >= MAX_CODES_PER_IP_PER_HOUR) {
    return NextResponse.json({
      error: 'Too many requests from this device. Please try again later.',
    }, { status: 429 })
  }
  } // end rate limit bypass check

  // --- SWIMMER LOOKUP ---
  const { data: swimmer } = await nt.from('nt_swimmers')
    .select('*').eq('campaign_id', CAMPAIGN_ID).eq('member_id', member_id).single()

  if (!swimmer) return NextResponse.json({ error: 'Swimmer not found in this meet. Check your Member ID.' }, { status: 404 })

  // --- EMAIL/PHONE from DB only — never from user input ---
  // Try member_preferences first (nationals swimmers), fall back to nt_contacts (swim fast entrants)
  const { data: prefs } = await sb.from('member_preferences')
    .select('customer_email, customer_phone, customer_name')
    .eq('member_id', member_id).maybeSingle()

  let email = prefs?.customer_email || null
  let phone = prefs?.customer_phone || null

  if (!email) {
    const { data: contact } = await nt.from('nt_contacts')
      .select('email, mobile')
      .eq('member_id', member_id).maybeSingle()
    email = contact?.email || null
    phone = contact?.mobile || phone
  }

  if (!email) {
    return NextResponse.json({
      needs_register: true,
      swimmer_name: `${swimmer.given_name} ${swimmer.surname}`,
      error: 'No email address on file. Please register your details.',
    }, { status: 400 })
  }

  // --- SEND VERIFICATION CODE ---
  const useMethod = method === 'sms' ? 'sms' : 'email'
  const code = String(Math.floor(100000 + Math.random() * 900000))

  // Store verification code (15 min expiry)
  await nt.from('portal_verification_codes').insert({
    campaign_id: CAMPAIGN_ID,
    swimmer_id: swimmer.id,
    member_id,
    email,
    code,
    ip_address: clientIp,
    method: useMethod,
    expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    sent_at: new Date().toISOString(),
  })

  const swimmerName = `${swimmer.given_name} ${swimmer.surname}`
  let sent = false

  if (useMethod === 'sms' && phone) {
    sent = await sendSmsViaClickSend(phone, code)
    if (!sent) {
      console.error(`[SWIMFAST AUTH] SMS failed for ${member_id}, falling back to email`)
      // Fall back to email if SMS fails
    }
  }

  if (!sent) {
    // Send email (primary method, or fallback from SMS)
    const accessToken = await getGraphAccessToken()
    if (accessToken) {
      sent = await sendEmailViaGraph(accessToken, email, swimmerName, member_id, code)
      if (!sent) {
        console.error(`[SWIMFAST AUTH] Failed to send email to ${email}`)
        return NextResponse.json({ error: 'Failed to send verification code. Please try again.' }, { status: 500 })
      }
      console.log(`[SWIMFAST AUTH] Verification email sent to ${email} for ${swimmerName}`)
    } else {
      // Dev fallback — log code to console
      console.log(`[SWIMFAST AUTH] Graph API not configured. Code for ${member_id} (${swimmerName}): ${code}`)
    }
  }

  // Log to comms_email_log
  await nt.from('comms_email_log').insert({
    campaign_id: CAMPAIGN_ID,
    member_id,
    email,
    email_type: `portal_verification_${useMethod}`,
    sent_successfully: sent,
  }).then(() => {}).catch(() => {}) // non-blocking

  // Mask email/phone for display
  const maskedEmail = email.replace(/(.{2})(.*)(@.*)/, '$1***$3')
  const maskedPhone = phone ? '****' + phone.slice(-4) : null

  return NextResponse.json({
    masked_email: maskedEmail,
    masked_phone: maskedPhone,
    swimmer_name: swimmerName,
    method_used: sent && useMethod === 'sms' ? 'sms' : 'email',
    has_phone: !!phone,
  })
}
