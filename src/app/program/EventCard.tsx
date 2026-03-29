'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, CheckCircle, Mic, Target } from 'lucide-react'

export function EventCard({ eventNum, displayName, genderLabel, estTime, scheduledTime, deltaMinutes, entryCount, isComplete, bioIndicator, eventGoalIndicator, children }: {
  eventNum: number, displayName: string, genderLabel: string, estTime?: string, scheduledTime?: string, deltaMinutes?: number, entryCount: number, isComplete: boolean, bioIndicator?: number, eventGoalIndicator?: number, children: React.ReactNode
}) {
  const [expanded, setExpanded] = useState(!isComplete)

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-2.5 bg-gray-100 border-b-2 border-gray-300 text-left hover:bg-gray-150 transition-colors"
      >
        {expanded ? <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" /> : <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />}
        <span className="font-mono font-bold text-sm tracking-wide text-gray-900 shrink-0">
          Event {eventNum}
        </span>
        <span className="font-semibold text-sm text-gray-700 truncate">
          {displayName}{genderLabel ? ` — ${genderLabel}` : ''}
        </span>
        <div className="ml-auto flex items-center gap-3 shrink-0">
          {bioIndicator && (
            <span className="inline-flex items-center gap-0.5 text-xs text-bsm-600 font-semibold">
              <Mic className="h-3.5 w-3.5" />{bioIndicator}
            </span>
          )}
          {eventGoalIndicator && (
            <span className="inline-flex items-center gap-0.5 text-xs text-amber-600 font-semibold">
              <Target className="h-3.5 w-3.5" />{eventGoalIndicator}
            </span>
          )}
          {isComplete && <CheckCircle className="h-4 w-4 text-green-500" />}
          {estTime && (
            <span className="font-mono text-xs text-gray-500">
              {deltaMinutes !== 0 && scheduledTime !== estTime ? (
                <><s className="text-gray-400">{scheduledTime}</s> <span className={deltaMinutes! > 0 ? 'text-red-500' : 'text-green-600'}>{estTime}</span></>
              ) : (
                <>~{estTime}</>
              )}
            </span>
          )}
          <span className="text-xs text-gray-500">
            {entryCount} {entryCount === 1 ? 'entry' : 'entries'}
          </span>
        </div>
      </button>
      {expanded && children}
    </div>
  )
}
