'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, Check, X, AlertTriangle, Hand, Loader2, Info } from 'lucide-react'
import Link from 'next/link'
import { eventName } from '@/lib/eventCodes'

interface AvailableEvent {
  eventCode: string
  eventGender: string | null
  eventNumber: string | null
  entered: number
  available: number
}

interface SessionGroup {
  name: string
  dayNumber: number
  events: AvailableEvent[]
}

function groupEventsBySessions(events: AvailableEvent[], sessionPlan: any): SessionGroup[] {
  if (!sessionPlan?.firstSession) {
    const sorted = [...events].sort((a, b) => {
      const na = parseInt(a.eventNumber || '999')
      const nb = parseInt(b.eventNumber || '999')
      return na - nb
    })
    return [{ name: 'Available Events', dayNumber: 0, events: sorted }]
  }

  const markers = (sessionPlan.markers || [])
    .map((m: any) => ({ afterNum: parseInt(m.afterEventNumber), session: m.session }))
    .filter((m: any) => !isNaN(m.afterNum))
    .sort((a: any, b: any) => a.afterNum - b.afterNum)

  const getSessionIndex = (eventNumber: string | null): number => {
    if (!eventNumber) return 0
    const num = parseInt(eventNumber)
    if (isNaN(num)) return 0
    for (let i = markers.length - 1; i >= 0; i--) {
      if (num > markers[i].afterNum) return i + 1
    }
    return 0
  }

  const allSessions = [
    sessionPlan.firstSession,
    ...markers.map((m: any) => m.session),
  ]

  const groups: Map<number, AvailableEvent[]> = new Map()
  for (const evt of events) {
    const idx = getSessionIndex(evt.eventNumber)
    if (!groups.has(idx)) groups.set(idx, [])
    groups.get(idx)!.push(evt)
  }

  const result: SessionGroup[] = []
  for (const [idx, groupEvents] of groups) {
    const session = allSessions[idx] || allSessions[0]
    const sorted = groupEvents.sort((a, b) => {
      const na = parseInt(a.eventNumber || '999')
      const nb = parseInt(b.eventNumber || '999')
      return na - nb
    })
    result.push({
      name: session.name || `Session ${idx + 1}`,
      dayNumber: session.dayNumber || 1,
      events: sorted,
    })
  }

  return result.sort((a, b) => {
    const ai = allSessions.findIndex((s: any) => s.name === a.name)
    const bi = allSessions.findIndex((s: any) => s.name === b.name)
    return ai - bi
  })
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

function parseSeedTime(input: string): number | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  if (trimmed.includes(':')) {
    const parts = trimmed.split(':')
    if (parts.length !== 2) return null
    const mins = parseInt(parts[0], 10)
    const secs = parseFloat(parts[1])
    if (isNaN(mins) || isNaN(secs) || mins < 0 || secs < 0 || secs >= 60) return null
    return mins * 60 + secs
  }

  const val = parseFloat(trimmed)
  if (isNaN(val) || val < 0) return null
  return val
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
  const [success, setSuccess] = useState('')
  const [selectedEvents, setSelectedEvents] = useState<Map<string, { seedTime: string; notes: string }>>(new Map())
  const [maxIndividualEvents, setMaxIndividualEvents] = useState<number | null>(null)
  const [currentEventCount, setCurrentEventCount] = useState(0)
  const [remainingSlots, setRemainingSlots] = useState<number | null>(null)
  const [sessionPlan, setSessionPlan] = useState<any>(null)
  const [cancellingId, setCancellingId] = useState<string | null>(null)

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
        setMaxIndividualEvents(data.maxIndividualEvents ?? null)
        setCurrentEventCount(data.currentEventCount ?? 0)
        setRemainingSlots(data.remainingSlots ?? null)
        setSessionPlan(data.sessionPlan ?? null)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const toggleEvent = (key: string) => {
    setSelectedEvents(prev => {
      const next = new Map(prev)
      if (next.has(key)) {
        next.delete(key)
      } else if (remainingSlots === null || next.size < remainingSlots) {
        next.set(key, { seedTime: '', notes: '' })
      }
      return next
    })
  }

  const updateSeedTime = (key: string, value: string) => {
    setSelectedEvents(prev => {
      const next = new Map(prev)
      const item = next.get(key)
      if (item) next.set(key, { ...item, seedTime: value })
      return next
    })
  }

  const updateNotes = (key: string, value: string) => {
    setSelectedEvents(prev => {
      const next = new Map(prev)
      const item = next.get(key)
      if (item) next.set(key, { ...item, notes: value })
      return next
    })
  }

  const allSeedTimesValid = selectedEvents.size > 0 &&
    Array.from(selectedEvents.values()).every(sel => parseSeedTime(sel.seedTime) !== null)

  const handleNominate = async () => {
    if (selectedEvents.size === 0) return
    const token = localStorage.getItem('bsm_session')
    if (!token) return

    setSubmitting(true)
    setError('')
    setSuccess('')

    const noms = []
    for (const [key, { seedTime, notes }] of selectedEvents) {
      const evt = events.find(e => `${e.eventCode}|${e.eventGender || ''}` === key)
      if (!evt) continue

      const parsed = parseSeedTime(seedTime)
      if (parsed === null) {
        setError(`Valid seed time required for ${sexPrefix(evt.eventGender)}${eventName(evt.eventCode)} (format: mm:ss.hh or ss.hh)`)
        setSubmitting(false)
        return
      }

      noms.push({
        event_code: evt.eventCode,
        event_gender: evt.eventGender,
        seed_time: parsed,
        notes: notes.trim() || null,
      })
    }

    try {
      const res = await fetch('/api/swimmers/nominate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, nominations: noms }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      const count = data.items?.length || noms.length
      setSuccess(`${count} nomination${count === 1 ? '' : 's'} submitted! The meet director will review your request${count === 1 ? '' : 's'}.`)
      setNominations(prev => [...prev, ...(data.items || [])])

      const nominatedKeys = new Set(noms.map(n => `${n.event_code}|${n.event_gender || ''}`))
      setEvents(prev => prev.filter(e => !nominatedKeys.has(`${e.eventCode}|${e.eventGender || ''}`)))

      setCurrentEventCount(prev => prev + count)
      if (remainingSlots !== null) {
        setRemainingSlots(prev => prev !== null ? Math.max(0, prev - count) : null)
      }
      setSelectedEvents(new Map())
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancelNomination = async (nominationId: string) => {
    const token = localStorage.getItem('bsm_session')
    if (!token) return

    setCancellingId(nominationId)
    try {
      const res = await fetch('/api/swimmers/nominate', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, nomination_id: nominationId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      const cancelled = nominations.find(n => n.id === nominationId)
      setNominations(prev => prev.filter(n => n.id !== nominationId))

      if (cancelled && (cancelled.status === 'pending' || cancelled.status === 'approved')) {
        setCurrentEventCount(prev => Math.max(0, prev - 1))
        if (remainingSlots !== null) {
          setRemainingSlots(prev => prev !== null ? prev + 1 : null)
        }
      }

      setSuccess('Nomination cancelled.')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setCancellingId(null)
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
          Select events with available spots and provide your seed time for each. The meet director will review and approve nominations.
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
          {/* Event limit info */}
          {remainingSlots !== null && (
            <div className="mb-4 p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-sm flex items-center gap-2">
              <Info className="h-4 w-4 flex-shrink-0" />
              <span>
                {remainingSlots - selectedEvents.size <= 0
                  ? `Maximum ${maxIndividualEvents} individual events reached`
                  : <>You can nominate for <strong>{remainingSlots - selectedEvents.size}</strong> more event{remainingSlots - selectedEvents.size !== 1 ? 's' : ''} ({currentEventCount + selectedEvents.size} of {maxIndividualEvents} maximum)</>
                }
              </span>
            </div>
          )}

          {/* Available events grouped by session */}
          {events.length > 0 && (() => {
            const groups = groupEventsBySessions(events, sessionPlan)
            return (
              <div className="space-y-4 mb-6">
                {groups.map((group, gi) => (
                  <div key={gi} className="bg-white border border-gray-200 rounded-xl p-4">
                    <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                      {group.name}
                      {group.dayNumber > 0 && (
                        <span className="text-xs font-normal text-gray-400">Day {group.dayNumber}</span>
                      )}
                      <span className="text-xs font-normal text-gray-400">- {group.events.length} event{group.events.length !== 1 ? 's' : ''}</span>
                    </h2>
                    <div className="space-y-2">
                      {group.events.map(evt => {
                        const key = `${evt.eventCode}|${evt.eventGender || ''}`
                        const isSelected = selectedEvents.has(key)
                        const canSelect = isSelected || remainingSlots === null || selectedEvents.size < remainingSlots
                        const sel = selectedEvents.get(key)

                        return (
                          <div
                            key={key}
                            className={`rounded-lg border transition-colors ${
                              isSelected
                                ? 'border-bsm-400 bg-bsm-50 ring-1 ring-bsm-200'
                                : canSelect
                                  ? 'border-gray-200 hover:border-bsm-300'
                                  : 'border-gray-100 bg-gray-50 opacity-50'
                            }`}
                          >
                            <button
                              onClick={() => canSelect && toggleEvent(key)}
                              disabled={!canSelect}
                              className="w-full text-left px-4 py-3 flex items-center gap-3"
                            >
                              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                                isSelected ? 'bg-bsm-600 border-bsm-600 text-white' : 'border-gray-300'
                              }`}>
                                {isSelected && <Check className="h-3 w-3" />}
                              </div>
                              <div className="flex-1 flex justify-between items-center min-w-0">
                                <div className="min-w-0">
                                  <span className="font-medium text-gray-900">{sexPrefix(evt.eventGender)}{eventName(evt.eventCode)}</span>
                                </div>
                                <div className="text-right flex-shrink-0 ml-2">
                                  <span className="text-xs text-gray-500">{evt.entered} entered</span>
                                  <span className="ml-2 text-xs font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                                    {evt.available} {evt.available === 1 ? 'spot' : 'spots'}
                                  </span>
                                </div>
                              </div>
                            </button>

                            {/* Inline seed time + notes when selected */}
                            {isSelected && sel && (
                              <div className="px-4 pb-3 pt-1 border-t border-bsm-200 ml-8">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">
                                      Seed Time <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                      type="text"
                                      value={sel.seedTime}
                                      onChange={e => updateSeedTime(key, e.target.value)}
                                      placeholder="e.g. 1:23.45"
                                      className={`w-full px-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-bsm-300 ${
                                        sel.seedTime && !parseSeedTime(sel.seedTime)
                                          ? 'border-red-300 bg-red-50'
                                          : 'border-gray-300'
                                      }`}
                                      onClick={e => e.stopPropagation()}
                                    />
                                    {sel.seedTime && !parseSeedTime(sel.seedTime) && (
                                      <p className="text-xs text-red-500 mt-0.5">Format: mm:ss.hh or ss.hh</p>
                                    )}
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Notes (optional)</label>
                                    <input
                                      type="text"
                                      value={sel.notes}
                                      onChange={e => updateNotes(key, e.target.value)}
                                      placeholder="Any additional info"
                                      className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-bsm-300"
                                      onClick={e => e.stopPropagation()}
                                    />
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}

                {/* Submit button */}
                {selectedEvents.size > 0 && (
                  <div className="bg-white border border-gray-200 rounded-xl p-4">
                    <button
                      onClick={handleNominate}
                      disabled={submitting || !allSeedTimesValid}
                      className="w-full bg-bsm-600 hover:bg-bsm-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Hand className="h-4 w-4" />}
                      {submitting
                        ? 'Submitting...'
                        : `Submit ${selectedEvents.size} Nomination${selectedEvents.size === 1 ? '' : 's'}`
                      }
                    </button>
                    {!allSeedTimesValid && (
                      <p className="text-xs text-gray-500 text-center mt-1">Enter a valid seed time for each selected event</p>
                    )}
                  </div>
                )}
              </div>
            )
          })()}

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
                      {nom.status === 'pending' && (
                        <button
                          onClick={() => handleCancelNomination(nom.id)}
                          disabled={cancellingId === nom.id}
                          className="text-xs px-2 py-1 text-red-600 hover:bg-red-50 border border-red-200 rounded-lg disabled:opacity-50"
                        >
                          {cancellingId === nom.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Cancel'}
                        </button>
                      )}
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
