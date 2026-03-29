'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, Save, CheckCircle, Target, Trophy } from 'lucide-react'
import Link from 'next/link'
import { eventName } from '@/lib/eventCodes'
import { getSessionStart } from '@/lib/sessions'
import { formatSeedTime, formatTime } from '@/lib/utils'

export default function BioPage() {
  const [swimmer, setSwimmer] = useState<any>(null)
  const [bio, setBio] = useState('')
  const [goals, setGoals] = useState('')
  const [funFact, setFunFact] = useState('')
  const [yearsSwimming, setYearsSwimming] = useState('')
  const [consent, setConsent] = useState(false)
  const [eventGoals, setEventGoals] = useState<Record<string, string>>({})
  const [entries, setEntries] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('bsm_session')
    if (!token) { window.location.href = '/portal'; return }

    fetch(`/api/auth/verify?token=${token}`)
      .then(r => r.json())
      .then(async (data) => {
        if (!data.valid) { window.location.href = '/portal'; return }
        setSwimmer(data.swimmer)
        // Load existing bio
        const res = await fetch(`/api/swimmers/bio?member_id=${data.swimmer.member_id}`)
        const bioData = await res.json()
        if (bioData.bio) {
          setBio(bioData.bio.bio_text || '')
          setGoals(bioData.bio.goals || '')
          setFunFact(bioData.bio.fun_fact || '')
          setYearsSwimming(bioData.bio.years_swimming?.toString() || '')
          setConsent(bioData.bio.commentator_consent || false)
          setEventGoals(bioData.bio.event_goals || {})
        }
        // Load entries for per-event goals
        const entryRes = await fetch(`/api/swimmers/entries?member_id=${data.swimmer.member_id}`)
        const entryData = await entryRes.json()
        setEntries(entryData.entries || [])
        setLoading(false)
      }).catch(() => { window.location.href = '/portal' })
  }, [])

  const handleSave = async () => {
    setSaving(true)
    const token = localStorage.getItem('bsm_session')
    await fetch('/api/swimmers/bio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token, bio_text: bio, goals, fun_fact: funFact,
        years_swimming: yearsSwimming ? parseInt(yearsSwimming) : null,
        commentator_consent: consent, event_goals: eventGoals,
      }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-4 border-bsm-500 border-t-transparent rounded-full" /></div>

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Link href="/portal" className="inline-flex items-center gap-1 text-sm text-bsm-600 hover:text-bsm-700 mb-6">
        <ArrowLeft className="h-4 w-4" /> Back to Portal
      </Link>

      <h1 className="font-display font-bold text-3xl text-dark-900 mb-2">Swimmer Bio</h1>
      <p className="text-dark-500 mb-8">Share your story! This information may be read by the meet announcer during your events.</p>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-semibold text-dark-700 mb-1">About You</label>
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} placeholder="Tell us about yourself — swimming background, achievements, what you love about masters swimming..."
            className="w-full px-4 py-3 border border-dark-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-bsm-500" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-dark-700 mb-1">Goals for This Meet</label>
          <textarea value={goals} onChange={(e) => setGoals(e.target.value)} rows={2} placeholder="What are you hoping to achieve today? PB targets, just having fun..."
            className="w-full px-4 py-3 border border-dark-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-bsm-500" />
        </div>
        {entries.length > 0 && (
          <div>
            <label className="block text-sm font-semibold text-dark-700 mb-2">
              <Target className="h-4 w-4 inline mr-1" />
              Event Goals <span className="font-normal text-dark-400">(optional)</span>
            </label>
            <p className="text-xs text-dark-400 mb-3">Set a personal goal for each event — PB target, time to beat, or just &quot;have fun&quot;!</p>
            <div className="space-y-2">
              {entries.map((e: any) => (
                <div key={e.event_number} className="bg-gray-50 rounded-lg p-3 space-y-2">
                  <div>
                    <div className="text-sm font-medium text-dark-700">{e.event_number}. {eventName(e.event_code)}</div>
                    {getSessionStart(e.event_number) && <div className="text-xs text-dark-400">{getSessionStart(e.event_number)}</div>}
                  </div>
                  {e.result_time && Number(e.result_time) > 0 ? (
                    <div className="text-xs font-medium flex flex-wrap items-center gap-2">
                      <span className="text-bsm-700">
                        <Trophy className="h-3 w-3 inline mr-1" />
                        {formatTime(e.result_time)}
                        {e.result_place ? ` (${e.result_place}${Number(e.result_place) === 1 ? 'st' : Number(e.result_place) === 2 ? 'nd' : Number(e.result_place) === 3 ? 'rd' : 'th'})` : ''}
                      </span>
                      {e.original_time && Number(e.original_time) > 0 && (() => {
                        const diff = Number(e.result_time) - Number(e.original_time)
                        const absDiff = Math.abs(diff)
                        const isImproved = diff < -0.005
                        const isSlower = diff > 0.005
                        return (
                          <span className={`font-mono ${isImproved ? 'text-green-600' : isSlower ? 'text-red-500' : 'text-dark-400'}`}>
                            {isImproved ? '−' : isSlower ? '+' : ''}{formatTime(absDiff)}
                          </span>
                        )
                      })()}
                    </div>
                  ) : e.original_time ? (
                    <div className="text-xs text-dark-400 font-mono">
                      Seed: {formatSeedTime(e.original_time)}
                    </div>
                  ) : null}
                  <input
                    type="text"
                    value={eventGoals[e.event_number] || ''}
                    onChange={(ev) => setEventGoals(prev => ({ ...prev, [e.event_number]: ev.target.value }))}
                    placeholder="e.g. Sub 35s, beat my PB..."
                    className="w-full px-3 py-2 border border-dark-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-bsm-500"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-dark-700 mb-1">Fun Fact</label>
            <input type="text" value={funFact} onChange={(e) => setFunFact(e.target.value)} placeholder="Something interesting about you"
              className="w-full px-4 py-3 border border-dark-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-bsm-500" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-dark-700 mb-1">Years Swimming Masters</label>
            <input type="number" value={yearsSwimming} onChange={(e) => setYearsSwimming(e.target.value)} placeholder="e.g. 5"
              className="w-full px-4 py-3 border border-dark-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-bsm-500" />
          </div>
        </div>

        <div className="bg-bsm-50 border border-bsm-200 rounded-xl p-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-dark-300 text-bsm-600 focus:ring-bsm-500" />
            <div>
              <p className="font-semibold text-dark-800 text-sm">Announcer Consent</p>
              <p className="text-xs text-dark-500">I consent to this information being read aloud by the meet announcer during my events. I understand this is optional and I can update or remove my bio at any time.</p>
            </div>
          </label>
        </div>

        <button onClick={handleSave} disabled={saving}
          className="w-full bg-bsm-600 hover:bg-bsm-700 disabled:bg-dark-200 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2">
          {saved ? <><CheckCircle className="h-5 w-5" /> Saved!</> : saving ? 'Saving...' : <><Save className="h-5 w-5" /> Save Bio</>}
        </button>
      </div>
    </div>
  )
}
