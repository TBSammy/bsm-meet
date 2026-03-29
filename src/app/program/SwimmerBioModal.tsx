'use client'

import { X, Mic, Target, Sparkles, Timer } from 'lucide-react'
import { eventName } from '@/lib/eventCodes'

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

interface SwimmerBioModalProps {
  bio: BioProfile
  swimmerName: string
  swimmerClub: string
  swimmerAge: string
  eventNum: number
  eventCode: string
  onClose: () => void
}

export function SwimmerBioModal({ bio, swimmerName, swimmerClub, swimmerAge, eventNum, eventCode, onClose }: SwimmerBioModalProps) {
  const eventGoal = bio.event_goals?.[String(eventNum)]

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-gradient-to-r from-bsm-700 to-bsm-600 text-white rounded-t-2xl px-6 py-4 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Mic className="h-5 w-5 text-bsm-200" />
              <span className="text-xs font-semibold text-bsm-200 uppercase tracking-wider">Announcer Notes</span>
            </div>
            <h2 className="font-display font-bold text-2xl">{swimmerName}</h2>
            <p className="text-white/80 text-sm">{swimmerClub}{swimmerAge ? ` — Age ${swimmerAge}` : ''}</p>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white mt-1">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Event-specific goal — top priority for announcer */}
          {eventGoal && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Target className="h-4 w-4 text-amber-600" />
                <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">Goal for Event {eventNum}</span>
              </div>
              <p className="text-amber-900 font-semibold text-lg">{eventGoal}</p>
              <p className="text-amber-700 text-xs mt-1">{eventName(eventCode)}</p>
            </div>
          )}

          {/* Meet goals */}
          {bio.goals && (
            <div>
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Meet Goals</h3>
              <p className="text-gray-800">{bio.goals}</p>
            </div>
          )}

          {/* Bio */}
          {bio.bio_text && (
            <div>
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">About</h3>
              <p className="text-gray-800">{bio.bio_text}</p>
            </div>
          )}

          {/* Fun fact */}
          {bio.fun_fact && (
            <div className="bg-bsm-50 border border-bsm-200 rounded-xl p-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-bsm-600 shrink-0" />
                <p className="text-bsm-900 text-sm"><span className="font-semibold">Fun fact:</span> {bio.fun_fact}</p>
              </div>
            </div>
          )}

          {/* Years swimming */}
          {bio.years_swimming && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Timer className="h-4 w-4" />
              <span>{bio.years_swimming} year{bio.years_swimming === 1 ? '' : 's'} in Masters Swimming</span>
            </div>
          )}

          {/* No content fallback */}
          {!bio.bio_text && !bio.goals && !bio.fun_fact && !eventGoal && (
            <p className="text-gray-400 text-sm italic text-center py-4">
              This swimmer has opted in for announcer notes but hasn&apos;t added any details yet.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
