'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, Clock, Check, X, AlertTriangle, Hand, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { eventName } from '@/lib/eventCodes'

interface AvailableEvent {
  eventCode: string
  eventGender: string | null
  entered: number
  available: number
}

interface Nomination {
  id: string
  event_code: string
  event_gender: string | null
  seed_time: number | null
  status: 'pending' | 'approved' | 'declined' | 'closed'
  created_at: string
}

function sexPrefix(gender: string | null | undefined): string {
  if (!gender) return ''
  const g = gender.toLowerCase()
  if (g === 'male' || g === 'm') return 'Mens '
  if (g === 'female' || g === 'f') return 'Womens '
  if (g === 'mixed' || g === 'x') return 'Mixed '
  return ''
}

function formatTime(seconds: number | null): string {
  if (seconds === null || seconds === undefined || seconds <= 0) return 'NT'
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  const secsStr = secs.toFixed(2).padStart(5, '0')
  return mins > 0 ? `${mins}:${secsStr}` : secsStr
}

function statusBadge(status: string) {
  switch (status) {
    case 'pending':
      return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">Pending</span>
    case 'approved':
      return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Approved</span>
    case 'declined':
      return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Declined</span>
    case 'closed':
      return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">Closed</span>
    default:
      return null
  }
}

export default function NominatePage() {
  const [loading, setLoading] = useState(true)
  const [enabled, setEnabled] = useState(false)
  const [events, setEvents] = useState<AvailableEvent[]>([])
  const [nominations, setNominations] = useState<Nomination[]>([])
  const [swimmer, setSwimmer] = useState<any>(null)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null)
  const [seedTimeInput, setSeedTimeInput] = useState('')
  const [notesInput, setNotesInput] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    const token = localStorage.getItem('bsm_session')
    if (!token) {
      window.location.href = '/portal'
      return
    }

    fetch(`/api/swimmers/nominate?token=${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setError(data.error); return }
        setEnabled(data.enabled)
        setEvents(data.events || [])
        setNominations(data.myNominations || [])
        setSwimmer(data.swimmer)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const handleNominate = async () => {
    if (!selectedEvent) return
    const token = localStorage.getItem('bsm_session')
    if (!token) return

    setSubmitting(true)
    setError('')
    setSuccess('')

    const evt = events.find(e => `${e.eventCode}|${e.eventGender || ''}` === selectedEvent)
    if (!evt) return

    // Parse seed time (mm:ss.hh or ss.hh)
    let seedTime: number | null = null
    if (seedTimeInput.trim() && seedTimeInput.trim().toUpperCase() !== 'NT') {
      const parts = seedTimeInput.trim().match(/^(?:(\d+):)?(\d+)\.(\d{1,2})$/)
      if (parts) {
        const mins = parts[1] ? parseInt(parts[1]) : 0
        const secs = parseInt(parts[2])
        const hundredths = parts[3].padEnd(2, '0')
        seedTime = mins * 60 + secs + parseInt(hundredths) / 100
      }
    }

    try {
      const res = await fetch('/api/swimmers/nominate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          event_code: evt.eventCode,
          event_gender: evt.eventGender,
          seed_time: seedTime,
          notes: notesInput.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setSuccess('Nomination submitted! The meet director will review your request.')
      setNominations(prev => [...prev, data.item])
      setEvents(prev => prev.filter(e => `${e.eventCode}|${e.eventGender || ''}` !== selectedEvent))
      setSelectedEvent(null)
      setSeedTimeInput('')
      setNotesInput('')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-bsm-600 mx-auto" />
        <p className="text-sm text-gray-500 mt-3">Loading available events...</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Link href="/portal" className="inline-flex items-center gap-1 text-sm text-bsm-600 hover:text-bsm-700 mb-6">
        <ArrowLeft className="h-4 w-4" />
        Back to Portal
      </Link>

      <div className="mb-6">
        <h1 className="font-display font-bold text-2xl text-gray-900 flex items-center gap-2">
          <Hand className="h-6 w-6 text-bsm-600" />
          Nominate for Events
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Select an event with available spots to submit a nomination. The meet director will review and approve nominations.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          {error}
          <button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-600"><X className="h-4 w-4" /></button>
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm flex items-center gap-2">
          <Check className="h-4 w-4 flex-shrink-0" />
          {success}
          <button onClick={() => setSuccess('')} className="ml-auto text-green-400 hover:text-green-600"><X className="h-4 w-4" /></button>
        </div>
      )}

      {!enabled ? (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center">
          <AlertTriangle className="h-8 w-8 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600 font-medium">Nominations are not currently open</p>
          <p className="text-sm text-gray-400 mt-1">Check back later or contact the meet director.</p>
        </div>
      ) : (
        <>
          {/* Available events */}
          {events.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Available Events ({events.length})</h2>
              <div className="space-y-2">
                {events.map(evt => {
                  const key = `${evt.eventCode}|${evt.eventGender || ''}`
                  const isSelected = selectedEvent === key
                  return (
                    <button
                      key={key}
                      onClick={() => { setSelectedEvent(isSelected ? null : key); setError('') }}
                      className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                        isSelected
                          ? 'border-bsm-400 bg-bsm-50 ring-1 ring-bsm-200'
                          : 'border-gray-200 hover:border-bsm-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="font-medium text-gray-900">{sexPrefix(evt.eventGender)}{eventName(evt.eventCode)}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs text-gray-500">{evt.entered} entered</span>
                          <span className="ml-2 text-xs font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                            {evt.available} {evt.available === 1 ? 'spot' : 'spots'}
                          </span>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* Nomination form */}
              {selectedEvent && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Seed Time (optional)</label>
                      <input
                        type="text"
                        value={seedTimeInput}
                        onChange={e => setSeedTimeInput(e.target.value)}
                        placeholder="e.g. 1:23.45 or NT"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-bsm-300"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Notes (optional)</label>
                      <input
                        type="text"
                        value={notesInput}
                        onChange={e => setNotesInput(e.target.value)}
                        placeholder="Any additional info"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-bsm-300"
                      />
                    </div>
                  </div>
                  <button
                    onClick={handleNominate}
                    disabled={submitting}
                    className="w-full bg-bsm-600 hover:bg-bsm-700 disabled:bg-gray-200 text-white font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Hand className="h-4 w-4" />}
                    {submitting ? 'Submitting...' : 'Submit Nomination'}
                  </button>
                </div>
              )}
            </div>
          )}

          {events.length === 0 && nominations.length === 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center">
              <Check className="h-8 w-8 text-green-500 mx-auto mb-3" />
              <p className="text-gray-600 font-medium">No events with available spots</p>
              <p className="text-sm text-gray-400 mt-1">All heats are currently full.</p>
            </div>
          )}

          {/* My nominations */}
          {nominations.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">My Nominations ({nominations.length})</h2>
              <div className="space-y-2">
                {nominations.map(nom => (
                  <div key={nom.id} className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-lg">
                    <div>
                      <span className="font-medium text-gray-900">
                        {sexPrefix(nom.event_gender)}{eventName(nom.event_code)}
                      </span>
                      {nom.seed_time && (
                        <span className="text-xs text-gray-500 ml-2 font-mono">{formatTime(nom.seed_time)}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {statusBadge(nom.status)}
                      <span className="text-xs text-gray-400">
                        {new Date(nom.created_at).toLocaleDateString('en-AU', { day: '2-digit', month: 'short' })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
