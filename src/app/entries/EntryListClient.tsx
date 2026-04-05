'use client'

import { useState } from 'react'
import { Search, X, ChevronDown, ChevronRight } from 'lucide-react'
import { formatSeedTime } from '@/lib/utils'
import { eventName, relayEventName } from '@/lib/eventCodes'
import { NT_TIME_COLOR } from '@/lib/displayConstants'

export function EntryListClient({ clubs, showHeatLane = false }: {
  clubs: any[];
  showHeatLane?: boolean;
}) {
  const [search, setSearch] = useState('')
  const [expandedClubs, setExpandedClubs] = useState<Set<string>>(new Set())

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

  return (
    <>
      {/* Filter toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
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

      {/* Results summary */}
      <p className="text-sm text-gray-600 mb-4">
        Showing <span className="font-semibold">{filtered.length}</span> clubs with{' '}
        <span className="font-semibold">{filtered.reduce((n: number, c: any) => n + c.swimmers.length, 0)}</span> swimmers
      </p>

      <div className="space-y-8">
        {filtered.map((club: any) => (
          <div key={club.club}>
            {/* Club header */}
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
                {club.swimmers.map((swimmer: any, idx: number) => {
                  const indCount = swimmer.entries.length
                  const relCount = (swimmer.relays || []).length

                  // Build combined items sorted by event number
                  const indItems = [...swimmer.entries]
                    .sort((a: any, b: any) => (parseInt(a.event_number) || 0) - (parseInt(b.event_number) || 0))
                    .map((e: any) => ({ type: 'ind' as const, entry: e }))
                  const relItems = (swimmer.relays || []).map((r: any) => ({ type: 'relay' as const, relay: r }))
                  const combined = [...indItems, ...relItems]
                  const half = Math.ceil(combined.length / 2)
                  const leftCol = combined.slice(0, half)
                  const rightCol = combined.slice(half)

                  const renderItem = (item: typeof combined[number]) => {
                    if (item.type === 'ind') {
                      const e = item.entry
                      const isNT = !e.original_time || e.original_time === 'NT'
                      const isOut = e.scratched
                      const hlText = showHeatLane && e.result_heat && e.result_lane && e.result_heat !== '0' && e.result_lane !== '0'
                        ? `H${e.result_heat}L${e.result_lane}` : ''
                      return (
                        <div key={e.id} className={`flex items-center py-0.5 text-sm ${isOut ? 'opacity-50 line-through text-gray-400' : ''}`}>
                          <span className="text-xs font-mono text-gray-400 w-6 shrink-0 text-right mr-1.5">{e.event_number || ''}</span>
                          <span className="flex-1 truncate text-gray-700">
                            {eventName(e.event_code)}
                          </span>
                          {showHeatLane && <span className="text-xs text-gray-400 font-mono w-12 shrink-0 text-right">{hlText}</span>}
                          {!isOut && (
                            <span className={`font-mono text-xs text-right shrink-0 w-[4.5rem] ml-2 ${isNT ? NT_TIME_COLOR : 'text-gray-600'}`}>
                              {formatSeedTime(e.original_time)}
                            </span>
                          )}
                          {isOut && <span className="w-[4.5rem] ml-2 shrink-0"></span>}
                        </div>
                      )
                    } else {
                      const r = item.relay
                      const hlText = showHeatLane && r.heat && r.lane && r.heat !== '0' && r.lane !== '0'
                        ? `H${r.heat}L${r.lane}` : ''
                      return (
                        <div key={`${r.relayId}-${r.legNumber}`} className="flex items-center py-0.5 text-sm text-gray-400 italic">
                          <span className="text-xs font-mono w-6 shrink-0 text-right mr-1.5 not-italic">{r.eventNumber || ''}</span>
                          <span className="flex-1 truncate">{relayEventName(r.eventCode)} <span className="text-xs">(relay)</span></span>
                          {showHeatLane && <span className="text-xs font-mono w-12 shrink-0 text-right not-italic">{hlText}</span>}
                          <span className="font-mono text-xs text-right shrink-0 w-[4.5rem] ml-2 not-italic">{r.seedTime ? formatSeedTime(r.seedTime) : ''}</span>
                        </div>
                      )
                    }
                  }

                  return (
                    <div key={swimmer.id} className="border-t border-gray-200 mt-2 pt-1">
                      {/* Swimmer header */}
                      <div className="flex flex-wrap items-baseline gap-x-1 py-1">
                        <span className="text-sm font-semibold text-gray-500">{idx + 1}.</span>
                        <span className="text-sm font-bold text-gray-900">
                          {swimmer.surname}, {swimmer.given_name}
                        </span>
                        <span className="text-sm text-gray-700">
                          {swimmer.gender === 'M' ? 'M' : swimmer.gender === 'F' ? 'W' : ''}{swimmer.age_group ? ` ${swimmer.age_group}` : ''}
                        </span>
                        <span className="text-sm text-gray-500">
                          — Ind/Rel: {indCount} / {relCount}
                        </span>
                      </div>

                      {/* 2-column event grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 mt-1 pl-4">
                        <div>{leftCol.map(item => renderItem(item))}</div>
                        <div>{rightCol.map(item => renderItem(item))}</div>
                      </div>
                    </div>
                  )
                })}

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
    </>
  )
}
