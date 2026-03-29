'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface AnnouncerState {
  isAnnouncer: boolean
  setAnnouncer: (v: boolean) => void
}

const AnnouncerContext = createContext<AnnouncerState>({
  isAnnouncer: false,
  setAnnouncer: () => {},
})

export function AnnouncerProvider({ children }: { children: ReactNode }) {
  const [isAnnouncer, setIsAnnouncer] = useState(false)

  useEffect(() => {
    setIsAnnouncer(localStorage.getItem('bsm_announcer') === 'true')
  }, [])

  const setAnnouncer = (v: boolean) => {
    setIsAnnouncer(v)
    if (v) localStorage.setItem('bsm_announcer', 'true')
    else localStorage.removeItem('bsm_announcer')
  }

  return (
    <AnnouncerContext.Provider value={{ isAnnouncer, setAnnouncer }}>
      {children}
    </AnnouncerContext.Provider>
  )
}

export function useAnnouncer() {
  return useContext(AnnouncerContext)
}
