'use client'

import { useState, Fragment } from 'react'
import { Search, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'

interface Swimmer {
  id: string
  given_name: string
  surname: string
  gender: string | null
  age: number | null
  age_group: string | null
}

interface ClubRow {
  code: string
  clubName: string
  female: number
  male: number
  total: number
  swimmers: Swimmer[]
}

type SortCol = 'clubName' | 'female' | 'male' | 'total'

export function CompetitorsClient({ clubs, cutoff }: { clubs: ClubRow[]; cutoff: number }) {
  const [search, setSearch] = useState('')
  const [sortCol, setSortCol] = useState<SortCol>('total')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const isSearching = !!search.trim()
  const searchLower = search.toLowerCase().trim()

  const rows = clubs
    .filter(r => {
      if (!isSearching) return true
      if (r.code.toLowerCase().includes(searchLower)) return true
      if (r.clubName.toLowerCase().includes(searchLower)) return true
      return r.swimmers.some(s => `${s.given_name} ${s.surname}`.toLowerCase().includes(searchLower))
    })
    .sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1
      if (sortCol === 'clubName') return dir * a.clubName.localeCompare(b.clubName)
      return dir * (a[sortCol] - b[sortCol])
    })

  const largeClubs = rows.filter(r => r.total >= cutoff)
  const smallClubs = rows.filter(r => r.total < cutoff)

  const totalFemale = rows.reduce((s, r) => s + r.female, 0)
  const totalMale = rows.reduce((s, r) => s + r.male, 0)
  const totalAthletes = rows.reduce((s, r) => s + r.total, 0)

  const toggleExpand = (code: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })
  }

  const expandAll = () => setExpanded(new Set(rows.map(r => r.code)))
  const collapseAll = () => setExpanded(new Set())

  const handleSort = (col: SortCol) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir(col === 'clubName' ? 'asc' : 'desc') }
  }

  const SortIcon = ({ col }: { col: SortCol }) => {
    if (sortCol !== col) return <ChevronsUpDown size={14} className="text-dark-300" />
    return sortDir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
  }

  const renderClubRow = (row: ClubRow) => {
    const isExpanded = isSearching || expanded.has(row.code)
    return (
      <Fragment key={row.code}>
        <tr
          className={`border-b border-dark-100 ${!isSearching ? 'cursor-pointer hover:bg-bsm-50/30' : ''} ${isExpanded ? 'bg-bsm-50/30' : ''}`}
          onClick={() => !isSearching && toggleExpand(row.code)}
        >
          <td className="px-4 py-2.5 text-xs font-mono text-dark-400">
            {isSearching ? '' : (isExpanded ? '\u25BC' : '\u25B6')}
          </td>
          <td className="px-4 py-2.5 text-sm text-bsm-600 font-semibold font-mono">{row.code}</td>
          <td className="px-4 py-2.5 text-sm text-dark-900">{row.clubName}</td>
          <td className="px-4 py-2.5 text-right text-sm font-mono text-dark-600">{row.female || '—'}</td>
          <td className="px-4 py-2.5 text-right text-sm font-mono text-dark-600">{row.male || '—'}</td>
          <td className="px-4 py-2.5 text-right text-sm font-semibold font-mono text-dark-900">{row.total}</td>
        </tr>
        {isExpanded && (
          <tr>
            <td colSpan={6} className="px-8 py-2 bg-bsm-50/20 border-b border-dark-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-dark-400 text-xs">
                    <th className="text-left px-2 py-1">Name</th>
                    <th className="text-left px-2 py-1 w-16">Gender</th>
                    <th className="text-left px-2 py-1 w-12">Age</th>
                    <th className="text-left px-2 py-1 w-20">Group</th>
                  </tr>
                </thead>
                <tbody>
                  {row.swimmers.map(s => (
                    <tr key={s.id} className="border-b border-dark-100/50">
                      <td className="px-2 py-1 text-dark-900">{s.given_name} {s.surname}</td>
                      <td className="px-2 py-1 text-dark-500">{s.gender === 'F' ? 'Female' : s.gender === 'M' ? 'Male' : '—'}</td>
                      <td className="px-2 py-1 text-dark-500">{s.age || '—'}</td>
                      <td className="px-2 py-1 text-dark-500">{s.age_group || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </td>
          </tr>
        )}
      </Fragment>
    )
  }

  return (
    <div>
      {/* Controls */}
      <div className="flex gap-3 mb-4 items-center">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400" />
          <input
            type="text"
            placeholder="Search clubs or swimmers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-dark-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-bsm-400 focus:border-bsm-400"
          />
        </div>
        <button onClick={expandAll} className="px-3 py-2 text-xs font-medium text-dark-600 bg-dark-50 rounded-lg hover:bg-dark-100 border border-dark-200">
          Expand All
        </button>
        <button onClick={collapseAll} className="px-3 py-2 text-xs font-medium text-dark-600 bg-dark-50 rounded-lg hover:bg-dark-100 border border-dark-200">
          Collapse All
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-dark-200 overflow-hidden shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="bg-dark-50 border-b border-dark-200">
              <th className="px-4 py-2.5 text-sm font-medium text-dark-600 w-8"></th>
              <th className="text-left px-4 py-2.5 text-sm font-medium text-dark-600 w-20">Code</th>
              <th className="text-left px-4 py-2.5 text-sm font-medium text-dark-600 cursor-pointer select-none" onClick={() => handleSort('clubName')}>
                <span className="inline-flex items-center gap-1">Club <SortIcon col="clubName" /></span>
              </th>
              <th className="text-right px-4 py-2.5 text-sm font-medium text-dark-600 w-20 cursor-pointer select-none" onClick={() => handleSort('female')}>
                <span className="inline-flex items-center gap-1 justify-end">Female <SortIcon col="female" /></span>
              </th>
              <th className="text-right px-4 py-2.5 text-sm font-medium text-dark-600 w-20 cursor-pointer select-none" onClick={() => handleSort('male')}>
                <span className="inline-flex items-center gap-1 justify-end">Male <SortIcon col="male" /></span>
              </th>
              <th className="text-right px-4 py-2.5 text-sm font-medium text-dark-600 w-24 cursor-pointer select-none" onClick={() => handleSort('total')}>
                <span className="inline-flex items-center gap-1 justify-end">Athletes <SortIcon col="total" /></span>
              </th>
            </tr>
          </thead>
          <tbody>
            {largeClubs.map(renderClubRow)}
            {largeClubs.length > 0 && smallClubs.length > 0 && (
              <tr>
                <td colSpan={6} className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 border-t border-dashed border-bsm-300" />
                    <span className="text-xs font-medium text-bsm-600 bg-bsm-50 px-3 py-1 rounded-full border border-bsm-200">
                      Small Clubs — under {cutoff} athletes ({smallClubs.length} clubs)
                    </span>
                    <div className="flex-1 border-t border-dashed border-bsm-300" />
                  </div>
                </td>
              </tr>
            )}
            {smallClubs.map(renderClubRow)}
            {/* Totals row */}
            <tr className="bg-dark-50 border-t-2 border-dark-300">
              <td className="px-4 py-2.5"></td>
              <td className="px-4 py-2.5 text-sm font-bold text-dark-900" colSpan={2}>
                Total ({largeClubs.length} large, {smallClubs.length} small) <span className="text-dark-400 font-normal ml-2">{rows.length} clubs</span>
              </td>
              <td className="px-4 py-2.5 text-right text-sm font-bold font-mono text-dark-900">{totalFemale}</td>
              <td className="px-4 py-2.5 text-right text-sm font-bold font-mono text-dark-900">{totalMale}</td>
              <td className="px-4 py-2.5 text-right text-sm font-bold font-mono text-dark-900">{totalAthletes}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
