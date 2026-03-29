'use client'

import { useState } from 'react'
import { formatTime } from '@/lib/utils'
import { courseLength as getCourseLength } from '@/lib/eventCodes'
import { Filter, X, Search, ChevronDown, ChevronRight, ChevronsUpDown, Users } from 'lucide-react'

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

/** Determine swim status from result fields — mirrors MC getSwimStatus() */
function getSwimStatus(r: any): 'DQ' | 'NS' | number | null {
  const dq = r.result_dq?.trim()
  if (dq === 'Q') return 'DQ'
  if (dq === 'R') return 'NS'
  if (r.result_time) return r.result_time
  return null
}

function StatusBadge({ status }: { status: 'DQ' | 'NS' }) {
  const styles = status === 'DQ'
    ? 'bg-red-100 text-red-700 border-red-200'
    : 'bg-gray-100 text-gray-600 border-gray-200'
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-semibold border ${styles}`}>
      {status}
    </span>
  )
}

function SplitModal({ name, event, courseLen, splits, resultTime, onClose }: { name: string, event: string, courseLen: number, splits: any[], resultTime?: number | null, onClose: () => void }) {
  // Add finish time as final split if result_time exists and isn't already in splits
  const sorted = [...splits].sort((a, b) => a.marker - b.marker)
  const lastMarker = sorted.length > 0 ? sorted[sorted.length - 1].marker : 0
  if (resultTime && resultTime > 0 && (sorted.length === 0 || sorted[sorted.length - 1].time !== resultTime)) {
    sorted.push({ marker: lastMarker + 1, time: resultTime, isFinish: true })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-navy-900">{name}</h3>
            <p className="text-sm text-navy-500">{event} — Split Times</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-navy-100 rounded">
            <X size={20} className="text-navy-500" />
          </button>
        </div>

        {sorted.length === 0 ? (
          <p className="text-navy-500 text-sm">No split data available</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-navy-200 text-navy-500 text-xs">
                <th className="text-left py-2 px-2">Distance</th>
                <th className="text-right py-2 px-2">Cumulative</th>
                <th className="text-right py-2 px-2">Split</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((sp, idx) => {
                const prevTime = idx > 0 ? sorted[idx - 1].time : null
                const splitTime = sp.time !== null && prevTime !== null ? sp.time - prevTime : null
                const hasIssue = sp.time === null || sp.time === 0
                const distance = sp.marker * courseLen

                return (
                  <tr key={sp.marker} className={`border-b border-navy-100 ${hasIssue ? 'bg-amber-50' : ''}`}>
                    <td className="py-1.5 px-2 font-mono">{distance}m</td>
                    <td className={`py-1.5 px-2 text-right font-mono ${hasIssue ? 'text-amber-600' : ''}`}>
                      {hasIssue ? '—' : formatTime(sp.time)}
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono text-navy-500">
                      {splitTime !== null && splitTime > 0 ? formatTime(splitTime) : idx === 0 && sp.time && !hasIssue ? formatTime(sp.time) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}

        {sorted.some(sp => sp.time === null || sp.time === 0) && (
          <p className="mt-3 text-xs text-amber-600">
            Some split times are missing — possible equipment malfunction.
          </p>
        )}
      </div>
    </div>
  )
}

interface ResultGroup {
  genderLabel?: string
  ageGroup: string
  results: any[]
}

/** Build display groups from pre-sorted results. Groups by gender (mixed only) then age group. */
function buildGroups(results: any[], eventGender: string): ResultGroup[] {
  const isMixed = eventGender === 'Mixed'
  const groups: ResultGroup[] = []
  let currentGender = ''
  let currentAge = ''

  for (const r of results) {
    const genderLabel = (isMixed && !r.isRelay) ? (r.swimmer?.gender === 'F' ? 'Women' : 'Men') : undefined
    const ageGroup = r.swimmer?.age_group || r.age || 'Open'
    const genderKey = genderLabel || ''

    if (genderKey !== currentGender || ageGroup !== currentAge) {
      groups.push({ genderLabel, ageGroup, results: [] })
      currentGender = genderKey
      currentAge = ageGroup
    }
    groups[groups.length - 1].results.push(r)
  }

  return groups
}

/** Calculate leg split time from cumulative splits */
function getLegTime(legs: any[], legIndex: number): number | null {
  const leg = legs[legIndex]
  if (!leg?.splits?.length) return null
  const legSplits = [...leg.splits].sort((a: any, b: any) => a.marker - b.marker)
  const lastSplit = legSplits[legSplits.length - 1]
  if (!lastSplit?.time) return null
  // For first leg, the leg time IS the cumulative time
  if (legIndex === 0) return lastSplit.time
  // For subsequent legs, we need the previous leg's last cumulative split
  const prevLeg = legs[legIndex - 1]
  if (!prevLeg?.splits?.length) return lastSplit.time
  const prevSplits = [...prevLeg.splits].sort((a: any, b: any) => a.marker - b.marker)
  const prevLastSplit = prevSplits[prevSplits.length - 1]
  if (!prevLastSplit?.time) return lastSplit.time
  return lastSplit.time - prevLastSplit.time
}

function RelayLegsExpansion({ legs, eventNum, eventName, onShowSplits }: {
  legs: any[], eventNum: number, eventName: string,
  onShowSplits: (name: string, event: string, splits: any[]) => void
}) {
  if (!legs || legs.length === 0) return null

  return (
    <div className="bg-navy-50/30 border-t border-navy-100">
      <table className="w-full">
        <thead>
          <tr className="text-navy-400 text-xs border-b border-navy-100">
            <th className="text-center px-2 py-1 w-12">Leg</th>
            <th className="text-left px-2 py-1">Swimmer</th>
            <th className="text-left px-2 py-1 w-16 hidden sm:table-cell">Age</th>
            <th className="text-right px-2 py-1 w-20">Leg Time</th>
          </tr>
        </thead>
        <tbody>
          {legs.map((leg: any, idx: number) => {
            const swimmerName = [leg.given_name, leg.surname].filter(Boolean).join(' ') || '—'
            const legTime = getLegTime(legs, idx)
            const hasSplits = leg.splits && leg.splits.length > 0

            return (
              <tr key={leg.id || idx} className="border-b border-navy-50 text-xs">
                <td className="text-center px-2 py-1.5 font-mono text-navy-400">{leg.leg_number || idx + 1}</td>
                <td className="px-2 py-1.5 text-navy-700">{swimmerName}</td>
                <td className="px-2 py-1.5 text-navy-400 hidden sm:table-cell">{leg.age_group || '—'}</td>
                <td className="text-right px-2 py-1.5 font-mono text-navy-700">
                  {hasSplits && legTime ? (
                    <button
                      onClick={() => onShowSplits(swimmerName, `Event ${eventNum} — ${eventName} (Leg ${leg.leg_number || idx + 1})`, leg.splits)}
                      className="text-blue-600 underline decoration-dotted cursor-pointer font-semibold hover:text-blue-800"
                    >
                      {formatTime(legTime)}
                    </button>
                  ) : legTime ? formatTime(legTime) : '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function ResultsClient({ events, meetCourse }: { events: [number, { name: string, eventGender: string, results: any[] }][], meetCourse: string }) {
  const courseLen = getCourseLength(meetCourse)
  const [filter, setFilter] = useState<'all' | 'individual' | 'relay'>('all')
  const [search, setSearch] = useState('')
  const [showSplits, setShowSplits] = useState<{ name: string, event: string, splits: any[], resultTime?: number | null } | null>(null)
  const [collapsedEvents, setCollapsedEvents] = useState<Set<number>>(new Set())
  const [expandedRelays, setExpandedRelays] = useState<Set<string>>(new Set())

  const q = search.toLowerCase().trim()

  const filtered = events
    .filter(([, ev]) => {
      if (filter === 'all') return true
      const isRelay = ev.name.toLowerCase().includes('relay')
      return filter === 'relay' ? isRelay : !isRelay
    })
    .map(([eventNum, ev]): [number, { name: string, eventGender: string, results: any[] }] => {
      if (!q) return [eventNum, ev]
      const matchedResults = ev.results.filter((r: any) => {
        const name = `${r.swimmer?.given_name || ''} ${r.swimmer?.surname || ''}`.toLowerCase()
        const club = `${r.swimmer?.club_code || ''} ${r.swimmer?.club_name || ''}`.toLowerCase()
        // Also search in relay leg swimmer names
        const legNames = (r.legs || []).map((l: any) => `${l.given_name || ''} ${l.surname || ''}`.toLowerCase()).join(' ')
        return name.includes(q) || club.includes(q) || ev.name.toLowerCase().includes(q) || legNames.includes(q)
      })
      return [eventNum, { ...ev, results: matchedResults }]
    })
    .filter(([, ev]) => ev.results.length > 0)

  const toggleEvent = (eventNum: number) => {
    setCollapsedEvents(prev => {
      const next = new Set(prev)
      if (next.has(eventNum)) next.delete(eventNum)
      else next.add(eventNum)
      return next
    })
  }

  const toggleRelay = (relayKey: string) => {
    setExpandedRelays(prev => {
      const next = new Set(prev)
      if (next.has(relayKey)) next.delete(relayKey)
      else next.add(relayKey)
      return next
    })
  }

  const expandAll = () => setCollapsedEvents(new Set())
  const collapseAll = () => setCollapsedEvents(new Set(filtered.map(([n]) => n)))

  return (
    <>
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-navy-400" />
          <input
            type="text"
            placeholder="Search by name, club, or event..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-8 py-2 rounded-lg border border-navy-200 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2">
              <X className="h-4 w-4 text-navy-400 hover:text-navy-600" />
            </button>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          {(['all', 'individual', 'relay'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === f
                  ? 'bg-cyan-600 text-white'
                  : 'bg-navy-100 text-navy-600 hover:bg-navy-200'
              }`}
            >
              <Filter className="h-3.5 w-3.5 inline mr-1.5" />
              {f === 'all' ? 'All Events' : f === 'individual' ? 'Individual' : 'Relays'}
            </button>
          ))}
          <div className="flex gap-1 ml-1">
            <button
              onClick={expandAll}
              className="px-3 py-2 rounded-lg text-sm font-medium bg-navy-100 text-navy-600 hover:bg-navy-200 transition-colors"
              title="Expand All"
            >
              <ChevronsUpDown className="h-3.5 w-3.5 inline mr-1" />
              Expand
            </button>
            <button
              onClick={collapseAll}
              className="px-3 py-2 rounded-lg text-sm font-medium bg-navy-100 text-navy-600 hover:bg-navy-200 transition-colors"
              title="Collapse All"
            >
              <ChevronRight className="h-3.5 w-3.5 inline mr-1" />
              Collapse
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {filtered.map(([eventNum, ev]) => {
          const groups = buildGroups(ev.results, ev.eventGender)
          const isCollapsed = collapsedEvents.has(eventNum)

          return (
            <div key={eventNum} className="bg-white border border-navy-100 rounded-xl overflow-hidden">
              <button
                onClick={() => toggleEvent(eventNum)}
                className="w-full bg-navy-50 px-4 py-2.5 border-b border-navy-100 flex items-center justify-between hover:bg-navy-100 transition-colors cursor-pointer text-left"
              >
                <h3 className="font-bold text-navy-900">Event {eventNum} — {ev.name}</h3>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-navy-400">{ev.results.length} result{ev.results.length !== 1 ? 's' : ''}</span>
                  {isCollapsed ? <ChevronRight size={18} className="text-navy-400" /> : <ChevronDown size={18} className="text-navy-400" />}
                </div>
              </button>

              {!isCollapsed && groups.map((group, gi) => {
                const showGenderHeader = group.genderLabel && (gi === 0 || groups[gi - 1]?.genderLabel !== group.genderLabel)

                return (
                  <div key={gi}>
                    {showGenderHeader && (
                      <div className="px-4 py-1.5 bg-purple-50 border-b border-purple-200 text-xs font-bold text-purple-800 uppercase tracking-wide">
                        {group.genderLabel}
                      </div>
                    )}
                    <div className="px-4 py-1.5 bg-blue-50 border-b border-blue-100 text-xs font-semibold text-blue-800">
                      {group.ageGroup}
                    </div>
                    <table className="w-full">
                      <thead>
                        <tr className="text-navy-500 text-xs bg-navy-50/50 border-b border-navy-100">
                          <th className="text-center px-2 py-1.5 w-12">Pos</th>
                          <th className="text-center px-2 py-1.5 w-10 hidden sm:table-cell">Ln</th>
                          <th className="text-left px-2 py-1.5">Name</th>
                          <th className="text-left px-2 py-1.5 w-16">Club</th>
                          <th className="text-right px-2 py-1.5 w-20">Time</th>
                        </tr>
                      </thead>
                      {group.results.map((r: any, i: number) => {
                        const hasSplits = r.splits && r.splits.length > 0
                        const isTop3 = r.result_place && r.result_place <= 3
                        const swimmerName = r.swimmer ? `${r.swimmer.given_name} ${r.swimmer.surname}`.trim() : '—'
                        const status = getSwimStatus(r)
                        const isDqNs = status === 'DQ' || status === 'NS'
                        const isRelay = r.isRelay
                        const hasLegs = isRelay && r.legs && r.legs.length > 0
                        const relayKey = `${eventNum}-${i}`
                        const isRelayExpanded = expandedRelays.has(relayKey)

                        return (
                          <tbody key={i}>
                            <tr
                              className={`border-b border-navy-50 text-sm ${isDqNs ? 'opacity-60' : isTop3 ? 'bg-cyan-50/30' : ''} ${hasLegs ? 'cursor-pointer hover:bg-navy-50/50' : ''}`}
                              onClick={hasLegs ? () => toggleRelay(relayKey) : undefined}
                            >
                              <td className="text-center px-2 py-2 font-bold text-navy-400">
                                {isDqNs ? (
                                  <StatusBadge status={status as 'DQ' | 'NS'} />
                                ) : r.result_place ? (
                                  <span className={isTop3 ? 'text-cyan-700' : ''}>{ordinal(r.result_place)}</span>
                                ) : '—'}
                              </td>
                              <td className="text-center px-2 py-2 font-mono text-xs text-navy-400 hidden sm:table-cell">
                                {r.result_lane || '—'}
                              </td>
                              <td className="px-2 py-2">
                                <span className={`font-medium ${isDqNs ? 'text-navy-500 line-through decoration-navy-300' : 'text-navy-800'}`}>
                                  {swimmerName}
                                </span>
                                {hasLegs && (
                                  <span className="ml-1.5 text-navy-400">
                                    {isRelayExpanded ? <ChevronDown size={14} className="inline" /> : <Users size={12} className="inline" />}
                                  </span>
                                )}
                                <span className="sm:hidden text-navy-400 text-xs ml-1.5">
                                  L{r.result_lane || '?'}
                                </span>
                              </td>
                              <td className="px-2 py-2 text-xs text-blue-600 font-semibold">
                                {r.swimmer?.club_code || ''}
                              </td>
                              <td className="text-right px-2 py-2 font-mono text-sm">
                                {isDqNs ? (
                                  <StatusBadge status={status as 'DQ' | 'NS'} />
                                ) : hasSplits ? (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setShowSplits({ name: swimmerName, event: `Event ${eventNum} — ${ev.name}`, splits: r.splits, resultTime: r.result_time })
                                    }}
                                    className="text-blue-600 underline decoration-dotted cursor-pointer font-semibold hover:text-blue-800"
                                  >
                                    {formatTime(r.result_time)}
                                  </button>
                                ) : (
                                  <span className="font-semibold text-navy-900">{formatTime(r.result_time)}</span>
                                )}
                              </td>
                            </tr>
                            {isRelayExpanded && hasLegs && (
                              <tr>
                                <td colSpan={5} className="p-0">
                                  <RelayLegsExpansion
                                    legs={r.legs} eventNum={eventNum} eventName={ev.name}
                                    onShowSplits={(name, event, splits) => {
                                      setShowSplits({ name, event, splits })
                                    }}
                                  />
                                </td>
                              </tr>
                            )}
                          </tbody>
                        )
                      })}
                    </table>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      {filtered.length > 0 && (
        <div className="flex justify-center gap-3 mt-4">
          <button
            onClick={expandAll}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-navy-100 text-navy-600 hover:bg-navy-200 transition-colors"
          >
            Expand All Events
          </button>
          <button
            onClick={collapseAll}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-navy-100 text-navy-600 hover:bg-navy-200 transition-colors"
          >
            Collapse All Events
          </button>
        </div>
      )}

      {showSplits && (
        <SplitModal
          name={showSplits.name}
          event={showSplits.event}
          courseLen={courseLen}
          splits={showSplits.splits}
          resultTime={showSplits.resultTime}
          onClose={() => setShowSplits(null)}
        />
      )}
    </>
  )
}
