'use client'

import { Fragment, useState } from 'react'
import { Search, X, ChevronDown, ChevronRight } from 'lucide-react'
import { formatSeedTime } from '@/lib/utils'
import { eventName, relayEventName } from '@/lib/eventCodes'
import { NT_TIME_COLOR } from '@/lib/displayConstants'

const MEDLEY_LEG_STROKES = ['Backstroke', 'Breaststroke', 'Butterfly', 'Freestyle']

function deriveRelayLegStroke(eventStroke: string | undefined, legNumber: number): string {
  if (!eventStroke) return ''
  if (eventStroke === 'Medley') return MEDLEY_LEG_STROKES[(legNumber - 1) % 4] || ''
  return eventStroke
}

function relayEventStroke(eventCode: string): string {
  const letter = eventCode.toUpperCase().trim().slice(-1)
  if (letter === 'E') return 'Medley'
  return 'Freestyle'
}

export function EntryListClient({ clubs, showHeatLane = false, relays = [] }: {
  clubs: any[];
  showHeatLane?: boolean;
  relays?: any[];
}) {
  const [search, setSearch] = useState('')
  const [expandedClubs, setExpandedClubs] = useState<Set<string>>(new Set())
  const [expandedRelays, setExpandedRelays] = useState<Set<string>>(new Set())
  const [eventFilter, setEventFilter] = useState<'individual' | 'both' | 'relay'>('both')

  const filtered = search
    ? clubs.map(c => ({
        ...c,
        swimmers: c.swimmers.filter((s: any) =>
          `${s.given_name} ${s.surname} ${s.club_name}`.toLowerCase().includes(search.toLowerCase())
        ),
      })).filter(c => c.swimmers.length > 0)
    : clubs

  const toggleClub = (club: string) => {
    const next = new Set(expandedClubs)
    next.has(club) ? next.delete(club) : next.add(club)
    setExpandedClubs(next)
  }

  const expandAll = () => setExpandedClubs(new Set(clubs.map((c: any) => c.club)))
  const collapseAll = () => setExpandedClubs(new Set())

  const toggleRelayExpand = (id: string) => {
    setExpandedRelays(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Group relays by event code, sorted by heat then lane within each event
  const relaysByEvent = new Map<string, any[]>()
  for (const r of relays) {
    const arr = relaysByEvent.get(r.event_code) || []
    arr.push(r)
    relaysByEvent.set(r.event_code, arr)
  }
  for (const teams of relaysByEvent.values()) {
    teams.sort((a: any, b: any) => {
      const heatA = parseInt(a.heat || '0') || 0
      const heatB = parseInt(b.heat || '0') || 0
      if (heatA !== heatB) return heatA - heatB
      const laneA = parseInt(a.lane || '0') || 0
      const laneB = parseInt(b.lane || '0') || 0
      return laneA - laneB
    })
  }

  return (
    <>
      {/* Filter toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden">
          {(['individual', 'both', 'relay'] as const).map(f => (
            <button
              key={f}
              onClick={() => setEventFilter(f)}
              className={`px-3 py-1.5 text-sm font-bold ${
                eventFilter === f
                  ? 'bg-cyan-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {f === 'individual' ? 'Individual' : f === 'both' ? 'Both' : 'Relays'}
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
            Expand All
          </button>
          <button
            onClick={collapseAll}
            className="px-3 py-1.5 text-sm rounded border border-gray-200 hover:bg-gray-50"
          >
            Collapse All
          </button>
        </div>
      </div>

      {/* Individual entries */}
      {eventFilter !== 'relay' && <>
      <p className="text-sm text-gray-600 mb-4">
        Showing <span className="font-semibold">{filtered.length}</span> clubs with{' '}
        <span className="font-semibold">{filtered.reduce((n: number, c: any) => n + c.swimmers.length, 0)}</span> swimmers
      </p>

      <div className="space-y-8">
        {filtered.map((club: any) => (
          <div key={club.club}>
            {/* Club header — code first, then name */}
            <button
              onClick={() => toggleClub(club.club)}
              className="w-full flex items-center gap-2 text-base font-bold text-gray-900 border-b-2 border-gray-800 pb-1 mb-3 text-left cursor-pointer hover:text-gray-700"
            >
              {expandedClubs.has(club.club) ? (
                <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
              ) : (
                <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />
              )}
              <span className="text-blue-600 font-mono">{club.code}</span>
              <span>{club.club}</span>
              <span className="ml-auto text-sm font-normal text-gray-500">
                {club.swimmers.length} swimmers &bull; {club.swimmers.reduce((n: number, s: any) => n + s.entries.length, 0)} entries
              </span>
            </button>

            {expandedClubs.has(club.club) && (
              <div>
                {club.swimmers.map((swimmer: any, idx: number) => (
                  <div key={swimmer.id} className="border-t border-gray-200 mt-2 pt-1">
                    {/* Swimmer header line */}
                    <div className="flex flex-wrap items-baseline gap-x-1 py-1">
                      <span className="text-sm font-semibold text-gray-500">{idx + 1}.</span>
                      <span className="text-sm font-bold text-gray-900">
                        {swimmer.surname}, {swimmer.given_name}
                      </span>
                      <span className="text-sm text-gray-700">
                        {swimmer.gender === 'M' ? 'M' : swimmer.gender === 'F' ? 'W' : ''}{swimmer.age_group ? ` ${swimmer.age_group}` : ''}
                      </span>
                      <span className="text-sm text-gray-500">
                        — {swimmer.entries.length} event{swimmer.entries.length !== 1 ? 's' : ''}
                      </span>
                    </div>

                    {/* Event items — 2-column grid, sorted by event number */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 mt-1 pl-4">
                      {[...swimmer.entries].sort((a: any, b: any) => (a.event_number || 0) - (b.event_number || 0)).map((e: any, i: number) => {
                        const isNT = !e.original_time || e.original_time === 'NT'
                        const displayName = eventName(e.event_code)
                        const isOut = e.scratched
                        return (
                          <div key={i} className={`flex items-center gap-1.5 py-0.5 text-sm ${isOut ? 'opacity-50 line-through text-gray-400' : ''}`}>
                            <span className="text-xs font-mono text-gray-400 w-6 shrink-0">{e.event_number}</span>
                            <span className="flex-1 truncate text-gray-700">
                              {displayName}
                            </span>
                            {showHeatLane && e.result_heat && e.result_lane && e.result_heat !== '0' && e.result_lane !== '0' && (
                              <span className="text-xs text-gray-400 font-mono shrink-0">H{e.result_heat}L{e.result_lane}</span>
                            )}
                            {!isOut && (
                              <span className={`font-mono text-xs text-right shrink-0 w-14 ${isNT ? NT_TIME_COLOR : 'text-gray-600'}`}>
                                {formatSeedTime(e.original_time)}
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}

                {/* Club footer */}
                <div className="mt-3 pt-2 border-t border-gray-300 text-sm text-gray-600">
                  <span className="font-semibold text-blue-600 font-mono">{club.code}</span>{' '}
                  <span className="font-semibold text-gray-900">{club.club}</span> — {club.swimmers.length} swimmers, {club.swimmers.reduce((n: number, s: any) => n + s.entries.length, 0)} entries
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      </>}

      {/* Relay entries section */}
      {eventFilter !== 'individual' && relays.length > 0 && (
        <>
          <h2 className="font-display font-bold text-2xl text-dark-900 mt-12 mb-4 border-b-2 border-dark-800 pb-2">
            Relay Entries
          </h2>
          <div className="space-y-6">
            {Array.from(relaysByEvent.entries())
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([eventCode, teams]) => {
                const evName = relayEventName(eventCode)
                const eventStroke = relayEventStroke(eventCode)
                return (
                  <div key={eventCode} className="mb-4">
                    <h3 className="text-sm font-bold text-gray-700 mb-2">{evName}</h3>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-gray-500 border-b">
                          <th className="text-left py-1 w-6"></th>
                          <th className="text-left py-1">Heat</th>
                          <th className="text-left py-1">Lane</th>
                          <th className="text-left py-1">Club</th>
                          <th className="text-left py-1">Team</th>
                          <th className="text-right py-1">Seed Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {teams.map((r: any) => {
                          const isExpanded = expandedRelays.has(r.id)
                          return (
                            <Fragment key={r.id}>
                              <tr
                                className="border-b cursor-pointer hover:bg-gray-50"
                                onClick={() => toggleRelayExpand(r.id)}
                              >
                                <td className="py-1">
                                  {isExpanded
                                    ? <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
                                    : <ChevronRight className="h-3.5 w-3.5 text-gray-400" />}
                                </td>
                                <td className="py-1">{r.heat || '-'}</td>
                                <td className="py-1">{r.lane || '-'}</td>
                                <td className="py-1">{r.club_code || '-'}</td>
                                <td className="py-1">{r.team_name || r.team_letter || '-'}</td>
                                <td className="py-1 text-right font-mono">{formatSeedTime(r.seed_time)}</td>
                              </tr>
                              {isExpanded && r.legs && [...r.legs].sort((a: any, b: any) => a.leg_number - b.leg_number).map((leg: any) => {
                                const legStroke = deriveRelayLegStroke(eventStroke, leg.leg_number)
                                return (
                                  <tr key={leg.id} className="bg-gray-50 text-xs">
                                    <td></td>
                                    <td className="py-0.5 pl-4" colSpan={2}>Leg {leg.leg_number} — {legStroke}</td>
                                    <td className="py-0.5" colSpan={2}>
                                      {leg.given_name && leg.surname
                                        ? `${leg.surname}, ${leg.given_name}`
                                        : leg.member_id || '—'}
                                    </td>
                                    <td className="py-0.5 text-right font-mono">{leg.seed_time ? formatSeedTime(leg.seed_time) : ''}</td>
                                  </tr>
                                )
                              })}
                            </Fragment>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )
              })}
          </div>
        </>
      )}
    </>
  )
}
