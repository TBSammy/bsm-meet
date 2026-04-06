'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Menu, X } from 'lucide-react'

export function Header({ entriesClosed, resultsLive, programLive }: { entriesClosed?: boolean; resultsLive?: boolean; programLive?: boolean }) {
  const navItems = [
    { href: '/', label: 'Home' },
    ...(programLive ? [{ href: '/program', label: 'Program' }] : []),
    ...(entriesClosed ? [{ href: '/entries', label: 'Entry List' }] : []),
    ...(resultsLive ? [{ href: '/results', label: 'Results' }] : []),
    { href: '/venue', label: 'Venue' },
    { href: '/portal', label: 'Swimmer Portal' },
  ]
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <header className="bg-gradient-to-r from-bsm-400 via-bsm-500 to-purple-900 text-white shadow-lg sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-3 font-display font-bold text-xl">
            <img src="/bsm-logo.png" alt="BSM Logo" className="h-10 rounded" />
            <span className="hidden sm:inline">Brisbane Southside Masters</span>
            <span className="sm:hidden">BSM</span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="px-3 py-2 rounded-lg text-sm font-medium text-white/90 hover:text-white hover:bg-white/10 transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Mobile Toggle */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-white/10"
          >
            {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile Nav */}
        {mobileOpen && (
          <nav className="md:hidden pb-4 border-t border-white/20 pt-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="block px-3 py-2 rounded-lg text-sm font-medium text-white/90 hover:text-white hover:bg-white/10"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        )}
      </div>
    </header>
  )
}
