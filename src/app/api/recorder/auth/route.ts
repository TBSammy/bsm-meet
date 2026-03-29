import { NextRequest, NextResponse } from 'next/server'

const RECORDER_PASSPHRASE = process.env.RECORDER_PASSPHRASE || ''

export async function POST(req: NextRequest) {
  const { passphrase } = await req.json()

  if (!RECORDER_PASSPHRASE) {
    return NextResponse.json({ error: 'Server passphrase not configured' }, { status: 401 })
  }
  if (!passphrase?.trim() || passphrase.trim() !== RECORDER_PASSPHRASE.trim()) {
    return NextResponse.json({ error: 'Invalid passphrase' }, { status: 401 })
  }

  return NextResponse.json({ ok: true })
}
