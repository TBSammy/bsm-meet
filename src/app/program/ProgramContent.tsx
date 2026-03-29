'use client'

import { useState, useMemo } from 'react'
import { Mic, Filter, Target } from 'lucide-react'
import { useAnnouncer } from '@/components/AnnouncerContext'
import { EventCard } from './EventCard'
import { SwimmerBioModal } from './SwimmerBioModal'
import { formatSeedTime } from '@/lib/utils'

interface HeatSwimmer {
  key: string
  lane: string
  isRelay: boolean
  swimmerId?: string
  swimmerName?: string
  age?: string
  clubCode?: string
  teamName?: string
  originalTime: number | string | null
  eventCode: string
  scratched?: boolean
  resultDq?: string | null
  resultTime?: number | null
}

interface Heat {
  num: number
  total: number
  estTime?: string
  scheduledTime?: string
  deltaMinutes?: number
  swimmers: HeatSwimmer[]
}

interface ProgramEvent {
  eventNum: number
  displayName: string
  genderLabel: string
  eventCode: string
  estTime?: string
  scheduledTime?: string
  deltaMinutes?: number
  entryCount: number
  isComplete: boolean
  heats: Heat[]
}

interface SessionDef {
  session: number
  events: number[]
  label: string
  start: string
}

interface BioProfile {
  swimmer_id: string
  bio_text?: string | null
  goals?: string | null
  fun_fact?: string | null
  years_swimming?: number | null
  event_goals?: Record<string, string> | null
  first_name?: string | null
  last_name?: string | null
  club?: string | null
}

interface BreakDef {
  afterEventNumber: number
  durationMinutes: number
}

interface ProgramContentProps {
  sessions: SessionDef[]
  events: ProgramEvent[]
  bioMap: Record<string, BioProfile>
  breaks?: BreakDef[]
}

export function ProgramContent({ sessions, events, bioMap, breaks = [] }: ProgramContentProps) {
  const { isAnnouncer } = useAnnouncer()
  const [bioModal, setBioModal] = useState<{
    bio: BioProfile
    swimmerName: string
    swimmerClub: string
    swimmerAge: string
    eventNum: number
    eventCode: string
  } | null>(null)
  const [bioFilter, setBioFilter] = useState<'all' | 'bio'>('all')

  const bioCount = useMemo(() => Object.keys(bioMap).length, [bioMap])

  const eventsByNum = new Map(events.map(e => [e.eventNum, e]))

  return (
    <>
      {isAnnouncer && (
        <div className="bg-bsm-50 border border-bsm-200 rounded-xl px-4 py-2.5 mb-6 flex flex-wrap items-center gap-2">
          <Mic className="h-4 w-4 text-bsm-600" />
          <span className="text-sm font-semibold text-bsm-800">Announcer Mode</span>
          <span className="text-xs text-bsm-600 hidden sm:inline">— Tap a swimmer&apos;s <Mic className="h-3 w-3 inline" /> to view their profile</span>
          <div className="flex items-center gap-1.5 ml-auto">
            <button
              onClick={() => setBioFilter('all')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${bioFilter === 'all' ? 'bg-bsm-600 text-white' : 'bg-white text-bsm-700 border border-bsm-300 hover:bg-bsm-100'}`}
            >
              All Swimmers
            </button>
            <button
              onClick={() => setBioFilter('bio')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${bioFilter === 'bio' ? 'bg-bsm-600 text-white' : 'bg-white text-bsm-700 border border-bsm-300 hover:bg-bsm-100'}`}
            >
              <Mic className="h-3 w-3 inline mr-1" />
              With Bio ({bioCount})
            </button>
          </div>
        </div>
      )}

      {events.length === 0 && (
        <div className="text-center py-20 bg-gray-50 rounded-2xl">
          <h2 className="font-display font-bold text-xl text-gray-700 mb-2">Program Loading...</h2>
          <p className="text-gray-500">Event data will appear here once imported.</p>
        </div>
      )}

      {sessions.map((session, sessIdx) => {
        const sessionEvents = events.filter(e => session.events.includes(e.eventNum))
        if (sessionEvents.length === 0) return null

        return (
          <div key={session.session}>
            {sessIdx > 0 && (
              <div className="flex items-center gap-4 my-6">
                <div className="flex-1 border-t-2 border-dashed border-amber-300" />
                <span className="text-sm font-semibold text-amber-700 bg-amber-50 px-4 py-1.5 rounded-full border border-amber-200">
                  Break — {session.label} starts {session.start}
                </span>
                <div className="flex-1 border-t-2 border-dashed border-amber-300" />
              </div>
            )}

            <div className="mb-10">
              <div className="bg-gradient-to-r from-bsm-700 to-bsm-600 text-white rounded-xl px-6 py-3 mb-4 flex items-center justify-between">
                <h2 className="font-display font-bold text-xl">{session.label}</h2>
                <span className="text-white/80 font-semibold">Starts {session.start}</span>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {sessionEvents.map((ev) => {
                  // Count swimmers with bios in this event
                  const eventBioCount = isAnnouncer ? ev.heats.reduce((n, h) => n + h.swimmers.filter(s => s.swimmerId && bioMap[s.swimmerId]).length, 0) : 0
                  // Count swimmers with event-specific goals
                  const eventGoalCount = isAnnouncer ? ev.heats.reduce((n, h) => n + h.swimmers.filter(s => s.swimmerId && bioMap[s.swimmerId]?.event_goals?.[String(ev.eventNum)]).length, 0) : 0

                  // When bio filter active, skip events with no bio swimmers
                  if (isAnnouncer && bioFilter === 'bio' && eventBioCount === 0) return null

                  // Check for a mid-session break after this event
                  const breakAfter = breaks.find(b => b.afterEventNumber === ev.eventNum)

                  return (
                  <div key={`wrap-${ev.eventNum}`} className="contents">
                  <EventCard
                    key={ev.eventNum}
                    eventNum={ev.eventNum}
                    displayName={ev.displayName}
                    genderLabel={ev.genderLabel}
                    estTime={ev.estTime}
                    scheduledTime={ev.scheduledTime}
                    deltaMinutes={ev.deltaMinutes}
                    entryCount={ev.entryCount}
                    isComplete={ev.isComplete}
                    bioIndicator={isAnnouncer && eventBioCount > 0 ? eventBioCount : undefined}
                    eventGoalIndicator={isAnnouncer && eventGoalCount > 0 ? eventGoalCount : undefined}
                  >
                    {ev.heats.map((heat) => {
                      const visibleSwimmers = isAnnouncer && bioFilter === 'bio'
                        ? heat.swimmers.filter(s => s.swimmerId && bioMap[s.swimmerId])
                        : heat.swimmers
                      if (visibleSwimmers.length === 0) return null

                      return (
                      <div key={heat.num}>
                        <div className="flex items-center gap-4 px-4 py-1.5 bg-blue-50 border-b border-blue-100 font-semibold text-sm text-blue-900">
                          <span>Heat {heat.num} of {heat.total} — Timed Finals</span>
                          {heat.estTime && (
                            <span className="ml-auto font-mono text-xs text-gray-500">
                              {heat.deltaMinutes !== undefined && heat.deltaMinutes !== 0 && heat.scheduledTime !== heat.estTime ? (
                                <><s className="text-gray-400">{heat.scheduledTime}</s> <span className={heat.deltaMinutes > 0 ? 'text-red-500' : 'text-green-600'}>{heat.estTime}</span></>
                              ) : (
                                <>~{heat.estTime}</>
                              )}
                            </span>
                          )}
                        </div>

                        <table className="w-full">
                          <thead>
                            <tr className="text-gray-700 text-xs font-semibold bg-gray-50 border-b border-gray-200">
                              <th className="text-center px-3 py-1.5 w-12">Ln</th>
                              <th className="text-left px-3 py-1.5">Name</th>
                              <th className="text-left px-3 py-1.5 w-20 hidden sm:table-cell">Age</th>
                              <th className="text-left px-3 py-1.5 w-24 hidden sm:table-cell">Club</th>
                              <th className="text-right px-3 py-1.5 w-20">Seed</th>
                            </tr>
                          </thead>
                          <tbody>
                            {visibleSwimmers.map((s) => {
                              const isNS = !s.scratched && (s.resultDq === 'R' || (s.resultTime === null && !s.resultDq && ev.isComplete))
                              const isDQ = !s.scratched && s.resultDq === 'Q'
                              const isOut = s.scratched || isNS
                              const hasBio = isAnnouncer && s.swimmerId && bioMap[s.swimmerId]
                              const hasEventGoal = hasBio && bioMap[s.swimmerId!]?.event_goals?.[String(ev.eventNum)]
                              const handleClick = hasBio ? () => {
                                setBioModal({
                                  bio: bioMap[s.swimmerId!],
                                  swimmerName: s.swimmerName || '',
                                  swimmerClub: s.clubCode || '',
                                  swimmerAge: s.age || '',
                                  eventNum: ev.eventNum,
                                  eventCode: ev.eventCode,
                                })
                              } : undefined

                              return (
                                <tr
                                  key={s.key}
                                  className={`border-b border-gray-100 text-sm ${isOut ? 'opacity-50' : ''} ${hasBio && !isOut ? 'hover:bg-bsm-50 cursor-pointer' : 'hover:bg-gray-50/50'}`}
                                  onClick={isOut ? undefined : handleClick}
                                >
                                  <td className="text-center px-3 py-1.5 font-mono text-xs text-gray-400">
                                    {s.lane || ''}
                                  </td>
                                  {s.isRelay ? (
                                    <>
                                      <td className={`px-3 py-1.5 font-medium text-gray-900 ${s.scratched ? 'line-through text-gray-400' : ''}`} colSpan={3}>
                                        {s.teamName}
                                        <span className="ml-2 text-xs text-gray-500">{s.age || ''}</span>
                                        {s.scratched && <span className="ml-2 text-xs px-1 py-0.5 bg-orange-100 text-orange-700 rounded no-underline">SCR</span>}
                                        {isNS && <span className="ml-2 text-xs px-1 py-0.5 bg-gray-100 text-gray-600 rounded no-underline">NS</span>}
                                        {isDQ && <span className="ml-2 text-xs px-1 py-0.5 bg-red-100 text-red-700 rounded no-underline">DQ</span>}
                                      </td>
                                      <td className="text-right px-3 py-1.5 font-mono text-xs text-gray-600">
                                        {isOut ? '' : formatSeedTime(s.originalTime)}
                                      </td>
                                    </>
                                  ) : (
                                    <>
                                      {/* Desktop */}
                                      <td className={`px-3 py-1.5 font-medium hidden sm:table-cell ${isOut ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                                        <span className="inline-flex items-center gap-1.5">
                                          {s.swimmerName}
                                          {s.scratched && <span className="text-xs px-1 py-0.5 bg-orange-100 text-orange-700 rounded no-underline">SCR</span>}
                                          {!isOut && hasBio && <Mic className="h-3.5 w-3.5 text-bsm-500" />}
                                          {!isOut && hasEventGoal && <Target className="h-3.5 w-3.5 text-amber-500" />}
                                        </span>
                                      </td>
                                      <td className={`px-3 py-1.5 text-xs text-gray-500 hidden sm:table-cell ${isOut ? 'line-through' : ''}`}>
                                        {s.age || ''}
                                      </td>
                                      <td className={`px-3 py-1.5 text-xs font-semibold hidden sm:table-cell ${isOut ? 'line-through text-gray-400' : 'text-blue-600'}`}>
                                        {s.clubCode || ''}
                                      </td>
                                      <td className="text-right px-3 py-1.5 font-mono text-xs hidden sm:table-cell">
                                        {s.scratched ? '' : (
                                          <span className={!s.originalTime ? 'text-red-500 font-semibold' : 'text-gray-600'}>
                                            {formatSeedTime(s.originalTime)}
                                          </span>
                                        )}
                                      </td>
                                      {/* Mobile */}
                                      <td className="px-3 py-1.5 sm:hidden" colSpan={3}>
                                        <div className={`font-medium inline-flex items-center gap-1.5 ${isOut ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                                          {s.swimmerName}
                                          {s.scratched && <span className="text-xs px-1 py-0.5 bg-orange-100 text-orange-700 rounded no-underline">SCR</span>}
                                          {!isOut && hasBio && <Mic className="h-3.5 w-3.5 text-bsm-500" />}
                                          {!isOut && hasEventGoal && <Target className="h-3.5 w-3.5 text-amber-500" />}
                                        </div>
                                        <div className={`flex items-center gap-2 text-xs text-gray-500 ${isOut ? 'line-through' : ''}`}>
                                          <span>{s.age || ''}</span>
                                          <span className={`font-semibold ${s.scratched ? 'text-gray-400' : 'text-blue-600'}`}>{s.clubCode || ''}</span>
                                        </div>
                                      </td>
                                      <td className="text-right px-3 py-1.5 font-mono text-xs sm:hidden">
                                        {s.scratched ? '' : (
                                          <span className={!s.originalTime ? 'text-red-500 font-semibold' : 'text-gray-600'}>
                                            {formatSeedTime(s.originalTime)}
                                          </span>
                                        )}
                                      </td>
                                    </>
                                  )}
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )})}
                  </EventCard>
                  {breakAfter && (
                    <div className="col-span-full flex items-center gap-4 my-2">
                      <div className="flex-1 border-t border-dashed border-orange-300" />
                      <span className="text-xs font-medium text-orange-600 bg-orange-50 px-3 py-1 rounded-full border border-orange-200">
                        {breakAfter.durationMinutes} min break
                      </span>
                      <div className="flex-1 border-t border-dashed border-orange-300" />
                    </div>
                  )}
                  </div>
                  )
                })}
              </div>
            </div>
          </div>
        )
      })}

      {bioModal && (
        <SwimmerBioModal
          bio={bioModal.bio}
          swimmerName={bioModal.swimmerName}
          swimmerClub={bioModal.swimmerClub}
          swimmerAge={bioModal.swimmerAge}
          eventNum={bioModal.eventNum}
          eventCode={bioModal.eventCode}
          onClose={() => setBioModal(null)}
        />
      )}
    </>
  )
}
