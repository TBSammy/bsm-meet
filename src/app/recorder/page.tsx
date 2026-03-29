'use client'

import { useState, useRef } from 'react'
import { Upload, Lock, CheckCircle, AlertTriangle, FileText, RefreshCw } from 'lucide-react'

interface ImportSummary {
  filename: string
  format: string
  swimmers: number
  entries: number
  results: number
  dqs: number
  relays: number
  updatedEntries: number
  updatedRelays: number
  skippedEntries: number
  newSplits: number
  warnings: string[]
  regressionWarning: string | null
}

export default function RecorderPage() {
  const [passphrase, setPassphrase] = useState('')
  const [authenticated, setAuthenticated] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [summary, setSummary] = useState<ImportSummary | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleUpload = async () => {
    if (!file) return
    setError('')
    setLoading(true)
    setSummary(null)

    const formData = new FormData()
    formData.append('passphrase', passphrase)
    formData.append('file', file)

    try {
      const res = await fetch('/api/recorder/upload', { method: 'POST', body: formData })
      const data = await res.json()

      if (!res.ok) {
        if (res.status === 401) {
          setAuthenticated(false)
          throw new Error(data.error || 'Authentication failed. Please re-enter passphrase.')
        }
        throw new Error(data.error || 'Upload failed')
      }

      setSummary(data.summary)
      setFile(null)
      if (fileRef.current) fileRef.current.value = ''
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const [authLoading, setAuthLoading] = useState(false)

  const handleAuth = async () => {
    if (!passphrase.trim()) return
    setError('')
    setAuthLoading(true)
    try {
      const res = await fetch('/api/recorder/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passphrase }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed')
      }
      setAuthenticated(true)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setAuthLoading(false)
    }
  }

  if (!authenticated) {
    return (
      <div className="max-w-md mx-auto px-4 py-16">
        <div className="text-center mb-8">
          <Lock className="h-12 w-12 text-bsm-600 mx-auto mb-4" />
          <h1 className="font-display font-bold text-3xl text-dark-900 mb-2">Results Upload</h1>
          <p className="text-dark-500">Authorised recorder access only</p>
        </div>
        <div className="bg-white border border-dark-100 rounded-2xl p-6 shadow-lg space-y-4">
          <div>
            <label className="block text-sm font-semibold text-dark-700 mb-1">Passphrase</label>
            <input
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder="Enter recorder passphrase"
              className="w-full px-4 py-3 border border-dark-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-bsm-500"
              onKeyDown={(e) => e.key === 'Enter' && handleAuth()}
            />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            onClick={handleAuth}
            disabled={!passphrase.trim() || authLoading}
            className="w-full bg-bsm-600 hover:bg-bsm-700 disabled:bg-dark-200 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {authLoading ? <><RefreshCw className="h-5 w-5 animate-spin" /> Verifying...</> : 'Continue'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-16">
      <div className="text-center mb-8">
        <Upload className="h-12 w-12 text-bsm-600 mx-auto mb-4" />
        <h1 className="font-display font-bold text-3xl text-dark-900 mb-2">Upload Results</h1>
        <p className="text-dark-500">Upload HY3, CL2, or ZIP file from the timing system</p>
      </div>

      <div className="bg-white border border-dark-100 rounded-2xl p-6 shadow-lg space-y-4">
        {/* File input */}
        <div>
          <label className="block text-sm font-semibold text-dark-700 mb-2">Results File</label>
          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-dark-200 rounded-xl p-8 text-center cursor-pointer hover:border-bsm-400 hover:bg-bsm-50/30 transition-colors"
          >
            {file ? (
              <div className="flex items-center justify-center gap-2 text-bsm-700">
                <FileText className="h-5 w-5" />
                <span className="font-medium">{file.name}</span>
                <span className="text-xs text-dark-400">({(file.size / 1024).toFixed(0)} KB)</span>
              </div>
            ) : (
              <div>
                <Upload className="h-8 w-8 text-dark-300 mx-auto mb-2" />
                <p className="text-sm text-dark-400">Click to select .hy3, .cl2, or .zip file</p>
              </div>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".hy3,.cl2,.zip"
            className="hidden"
            onChange={(e) => { setFile(e.target.files?.[0] || null); setSummary(null); setError('') }}
          />
        </div>

        {error && (
          <div className="bg-red-50 rounded-xl p-4 text-sm text-red-700 flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <button
          onClick={handleUpload}
          disabled={!file || loading}
          className="w-full bg-bsm-600 hover:bg-bsm-700 disabled:bg-dark-200 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          {loading ? (
            <><RefreshCw className="h-5 w-5 animate-spin" /> Importing...</>
          ) : (
            <><Upload className="h-5 w-5" /> Upload & Import Results</>
          )}
        </button>

        {/* Success summary */}
        {summary && (
          <div className={`${summary.regressionWarning ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'} border rounded-xl p-5 space-y-3`}>
            {summary.regressionWarning && (
              <div className="bg-amber-100 rounded-lg p-3 text-sm text-amber-800 flex items-start gap-2 mb-2">
                <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                <span>{summary.regressionWarning}</span>
              </div>
            )}
            <div className={`flex items-center gap-2 font-semibold ${summary.updatedEntries === 0 && summary.updatedRelays === 0 ? 'text-dark-600' : 'text-green-800'}`}>
              <CheckCircle className="h-5 w-5" />
              {summary.updatedEntries === 0 && summary.updatedRelays === 0
                ? 'No changes — results already up to date'
                : 'Results imported successfully'}
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="text-dark-500">File</div>
              <div className="font-medium text-dark-800">{summary.filename}</div>
              <div className="text-dark-500">Format</div>
              <div className="font-medium text-dark-800">{summary.format}</div>
              <div className="text-dark-500">Swimmers in file</div>
              <div className="font-medium text-dark-800">{summary.swimmers}</div>
              <div className="text-dark-500">Results in file</div>
              <div className="font-medium text-dark-800">{summary.results}</div>
              <div className="text-dark-500">Entries updated</div>
              <div className="font-semibold text-green-700">{summary.updatedEntries}</div>
              {summary.updatedRelays > 0 && (
                <>
                  <div className="text-dark-500">Relays updated</div>
                  <div className="font-semibold text-green-700">{summary.updatedRelays}</div>
                </>
              )}
              {summary.newSplits > 0 && (
                <>
                  <div className="text-dark-500">Split times</div>
                  <div className="font-semibold text-green-700">{summary.newSplits}</div>
                </>
              )}
              {summary.dqs > 0 && (
                <>
                  <div className="text-dark-500">DQs</div>
                  <div className="font-medium text-amber-700">{summary.dqs}</div>
                </>
              )}
            </div>
            {summary.warnings.length > 0 && (
              <div className="text-xs text-amber-700 mt-2">
                <strong>Warnings:</strong>
                <ul className="list-disc list-inside mt-1">
                  {summary.warnings.slice(0, 5).map((w, i) => <li key={i}>{w}</li>)}
                  {summary.warnings.length > 5 && <li>...and {summary.warnings.length - 5} more</li>}
                </ul>
              </div>
            )}
            <p className="text-xs text-dark-400 mt-2">
              Results are now live on the site. Upload again to update with newer results.
            </p>
          </div>
        )}
      </div>

      <button
        onClick={() => { setAuthenticated(false); setPassphrase(''); setFile(null); setSummary(null); setError('') }}
        className="mt-6 text-sm text-dark-400 hover:text-dark-600 mx-auto block"
      >
        Log out
      </button>
    </div>
  )
}
