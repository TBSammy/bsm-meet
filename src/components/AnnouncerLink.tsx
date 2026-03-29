'use client'

import { useState, useRef, useEffect } from 'react'
import { Mic, MicOff, X } from 'lucide-react'
import { useAnnouncer } from './AnnouncerContext'

const ANNOUNCER_PIN = '41014101'

export function AnnouncerLink() {
  const { isAnnouncer, setAnnouncer } = useAnnouncer()
  const [showPin, setShowPin] = useState(false)
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (showPin) {
      // Delay focus for mobile compatibility
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [showPin])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (pin === ANNOUNCER_PIN) {
      setAnnouncer(true)
      setShowPin(false)
      setPin('')
      setError(false)
    } else {
      setError(true)
      setPin('')
    }
  }

  const closeModal = () => {
    setShowPin(false)
    setPin('')
    setError(false)
  }

  if (isAnnouncer) {
    return (
      <button
        onClick={() => setAnnouncer(false)}
        className="flex items-center gap-1.5 text-xs text-bsm-400 hover:text-bsm-300 transition-colors"
      >
        <Mic className="h-3.5 w-3.5" />
        Announcer Mode Active — Tap to Exit
      </button>
    )
  }

  return (
    <>
      <button
        onClick={() => setShowPin(true)}
        className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/50 transition-colors"
      >
        <MicOff className="h-3 w-3" />
        Announce
      </button>

      {showPin && (
        <div
          className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4"
          onMouseDown={closeModal}
          onTouchEnd={closeModal}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 relative"
            onMouseDown={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Mic className="h-5 w-5 text-bsm-600" />
                <h3 className="font-display font-bold text-lg text-dark-900">Announcer Access</h3>
              </div>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-4">Enter the announcer PIN to view swimmer profiles on the program page.</p>
            <form onSubmit={handleSubmit}>
              <div className="relative">
                <input
                  ref={inputRef}
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={pin}
                  onChange={(e) => { setPin(e.target.value.replace(/\D/g, '')); setError(false) }}
                  placeholder="Enter PIN"
                  className={`w-full px-4 py-3 border ${error ? 'border-red-400 bg-red-50' : 'border-gray-200'} rounded-xl text-center text-lg font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-bsm-500 text-transparent caret-gray-400`}
                />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-lg font-mono tracking-widest text-gray-900">
                  {'●'.repeat(pin.length)}
                </div>
              </div>
              {error && <p className="text-red-500 text-xs mt-2 text-center">Incorrect PIN. Try again.</p>}
              <button
                type="submit"
                className="w-full mt-4 bg-bsm-600 hover:bg-bsm-700 text-white font-semibold py-3 rounded-xl transition-colors"
              >
                Enter
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
