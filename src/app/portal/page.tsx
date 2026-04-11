'use client'

import { useEffect, useState } from 'react'
import { Waves, Mail, ArrowRight, CheckCircle, User, UserPlus, Smartphone, Search, Hand } from 'lucide-react'
import Link from 'next/link'

type Step = 'init' | 'lookup' | 'register' | 'choose_method' | 'verify' | 'authenticated'

export default function PortalPage() {
  const [step, setStep] = useState<Step>('init')
  const [memberId, setMemberId] = useState('')
  const [maskedEmail, setMaskedEmail] = useState('')
  const [maskedPhone, setMaskedPhone] = useState<string | null>(null)
  const [hasPhone, setHasPhone] = useState(false)
  const [sendMethod, setSendMethod] = useState<'email' | 'sms'>('email')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [swimmer, setSwimmer] = useState<any>(null)
  const [swimmerName, setSwimmerName] = useState('')
  const [sentVia, setSentVia] = useState<'email' | 'sms'>('email')

  // Inline member ID search
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<{ member_id: string; given_name: string; surname: string; club_name: string; age_group: string }[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchPerformed, setSearchPerformed] = useState(false)

  // Register form fields
  const [regEmail, setRegEmail] = useState('')
  const [regPhone, setRegPhone] = useState('')

  // Check for existing session on mount
  useEffect(() => {
    const token = localStorage.getItem('bsm_session')
    if (!token) {
      setStep('lookup')
      return
    }
    fetch(`/api/auth/verify?token=${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.valid) {
          setSwimmer(data.swimmer)
          setStep('authenticated')
        } else {
          setStep('lookup')
        }
      }).catch(() => setStep('lookup'))
  }, [])

  // Search swimmers by name
  const handleSearch = async () => {
    if (searchQuery.trim().length < 2) return
    setSearchLoading(true)
    setSearchPerformed(false)
    try {
      const res = await fetch(`/api/auth/find-member?name=${encodeURIComponent(searchQuery.trim())}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Search failed')
      setSearchResults(data.swimmers || [])
      setSearchPerformed(true)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSearchLoading(false)
    }
  }

  // Select a swimmer from search results — populate the member ID field
  const handleSelectSwimmer = (s: { member_id: string }) => {
    setMemberId(s.member_id)
    setSearchOpen(false)
    setSearchQuery('')
    setSearchResults([])
    setSearchPerformed(false)
  }

  // Lookup: check if member exists and has contact info (no code sent yet)
  const handleLookup = async (overrideMemberId?: string) => {
    const id = (overrideMemberId || memberId.trim()).toUpperCase()
    setError('')
    setLoading(true)
    try {
      const res = await fetch(`/api/auth/send-code?member_id=${encodeURIComponent(id)}`)
      const data = await res.json()

      if (!res.ok) {
        if (data.needs_register) {
          setSwimmerName(data.swimmer_name || '')
          setStep('register')
          return
        }
        throw new Error(data.error || 'Swimmer not found')
      }

      setSwimmerName(data.swimmer_name || '')
      setMaskedEmail(data.masked_email)
      setMaskedPhone(data.masked_phone || null)
      setHasPhone(data.has_phone || false)
      setStep('choose_method')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  // Send code with chosen method
  const handleSendWithMethod = async (method: 'email' | 'sms') => {
    setError('')
    setSendMethod(method)
    setLoading(true)
    try {
      const res = await fetch('/api/auth/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_id: memberId.trim().toUpperCase(), method }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to send code')
      setSentVia(data.method_used || method)
      setMaskedEmail(data.masked_email)
      setMaskedPhone(data.masked_phone || null)
      setStep('verify')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async () => {
    if (!regEmail.trim() || !regEmail.includes('@')) {
      setError('Please enter a valid email address')
      return
    }
    setError('')
    setLoading(true)
    try {
      // Step 1: Register details (save to DB only, no email sent)
      const regRes = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          member_id: memberId.trim().toUpperCase(),
          email: regEmail.trim(),
          phone: regPhone.trim(),
        }),
      })
      const regData = await regRes.json()
      if (!regRes.ok) throw new Error(regData.error || 'Registration failed')

      // Step 2: Now send verification code (reads email from DB)
      const codeRes = await fetch('/api/auth/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_id: memberId.trim().toUpperCase() }),
      })
      const codeData = await codeRes.json()
      if (!codeRes.ok) throw new Error(codeData.error || 'Failed to send code')
      setMaskedEmail(codeData.masked_email)
      setMaskedPhone(codeData.masked_phone || null)
      setHasPhone(codeData.has_phone || false)
      setSentVia(codeData.method_used || 'email')
      setStep('verify')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleVerify = async () => {
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_id: memberId.trim().toUpperCase(), code }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Invalid code')
      localStorage.setItem('bsm_session', data.token)
      setSwimmer(data.swimmer)
      setStep('authenticated')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  if (step === 'authenticated' && swimmer) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="bg-gradient-to-br from-bsm-600 to-bsm-600 rounded-2xl p-8 text-white text-center mb-8">
          <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-80" />
          <h1 className="font-display font-bold text-2xl mb-2">
            Welcome, {swimmer.given_name}!
          </h1>
          <p className="text-white/80">{swimmer.club_name} &bull; {swimmer.age_group}</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link href="/portal/my-events" className="bg-white border border-dark-100 rounded-xl p-6 hover:shadow-lg transition-shadow group">
            <User className="h-8 w-8 text-bsm-600 mb-3" />
            <h3 className="font-bold text-dark-900 group-hover:text-bsm-700">My Events</h3>
            <p className="text-sm text-dark-500">View your entries, heats, lanes, and results</p>
          </Link>
          <Link href="/portal/bio" className="bg-white border border-dark-100 rounded-xl p-6 hover:shadow-lg transition-shadow group">
            <Waves className="h-8 w-8 text-bsm-600 mb-3" />
            <h3 className="font-bold text-dark-900 group-hover:text-bsm-700">Swimmer Bio</h3>
            <p className="text-sm text-dark-500">Share your story for the announcer</p>
          </Link>
          <Link href="/portal/nominate" className="bg-white border border-dark-100 rounded-xl p-6 hover:shadow-lg transition-shadow group sm:col-span-2">
            <Hand className="h-8 w-8 text-bsm-600 mb-3" />
            <h3 className="font-bold text-dark-900 group-hover:text-bsm-700">Nominate for Events</h3>
            <p className="text-sm text-dark-500">Request a spot in events with available lanes</p>
          </Link>
        </div>
        <button
          onClick={() => { localStorage.removeItem('bsm_session'); setStep('lookup'); setSwimmer(null) }}
          className="mt-6 text-sm text-dark-400 hover:text-dark-600 mx-auto block"
        >
          Log out
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <div className="text-center mb-8">
        <Waves className="h-12 w-12 text-bsm-600 mx-auto mb-4" />
        <h1 className="font-display font-bold text-3xl text-dark-900 mb-2">Swimmer Portal</h1>
        <p className="text-dark-500">Enter your Member ID to access your events and bio</p>
      </div>

      <div className="bg-white border border-dark-100 rounded-2xl p-6 shadow-lg">
        {step === 'init' && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-bsm-600"></div>
          </div>
        )}

        {step === 'lookup' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-dark-700 mb-1">Member ID</label>
              <input
                type="text"
                value={memberId}
                onChange={(e) => setMemberId(e.target.value)}
                placeholder="e.g. 123456"
                className="w-full px-4 py-3 border border-dark-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-bsm-500"
                onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
              />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button
              onClick={() => handleLookup()}
              disabled={!memberId.trim() || loading}
              className="w-full bg-bsm-600 hover:bg-bsm-700 disabled:bg-dark-200 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {loading ? 'Looking up...' : <><span>Continue</span><ArrowRight className="h-4 w-4" /></>}
            </button>

            {/* Inline member ID search */}
            <div className="border-t border-dark-100 pt-3">
              <button
                onClick={() => { setSearchOpen(!searchOpen); setError('') }}
                className="w-full text-sm text-dark-400 hover:text-bsm-600 flex items-center justify-center gap-1 transition-colors"
              >
                <Search className="h-4 w-4" />
                {searchOpen ? 'Hide search' : "Don\u0027t know your Member ID?"}
              </button>

              {searchOpen && (
                <div className="mt-3 space-y-3">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search by first or last name"
                      className="flex-1 px-3 py-2 border border-dark-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-bsm-500"
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                      autoFocus
                    />
                    <button
                      onClick={handleSearch}
                      disabled={searchQuery.trim().length < 2 || searchLoading}
                      className="px-3 py-2 bg-bsm-600 hover:bg-bsm-700 disabled:bg-dark-200 text-white rounded-lg transition-colors"
                    >
                      {searchLoading ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : <Search className="h-4 w-4" />}
                    </button>
                  </div>

                  {searchResults.length > 0 && (
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      <p className="text-xs text-dark-400">{searchResults.length} result{searchResults.length !== 1 ? 's' : ''} &mdash; tap your name</p>
                      {searchResults.map((s) => (
                        <button
                          key={s.member_id}
                          onClick={() => handleSelectSwimmer(s)}
                          className="w-full text-left px-3 py-2 border border-dark-100 rounded-lg hover:border-bsm-300 hover:bg-bsm-50 transition-colors"
                        >
                          <div className="flex justify-between items-center">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-dark-900 truncate">{s.given_name} {s.surname}</p>
                              <p className="text-xs text-dark-400 truncate">{s.club_name}</p>
                            </div>
                            <span className="text-xs bg-bsm-50 text-bsm-700 px-2 py-0.5 rounded font-mono ml-2 shrink-0">{s.member_id}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {searchPerformed && searchResults.length === 0 && !searchLoading && (
                    <p className="text-xs text-dark-400 text-center py-2">No swimmers found matching &ldquo;{searchQuery}&rdquo;</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {step === 'register' && (
          <div className="space-y-4">
            <div className="bg-amber-50 rounded-xl p-4 text-sm text-amber-800">
              <UserPlus className="h-5 w-5 inline mr-2" />
              Hi <strong>{swimmerName}</strong>! We don&apos;t have your contact details yet. Please enter them below to continue.
            </div>
            <div>
              <label className="block text-sm font-semibold text-dark-700 mb-1">Email Address *</label>
              <input
                type="email"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full px-4 py-3 border border-dark-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-bsm-500"
                onKeyDown={(e) => e.key === 'Enter' && handleRegister()}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-dark-700 mb-1">Phone (optional, enables SMS verification)</label>
              <input
                type="tel"
                value={regPhone}
                onChange={(e) => setRegPhone(e.target.value)}
                placeholder="04xx xxx xxx"
                className="w-full px-4 py-3 border border-dark-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-bsm-500"
              />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button
              onClick={handleRegister}
              disabled={!regEmail.trim() || loading}
              className="w-full bg-bsm-600 hover:bg-bsm-700 disabled:bg-dark-200 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {loading ? 'Registering...' : <><span>Register & Send Code</span><ArrowRight className="h-4 w-4" /></>}
            </button>
            <button onClick={() => { setStep('lookup'); setError(''); setRegEmail(''); setRegPhone('') }} className="w-full text-sm text-dark-400 hover:text-dark-600">
              Back
            </button>
          </div>
        )}

        {step === 'choose_method' && (
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-sm text-dark-500 mb-1">Sending verification code to</p>
              <p className="font-semibold text-dark-900">{swimmerName}</p>
            </div>
            <button
              onClick={() => handleSendWithMethod('email')}
              disabled={loading}
              className="w-full bg-bsm-600 hover:bg-bsm-700 disabled:bg-dark-200 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {loading && sendMethod === 'email' ? 'Sending...' : <><Mail className="h-5 w-5" /><span>Send via Email ({maskedEmail})</span></>}
            </button>
            {hasPhone && (
              <button
                onClick={() => handleSendWithMethod('sms')}
                disabled={loading}
                className="w-full bg-bsm-600 hover:bg-bsm-700 disabled:bg-dark-200 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {loading && sendMethod === 'sms' ? 'Sending...' : <><Smartphone className="h-5 w-5" /><span>Send via SMS ({maskedPhone})</span></>}
              </button>
            )}
            <button onClick={() => { setStep('lookup'); setError('') }} className="w-full text-sm text-dark-400 hover:text-dark-600">
              Back
            </button>
          </div>
        )}

        {step === 'verify' && (
          <div className="space-y-4">
            <div className={`rounded-xl p-4 text-sm ${sentVia === 'sms' ? 'bg-green-50 text-green-800' : 'bg-bsm-50 text-bsm-800'}`}>
              {sentVia === 'sms' ? (
                <><Smartphone className="h-5 w-5 inline mr-2" />A verification code has been sent via SMS to <strong>{maskedPhone}</strong></>
              ) : (
                <><Mail className="h-5 w-5 inline mr-2" />A verification code has been sent to <strong>{maskedEmail}</strong></>
              )}
            </div>
            <div>
              <label className="block text-sm font-semibold text-dark-700 mb-1">Verification Code</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Enter 6-digit code"
                maxLength={6}
                className="w-full px-4 py-3 border border-dark-200 rounded-xl text-center text-2xl tracking-[0.5em] font-mono focus:outline-none focus:ring-2 focus:ring-bsm-500"
                onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
              />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button
              onClick={handleVerify}
              disabled={code.length < 6 || loading}
              className="w-full bg-bsm-600 hover:bg-bsm-700 disabled:bg-dark-200 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              {loading ? 'Verifying...' : 'Verify & Log In'}
            </button>

            {/* Resend options */}
            <div className="flex gap-2 pt-2 border-t border-dark-100">
              <button
                onClick={() => handleSendWithMethod('email')}
                disabled={loading}
                className="flex-1 text-sm text-dark-500 hover:text-bsm-600 py-2 flex items-center justify-center gap-1 transition-colors"
              >
                <Mail className="h-4 w-4" /> Resend via Email
              </button>
              {hasPhone && (
                <button
                  onClick={() => handleSendWithMethod('sms')}
                  disabled={loading}
                  className="flex-1 text-sm text-dark-500 hover:text-bsm-600 py-2 flex items-center justify-center gap-1 transition-colors"
                >
                  <Smartphone className="h-4 w-4" /> Resend via SMS
                </button>
              )}
            </div>

            <button onClick={() => { setStep('lookup'); setCode(''); setError('') }} className="w-full text-sm text-dark-400 hover:text-dark-600">
              Back
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
