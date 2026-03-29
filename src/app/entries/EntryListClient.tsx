'use client'

import { useState, useMemo } from 'react'
import { Search, ChevronDown, ChevronRight } from 'lucide-react'
import { formatSeedTime, formatTime } from '@/lib/utils'
import { eventName } from '@/lib/eventCodes'

export function EntryListClient({ clubs, eventsWithResults }: { clubs: any[], eventsWithResults: string[] }) {
  const [search, setSearch] = useState('')
  const [expandedClubs, setExpandedClubs] = useState<Set<string>>(new Set())

  const ewrSet = useMemo(() => new Set(eventsWithResults), [eventsWithResults])

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

  const expandAll = () => setExpandedClubs(new Set(filtered.map(c => c.club)))
  const collapseAll = () => setExpandedClubs(new Set())

  return (
    <>
      {/* Filter toolbar */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or club..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <button onClick={expandAll} className="text-xs text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap">
            Expand All
          </button>
          <button onClick={collapseAll} className="text-xs text-gray-500 hover:text-gray-700 font-medium whitespace-nowrap">
            Collapse
          </button>
        </div>
      </div>

      {/* Results counter */}
      <p className="text-sm text-gray-600 mb-4">
        Showing <span className="font-semibold">{filtered.length}</span> clubs with{' '}
        <span className="font-semibold">{filtered.reduce((n, c) => n + c.swimmers.length, 0)}</span> swimmers
      </p>

      {/* Club groups */}
      <div className="space-y-8">
        {filtered.map((club) => (
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

                    {/* Event items — 2-column grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 mt-1 pl-4">
                      {swimmer.entries.map((e: any, i: number) => {
                        const isNT = !e.original_time
                        const displayName = eventName(e.event_code)
                        const placeNum = e.result_place ? parseInt(e.result_place) : null
                        const placeColor = placeNum === 1 ? 'text-yellow-500' : placeNum === 2 ? 'text-gray-400' : placeNum === 3 ? 'text-amber-600' : placeNum ? 'text-gray-700' : ''
                        // Status: SCR > DQ > NS > normal
                        const isNS = !e.scratched && (e.result_dq === 'R' || (e.result_time === null && !e.result_dq && ewrSet.has(e.event_code)))
                        const isDQ = !e.scratched && e.result_dq === 'Q'
                        const isOut = e.scratched || isNS
                        return (
                          <div key={i} className={`flex items-center gap-1.5 py-0.5 text-sm ${isOut ? 'opacity-50 line-through text-gray-400' : ''}`}>
                            <span className="text-xs font-mono text-gray-400 w-6 shrink-0">{e.event_number}</span>
                            <span className="flex-1 truncate text-gray-700">
                              {displayName}
                            </span>
                            {e.scratched && (
                              <span className="text-xs px-1 py-0.5 bg-orange-100 text-orange-700 rounded no-underline shrink-0">SCR</span>
                            )}
                            {isDQ && (
                              <span className="text-xs px-1 py-0.5 bg-red-100 text-red-700 rounded no-underline shrink-0">DQ</span>
                            )}
                            {isNS && (
                              <span className="text-xs px-1 py-0.5 bg-gray-100 text-gray-600 rounded no-underline shrink-0">NS</span>
                            )}
                            {!isOut && (
                              <>
                                {e.result_heat && e.result_lane && (
                                  <span className="text-xs text-gray-400 font-mono shrink-0">
                                    H{e.result_heat}L{e.result_lane}
                                  </span>
                                )}
                                <span className={`font-mono text-xs text-right shrink-0 w-14 ${isNT ? 'text-red-500 font-semibold' : 'text-gray-600'}`}>
                                  {e.result_time ? formatTime(e.result_time) : formatSeedTime(e.original_time)}
                                </span>
                                {placeNum && (
                                  <span className={`text-xs font-semibold w-6 text-right shrink-0 ${placeColor}`}>
                                    {placeNum}
                                  </span>
                                )}
                              </>
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
    </>
  )
}
