'use client'

import { useState } from 'react'
import { formatTime } from '@/lib/utils'
import { courseLength as getCourseLength } from '@/lib/eventCodes'
import { BADGE, PLACE_COLOR, NT_TIME_COLOR, ordinal } from '@/lib/displayConstants'
import { X, Search, ChevronDown, ChevronRight, Users } from 'lucide-react'

/** Determine swim status from result fields — mirrors MC getSwimStatus() */
function getSwimStatus(r: any): 'DQ' | 'NS' | number | null {
  const dq = r.result_dq?.trim()
  if (dq === 'Q') return 'DQ'
  if (dq === 'R') return 'NS'
  if (r.result_time) return r.result_time
  return null
}

function StatusBadge({ status }: { status: 'DQ' | 'NS' | 'EXH' }) {
  const cls = status === 'DQ' ? BADGE.DQ : status === 'NS' ? BADGE.NS : BADGE.EXH
  return <span className={cls}>{status}</span>
}

function TimeDelta({ seed, result, wasNt }: { seed: number | null, result: number | null, wasNt: boolean }) {
  if (wasNt || !seed || !result) return <span className="text-navy-400">{'\u2014'}</span>
  const delta = result - seed
  const sign = delta < 0 ? '-' : '+'
  const color = delta < 0 ? 'text-green-600' : delta > 0 ? 'text-red-500' : 'text-navy-400'
  return <span className={`font-mono ${color}`}>{sign}{formatTime(Math.abs(delta))}</span>
}

function SplitModal({ name, event, courseLen, splits, resultTime, onClose }: { name: string, event: string, courseLen: number, splits: any[], resultTime?: number | null, onClose: () => void }) {
  // Deduplicate splits by marker (HY3 files can produce duplicate G1 records)
  const seenMarkers = new Set<number>()
  const deduped = splits.filter(s => { if (seenMarkers.has(s.marker)) return false; seenMarkers.add(s.marker); return true })
  // Add finish time as final split if result_time exists and isn't already in splits
  const sorted = [...deduped].sort((a, b) => a.marker - b.marker)
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

interface AgeGroupBlock {
  ageGroup: string
  results: any[]
}

interface GenderBlock {
  gender: string
  ageGroups: AgeGroupBlock[]
}

interface ResultGrouping {
  isMixed: boolean
  genderBlocks: GenderBlock[]
  ageBlocks: AgeGroupBlock[]
}

function pubAgeGroupNum(ag: string | null | undefined): number {
  if (!ag) return 999
  const m = ag.match(/^(\d+)/)
  return m ? parseInt(m[1]) : 999
}

/** Build two-level grouping: for mixed events split by gender then age, for non-mixed just by age. */
function buildResultGrouping(results: any[], eventGender: string): ResultGrouping {
  const isMixed = eventGender === 'Mixed'

  if (isMixed) {
    const women: any[] = []
    const men: any[] = []
    for (const r of results) {
      if (r.isRelay) { men.push(r); continue }
      if (r.swimmer?.gender === 'F') women.push(r); else men.push(r)
    }
    const buildAgeBlocks = (list: any[]): AgeGroupBlock[] => {
      const map = new Map<string, any[]>()
      for (const r of list) {
        const ag = r.swimmer?.age_group || r.age || 'Open'
        if (!map.has(ag)) map.set(ag, [])
        map.get(ag)!.push(r)
      }
      return [...map.entries()]
        .sort(([a], [b]) => pubAgeGroupNum(a) - pubAgeGroupNum(b))
        .map(([ageGroup, results]) => ({ ageGroup, results }))
    }
    const genderBlocks: GenderBlock[] = []
    if (women.length > 0) genderBlocks.push({ gender: 'Women', ageGroups: buildAgeBlocks(women) })
    if (men.length > 0) genderBlocks.push({ gender: 'Men', ageGroups: buildAgeBlocks(men) })
    return { isMixed: true, genderBlocks, ageBlocks: [] }
  } else {
    const map = new Map<string, any[]>()
    for (const r of results) {
      const ag = r.swimmer?.age_group || r.age || 'Open'
      if (!map.has(ag)) map.set(ag, [])
      map.get(ag)!.push(r)
    }
    const ageBlocks = [...map.entries()]
      .sort(([a], [b]) => pubAgeGroupNum(a) - pubAgeGroupNum(b))
      .map(([ageGroup, results]) => ({ ageGroup, results }))
    return { isMixed: false, genderBlocks: [], ageBlocks }
  }
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

export function ResultsClient({ events, meetCourse, pointsVisible }: { events: [number, { name: string, eventGender: string, results: any[] }][], meetCourse: string, pointsVisible?: boolean }) {
  const courseLen = getCourseLength(meetCourse)
  const [filter, setFilter] = useState<'individual' | 'both' | 'relay'>('both')
  const [genderFilter, setGenderFilter] = useState<'all' | 'F' | 'M'>('all')
  const [search, setSearch] = useState('')
  const [showSplits, setShowSplits] = useState<{ name: string, event: string, splits: any[], resultTime?: number | null } | null>(null)
  const [collapsedEvents, setCollapsedEvents] = useState<Set<number>>(new Set())
  const [collapsedGenders, setCollapsedGenders] = useState<Set<string>>(new Set())
  const [expandedRelays, setExpandedRelays] = useState<Set<string>>(new Set())
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  const q = search.toLowerCase().trim()

  const filtered = events
    .filter(([, ev]) => {
      if (filter === 'both') return true
      const isRelay = ev.name.toLowerCase().includes('relay')
      return filter === 'relay' ? isRelay : !isRelay
    })
    .filter(([, ev]) => {
      if (genderFilter === 'all') return true
      if (ev.eventGender === 'Mixed') return true
      if (genderFilter === 'F') return ev.eventGender === 'Female' || ev.eventGender === 'F'
      if (genderFilter === 'M') return ev.eventGender === 'Male' || ev.eventGender === 'M'
      return true
    })
    .map(([eventNum, ev]): [number, { name: string, eventGender: string, results: any[] }] => {
      let results = ev.results
      if (genderFilter !== 'all' && ev.eventGender === 'Mixed') {
        results = results.filter((r: any) => {
          if (r.isRelay) return true
          return r.swimmer?.gender === genderFilter
        })
      }
      if (!q) return [eventNum, { ...ev, results }]
      const matchedResults = results.filter((r: any) => {
        const name = `${r.swimmer?.given_name || ''} ${r.swimmer?.surname || ''}`.toLowerCase()
        const club = `${r.swimmer?.club_code || ''} ${r.swimmer?.club_name || ''}`.toLowerCase()
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

  const toggleRow = (key: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }

  const expandAll = () => setCollapsedEvents(new Set())
  const collapseAll = () => setCollapsedEvents(new Set(filtered.map(([n]) => n)))

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden">
          {(['individual', 'both', 'relay'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-sm font-bold ${
                filter === f
                  ? 'bg-cyan-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {f === 'individual' ? 'Individual' : f === 'both' ? 'Both' : 'Relays'}
            </button>
          ))}
        </div>

        <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden">
          {([['all', 'Both'], ['F', 'Women'], ['M', 'Men']] as const).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setGenderFilter(value)}
              className={`px-3 py-1.5 text-sm font-bold ${
                genderFilter === value
                  ? 'bg-purple-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search name, club, or event"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-xs pl-10 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex gap-2 ml-auto">
          <button
            onClick={expandAll}
            className="px-3 py-1.5 text-sm rounded border border-gray-200 hover:bg-gray-50"
          >
            Expand All Events
          </button>
          <button
            onClick={collapseAll}
            className="px-3 py-1.5 text-sm rounded border border-gray-200 hover:bg-gray-50"
          >
            Collapse All Events
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {filtered.map(([eventNum, ev]) => {
          const grouping = buildResultGrouping(ev.results, ev.eventGender)
          const isCollapsed = collapsedEvents.has(eventNum)

          const renderResultRows = (results: any[]) => results.map((r: any) => {
            const hasSplits = r.splits && r.splits.length > 0
            const swimmerName = r.swimmer ? `${r.swimmer.given_name} ${r.swimmer.surname}`.trim() : '—'
            const status = getSwimStatus(r)
            const isDqNs = status === 'DQ' || status === 'NS'
            const isRelay = r.isRelay
            const hasLegs = isRelay && r.legs && r.legs.length > 0
            const relayKey = `${eventNum}-${r.id}`
            const isRelayExpanded = expandedRelays.has(relayKey)
            const isEXH = !!r.result_exh
            const rowKey = `${eventNum}-${r.id}`
            const isRowExpanded = expandedRows.has(rowKey)
            const placeNum = Number(r.result_place) || 0
            const rowTint = placeNum === 1 ? 'bg-yellow-50/30' : placeNum === 2 ? 'bg-gray-50/30' : placeNum === 3 ? 'bg-amber-50/20' : ''

            return (
              <tbody key={r.id}>
                <tr
                  className={`border-b border-navy-50 text-sm ${isDqNs ? 'opacity-60' : rowTint} ${hasLegs ? 'cursor-pointer hover:bg-navy-50/50' : !isRelay ? 'cursor-pointer hover:bg-navy-50/30' : ''}`}
                  onClick={hasLegs ? () => toggleRelay(relayKey) : !isRelay ? () => toggleRow(rowKey) : undefined}
                >
                  <td className="text-center px-2 py-2 font-bold">
                    {!isDqNs && !isEXH && r.result_place ? (
                      <span className={`${placeNum === 1 ? 'animate-shimmer-gold font-bold' : `${(PLACE_COLOR as any)[placeNum] ?? PLACE_COLOR.default} ${placeNum <= 3 ? 'font-bold' : 'font-normal'}`}`}>
                        {ordinal(placeNum)}
                      </span>
                    ) : ''}
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
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setShowSplits({ name: swimmerName, event: `Event ${eventNum} \u2014 ${ev.name}`, splits: r.splits, resultTime: r.result_time })
                          }}
                          className="text-blue-600 underline decoration-dotted cursor-pointer font-semibold hover:text-blue-800"
                        >
                          {formatTime(r.result_time)}
                        </button>
                        {isEXH && <span className={`${BADGE.EXH} ml-1.5`}>EXH</span>}
                      </>
                    ) : (
                      <>
                        <span className="font-semibold text-navy-900">{formatTime(r.result_time)}</span>
                        {isEXH && <span className={`${BADGE.EXH} ml-1.5`}>EXH</span>}
                      </>
                    )}
                  </td>
                  {pointsVisible && (
                    <td className="text-right px-2 py-2 font-mono text-xs text-navy-600">
                      {!isDqNs && !isRelay && r.result_points ? r.result_points : ''}
                    </td>
                  )}
                </tr>
                {isRowExpanded && !isRelay && (
                  <tr>
                    <td colSpan={pointsVisible ? 6 : 5} className="px-4 py-2 bg-navy-50/20 border-b border-navy-100">
                      <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 text-xs">
                        <div>
                          <span className="text-navy-400">Heat</span>
                          <div className="font-mono mt-0.5">{r.result_heat || '\u2014'}</div>
                        </div>
                        <div>
                          <span className="text-navy-400">Lane</span>
                          <div className="font-mono mt-0.5">{r.result_lane || '\u2014'}</div>
                        </div>
                        <div>
                          <span className="text-navy-400">Seed</span>
                          <div className="font-mono mt-0.5">
                            {r.was_nt
                              ? <span className={NT_TIME_COLOR}>NT</span>
                              : r.original_time ? formatTime(r.original_time) : '\u2014'
                            }
                          </div>
                        </div>
                        <div>
                          <span className="text-navy-400">Change</span>
                          <div className="mt-0.5">
                            <TimeDelta seed={r.original_time} result={r.result_time} wasNt={r.was_nt} />
                          </div>
                        </div>
                        <div>
                          <span className="text-navy-400">Age</span>
                          <div className="mt-0.5">{r.swimmer?.age_group || '\u2014'}</div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
                {isRelayExpanded && hasLegs && (
                  <tr>
                    <td colSpan={pointsVisible ? 6 : 5} className="p-0">
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
          })

          const renderAgeBlock = (block: AgeGroupBlock, key: string) => (
            <div key={key}>
              <div className="px-4 py-1.5 bg-blue-50 border-b border-blue-100 text-xs font-semibold text-blue-800">
                {block.ageGroup}
              </div>
              <table className="w-full">
                <thead>
                  <tr className="text-navy-500 text-xs bg-navy-50/50 border-b border-navy-100">
                    <th className="text-center px-2 py-1.5 w-12">Pos</th>
                    <th className="text-center px-2 py-1.5 w-10 hidden sm:table-cell">Ln</th>
                    <th className="text-left px-2 py-1.5">Name</th>
                    <th className="text-left px-2 py-1.5 w-16">Club</th>
                    <th className="text-right px-2 py-1.5 w-20">Time</th>
                    {pointsVisible && <th className="text-right px-2 py-1.5 w-12">Pts</th>}
                  </tr>
                </thead>
                {renderResultRows(block.results)}
              </table>
            </div>
          )

          return (
            <div key={eventNum} className="bg-white border border-navy-100 rounded-xl overflow-hidden">
              <button
                onClick={() => toggleEvent(eventNum)}
                className="w-full bg-navy-50 px-4 py-2.5 border-b border-navy-100 flex items-center justify-between hover:bg-navy-100 transition-colors cursor-pointer text-left"
              >
                <h3 className="font-bold text-navy-900">Event {eventNum} - {ev.name}</h3>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-navy-400">{ev.results.length} result{ev.results.length !== 1 ? 's' : ''}</span>
                  {isCollapsed ? <ChevronRight size={18} className="text-navy-400" /> : <ChevronDown size={18} className="text-navy-400" />}
                </div>
              </button>

              {!isCollapsed && (
                <>
                  {grouping.isMixed ? grouping.genderBlocks.map(gb => {
                    const genderKey = `${eventNum}:${gb.gender}`
                    const isGenderCollapsed = collapsedGenders.has(genderKey)
                    const entryCount = gb.ageGroups.reduce((sum, ag) => sum + ag.results.length, 0)
                    return (
                      <div key={gb.gender}>
                        <div
                          className="flex items-center gap-2 px-4 py-1.5 bg-purple-50 border-b border-purple-200 cursor-pointer hover:bg-purple-100"
                          onClick={() => setCollapsedGenders(prev => { const next = new Set(prev); if (next.has(genderKey)) next.delete(genderKey); else next.add(genderKey); return next; })}
                        >
                          {isGenderCollapsed ? <ChevronRight size={14} className="text-purple-600" /> : <ChevronDown size={14} className="text-purple-600" />}
                          <span className="text-xs font-bold text-purple-800 uppercase tracking-wide">{gb.gender}</span>
                          <span className="text-xs text-purple-500">{entryCount} results</span>
                        </div>
                        {!isGenderCollapsed && gb.ageGroups.map(ag => renderAgeBlock(ag, `${gb.gender}-${ag.ageGroup}`))}
                      </div>
                    )
                  }) : grouping.ageBlocks.map(ag => renderAgeBlock(ag, ag.ageGroup))}
                </>
              )}
            </div>
          )
        })}
      </div>

      {filtered.length > 0 && (
        <div className="flex justify-center gap-3 mt-4">
          <button
            onClick={expandAll}
            className="px-3 py-1.5 text-sm rounded border border-gray-200 hover:bg-gray-50"
          >
            Expand All Events
          </button>
          <button
            onClick={collapseAll}
            className="px-3 py-1.5 text-sm rounded border border-gray-200 hover:bg-gray-50"
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
