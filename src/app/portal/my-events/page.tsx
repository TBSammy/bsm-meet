'use client'

import { useEffect, useState, useCallback } from 'react'
import { ArrowLeft, AlertTriangle, Hand, Clock, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { formatSeedTime } from '@/lib/utils'
import { eventName } from '@/lib/eventCodes'

interface CampaignSettings {
  self_scratch_enabled: boolean
  self_scratch_cutoff_min: number
  check_in_enabled: boolean
  check_in_cutoff_min: number
}

export default function MyEventsPage() {
  const [swimmer, setSwimmer] = useState<any>(null)
  const [entries, setEntries] = useState<any[]>([])
  const [nominations, setNominations] = useState<any[]>([])
  const [settings, setSettings] = useState<CampaignSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState<string | null>(null)
  const [scratchConfirm, setScratchConfirm] = useState<{ entry: any; action: 'scratch' | 'unscratch' } | null>(null)
  const [scratchReason, setScratchReason] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [cancellingId, setCancellingId] = useState<string | null>(null)

  const loadEntries = useCallback(async (memberId: string) => {
    const res = await fetch(`/api/swimmers/entries?member_id=${memberId}`)
    const data = await res.json()
    setEntries(data.entries || [])
    setNominations(data.nominations || [])
    if (data.settings) setSettings(data.settings)
  }, [])

  useEffect(() => {
    const tok = localStorage.getItem('bsm_session')
    if (!tok) { window.location.href = '/portal'; return }
    setToken(tok)

    fetch(`/api/auth/verify?token=${tok}`)
      .then(r => r.json())
      .then(async (data) => {
        if (!data.valid) { window.location.href = '/portal'; return }
        setSwimmer(data.swimmer)
        await loadEntries(data.swimmer.member_id)
        setLoading(false)
      }).catch(() => { window.location.href = '/portal' })
  }, [loadEntries])

  const handleScratchAction = async () => {
    if (!scratchConfirm || !token) return
    const { entry, action } = scratchConfirm
    setActionLoading(entry.id)
    try {
      const res = await fetch('/api/swimmers/entries/scratch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          entry_id: entry.id,
          action,
          reason: action === 'scratch' ? (scratchReason || undefined) : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || 'Something went wrong')
      } else {
        await loadEntries(swimmer.member_id)
      }
    } catch {
      alert('Network error — please try again')
    } finally {
      setActionLoading(null)
      setScratchConfirm(null)
      setScratchReason('')
    }
  }

  const handleCancelNomination = async (nominationId: string) => {
    if (!token) return
    setCancellingId(nominationId)
    try {
      const res = await fetch('/api/swimmers/nominate', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, nomination_id: nominationId }),
      })
      const data = await res.json()
      if (!res.ok) { alert(data.error || 'Failed to cancel'); return }
      setNominations(prev => prev.filter(n => n.id !== nominationId))
    } catch {
      alert('Network error - please try again')
    } finally {
      setCancellingId(null)
    }
  }

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-4 border-bsm-500 border-t-transparent rounded-full" /></div>

  const activeEntries = entries.filter(e => !e.scratched)
  const scratchedEntries = entries.filter(e => e.scratched)

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Link href="/portal" className="inline-flex items-center gap-1 text-sm text-bsm-600 hover:text-bsm-700 mb-6">
        <ArrowLeft className="h-4 w-4" /> Back to Portal
      </Link>

      <div className="bg-gradient-to-r from-bsm-600 to-bsm-600 rounded-xl p-6 text-white mb-8">
        <h1 className="font-display font-bold text-2xl">{swimmer?.given_name} {swimmer?.surname}</h1>
        <p className="text-white/80">
          {swimmer?.club_name} &bull; {swimmer?.age_group} &bull; {activeEntries.length} event{activeEntries.length !== 1 ? 's' : ''}
          {scratchedEntries.length > 0 && <span className="ml-2 text-white/60">({scratchedEntries.length} scratched)</span>}
        </p>
      </div>

      {settings?.self_scratch_enabled && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-6 text-sm text-amber-800">
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Self-scratch is available</p>
            <p className="text-amber-700">You can scratch yourself from events up to {settings.self_scratch_cutoff_min} minutes before your event starts. Scratches can be reversed before the cutoff.</p>
          </div>
        </div>
      )}

      {/* Active entries */}
      <div className="space-y-3">
        {activeEntries.map((e: any) => (
          <div key={e.id} className="bg-white border border-dark-100 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-dark-900">{e.event_number}. {eventName(e.event_code)}</p>
                <p className="text-sm text-dark-500">
                  {e.est_start && (
                    <span className="text-dark-400">
                      Est. {e.est_start}
                      {e.delta_minutes !== 0 && (
                        <span className={`ml-1 text-xs font-semibold ${e.delta_minutes > 0 ? 'text-red-500' : 'text-green-600'}`}>
                          ({e.delta_minutes > 0 ? '+' : ''}{e.delta_minutes} min)
                        </span>
                      )}
                      {' '}&bull;{' '}
                    </span>
                  )}
                  Heat {e.result_heat} &bull; Lane {e.result_lane} &bull; Seed: {formatSeedTime(e.original_time)}
                </p>
              </div>
              <div className="flex items-center gap-3 ml-3 shrink-0">
                {e.result_time ? (
                  <div className="text-right">
                    <p className="font-mono font-bold text-bsm-700">{formatSeedTime(e.result_time)}</p>
                    {e.result_place && <p className="text-xs text-dark-400">Place: {e.result_place}</p>}
                    {e.original_time && !e.was_nt && (() => {
                      const delta = e.result_time - e.original_time
                      const sign = delta < 0 ? '-' : '+'
                      const color = delta < 0 ? 'text-green-600' : delta > 0 ? 'text-red-500' : 'text-dark-400'
                      return <p className={`text-xs font-mono ${color}`}>{sign}{formatSeedTime(Math.abs(delta))}</p>
                    })()}
                  </div>
                ) : e.result_dq === 'Q' ? (
                  <div className="text-right">
                    <span className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded-full font-bold">DQ</span>
                  </div>
                ) : e.result_dq === 'R' ? (
                  <div className="text-right">
                    <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-full font-bold">NS</span>
                  </div>
                ) : (
                  <>
                    <span className="text-xs bg-dark-100 text-dark-500 px-3 py-1 rounded-full">Pending</span>
                    {settings?.self_scratch_enabled && (
                      <button
                        onClick={() => setScratchConfirm({ entry: e, action: 'scratch' })}
                        disabled={!!actionLoading}
                        className="text-xs px-3 py-1.5 bg-orange-50 text-orange-700 border border-orange-200 rounded-lg hover:bg-orange-100 disabled:opacity-50"
                      >
                        Scratch
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
            {e.checked_in && (
              <div className="mt-2 flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 bg-green-500 rounded-full" />
                <span className="text-xs text-green-700 font-medium">Checked in</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Nominated events */}
      {nominations.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
            <Hand className="h-4 w-4" /> Nominated Events
          </h2>
          <div className="space-y-3">
            {nominations.map((nom: any) => (
              <div key={nom.id} className="bg-white border border-bsm-200 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-dark-900">{eventName(nom.event_code)}</p>
                    <p className="text-sm text-dark-500">
                      Seed: {nom.seed_time ? formatSeedTime(nom.seed_time) : '-'}
                      {nom.notes && <span className="ml-2 text-gray-400">- {nom.notes}</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-3 shrink-0">
                    {nom.status === 'pending' && (
                      <span className="flex items-center gap-1 text-xs px-2.5 py-1 bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-full">
                        <Clock className="h-3 w-3" /> Pending Review
                      </span>
                    )}
                    {nom.status === 'approved' && (
                      <span className="text-xs px-2.5 py-1 bg-green-50 text-green-700 border border-green-200 rounded-full">Approved</span>
                    )}
                    {nom.status === 'declined' && (
                      <span className="text-xs px-2.5 py-1 bg-red-50 text-red-700 border border-red-200 rounded-full">Declined</span>
                    )}
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
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scratched entries */}
      {scratchedEntries.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Scratched Events</h2>
          <div className="space-y-3">
            {scratchedEntries.map((e: any) => (
              <div key={e.id} className="bg-gray-50 border border-gray-200 rounded-xl p-4 opacity-60">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-500 line-through">
                      {e.event_number}. {eventName(e.event_code)}
                      <span className="ml-2 text-xs px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded no-underline inline-block no-line-through">SCR</span>
                    </p>
                    <p className="text-sm text-gray-400">
                      Heat {e.result_heat} &bull; Lane {e.result_lane} &bull; Seed: {formatSeedTime(e.original_time)}
                    </p>
                    {e.scratch_reason && (
                      <p className="text-xs text-gray-400 mt-1">Reason: {e.scratch_reason}</p>
                    )}
                    {e.scratched_by && (
                      <p className="text-xs text-gray-400">
                        By: {e.scratched_by.startsWith('admin:') ? 'Meet Admin' : 'You'}
                      </p>
                    )}
                  </div>
                  {settings?.self_scratch_enabled && !e.result_time && (
                    <button
                      onClick={() => setScratchConfirm({ entry: e, action: 'unscratch' })}
                      disabled={!!actionLoading}
                      className="text-xs px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 disabled:opacity-50 shrink-0 ml-3"
                    >
                      Unscratch
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scratch confirmation modal */}
      {scratchConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-dark-900 mb-3">
              {scratchConfirm.action === 'scratch' ? 'Scratch from Event?' : 'Unscratch Event?'}
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              {scratchConfirm.action === 'scratch' ? (
                <>Are you sure you want to scratch from <strong>{eventName(scratchConfirm.entry.event_code)}</strong>? You can reverse this before the cutoff.</>
              ) : (
                <>Re-enter <strong>{eventName(scratchConfirm.entry.event_code)}</strong>? Your original heat and lane assignment will be restored.</>
              )}
            </p>
            {scratchConfirm.action === 'scratch' && (
              <div className="mb-4">
                <label className="text-xs text-gray-500 mb-1 block">Reason (optional)</label>
                <input
                  type="text"
                  value={scratchReason}
                  onChange={(e) => setScratchReason(e.target.value)}
                  placeholder="e.g. injury, schedule conflict"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-bsm-500 focus:border-bsm-500"
                />
              </div>
            )}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setScratchConfirm(null); setScratchReason('') }}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleScratchAction}
                disabled={!!actionLoading}
                className={`px-4 py-2 text-sm text-white rounded-lg disabled:opacity-50 ${
                  scratchConfirm.action === 'scratch'
                    ? 'bg-orange-600 hover:bg-orange-700'
                    : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {actionLoading ? 'Processing...' : scratchConfirm.action === 'scratch' ? 'Confirm Scratch' : 'Confirm Unscratch'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
