import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, ntDemo } from '@/lib/supabase/server'
import { CAMPAIGN_ID } from '@/lib/supabase/config'
import { parseHY3, parseCL2 } from '@/utils/hy3Parser'
import JSZip from 'jszip'

const RECORDER_PASSPHRASE = process.env.RECORDER_PASSPHRASE || ''

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const passphrase = formData.get('passphrase') as string
  const file = formData.get('file') as File | null

  // Auth check
  if (!RECORDER_PASSPHRASE) {
    return NextResponse.json({ error: 'Server passphrase not configured' }, { status: 401 })
  }
  if (!passphrase?.trim() || passphrase.trim() !== RECORDER_PASSPHRASE.trim()) {
    return NextResponse.json({ error: 'Invalid passphrase' }, { status: 401 })
  }

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  const filename = file.name.toLowerCase()

  try {
    // Extract text from file (ZIP or raw)
    let text: string
    let fileFormat: 'hy3' | 'cl2'
    const rawBytes = Buffer.from(await file.arrayBuffer())

    if (filename.endsWith('.zip')) {
      const zip = await JSZip.loadAsync(rawBytes)
      const entries = Object.values(zip.files).filter(f => !f.dir)
      const hy3File = entries.find(f => f.name.toLowerCase().endsWith('.hy3'))
      const cl2File = entries.find(f => f.name.toLowerCase().endsWith('.cl2'))
      const target = hy3File || cl2File
      if (!target) {
        return NextResponse.json({ error: 'ZIP does not contain a .hy3 or .cl2 file' }, { status: 400 })
      }
      text = await target.async('text')
      fileFormat = target.name.toLowerCase().endsWith('.cl2') ? 'cl2' : 'hy3'
    } else if (filename.endsWith('.cl2')) {
      text = rawBytes.toString('utf-8')
      fileFormat = 'cl2'
    } else {
      text = rawBytes.toString('utf-8')
      fileFormat = 'hy3'
    }

    // Parse
    const result = fileFormat === 'cl2' ? parseCL2(text) : parseHY3(text)

    // Check for results — individual (E2) or relay (F2 with time_seconds)
    const hasRelayResults = result.teams.some(t => t.relays.some(r => r.time_seconds !== null || r.dq_check))
    if (!result.stats.hasResults && !hasRelayResults) {
      return NextResponse.json({
        error: 'This file does not contain results (no E2/F2 result records found). Please upload a results file.',
      }, { status: 400 })
    }

    // Flatten all swimmers and their events with results
    const allSwimmers = result.teams.flatMap(t =>
      t.swimmers.map(s => ({ ...s, club_code: t.short_code, club_name: t.long_name }))
    )
    const allRelays = result.teams.flatMap(t =>
      t.relays.map(r => ({ ...r, club_name: t.long_name, club_code: t.short_code }))
    )

    const sb = createServerClient()
    const nt = ntDemo(sb)

    // Fetch existing entries for this campaign
    const { data: existingEntries } = await nt.from('nt_entries')
      .select('id, member_id, event_code, result_time, result_place, result_dq')
      .eq('campaign_id', CAMPAIGN_ID)

    const entryMap = new Map<string, { id: string; result_time: number | null; result_place: number | null; result_dq: string | null }>()
    for (const e of existingEntries || []) {
      entryMap.set(`${e.member_id}:${e.event_code}`, { id: e.id, result_time: e.result_time, result_place: e.result_place, result_dq: e.result_dq })
    }

    // Regression check: count how many DB entries already have results
    const dbResultCount = (existingEntries || []).filter((e: any) => e.result_time !== null || e.result_dq).length
    const fileResultCount = result.stats.totalResults + result.stats.totalDQs
    const regressionWarning = dbResultCount > 0 && fileResultCount < dbResultCount
      ? `Warning: This file has ${fileResultCount} results but the database already has ${dbResultCount}. You may be uploading an older file. No existing results were removed.`
      : null

    // Fetch existing relays
    const { data: existingRelays } = await nt.from('nt_relays')
      .select('id, event_code, team_code, age, heat, lane, result_time, result_dq')
      .eq('campaign_id', CAMPAIGN_ID)

    // Process individual results — skip if unchanged
    let updatedEntries = 0
    let skippedEntries = 0
    let newSplits = 0
    const updateOps: Promise<any>[] = []
    const splitEntryIds: string[] = []
    const splitRows: { entry_id: string; marker: number; time: number | null }[] = []

    for (const swimmer of allSwimmers) {
      for (const evt of swimmer.events) {
        if (evt.time_seconds === null && !evt.dq_check) continue // no result
        const key = `${swimmer.member_id}:${evt.event_code}`
        const existing = entryMap.get(key)
        if (!existing) continue // entry not in DB

        // Skip result UPDATE if identical, but always collect splits
        const newPlace = evt.eventplace ? parseInt(evt.eventplace) || null : null
        const newDq = evt.dq_check || null
        const resultUnchanged = (
          existing.result_time === evt.time_seconds &&
          existing.result_place === newPlace &&
          existing.result_dq === newDq
        )

        if (resultUnchanged) {
          skippedEntries++
        } else {
          updateOps.push(
            nt.from('nt_entries').update({
              result_time: evt.time_seconds,
              result_place: newPlace,
              result_dq: newDq,
              result_heat: evt.heat || null,
              result_lane: evt.lane || null,
            }).eq('id', existing.id)
          )
          updatedEntries++
        }

        // Always collect splits (even if result unchanged — splits may be missing from prior import)
        if (evt.splits?.length > 0) {
          splitEntryIds.push(existing.id)
          for (const sp of evt.splits) {
            splitRows.push({ entry_id: existing.id, marker: sp.marker, time: sp.time })
          }
          newSplits += evt.splits.length
        }
      }
    }

    // Process relay results — skip if unchanged
    let updatedRelays = 0
    const updatedRelayIds: string[] = []
    const relayLegSplitRows: { relay_leg_id: string; marker: number; time: number | null }[] = []

    for (const relay of allRelays) {
      if (relay.time_seconds === null && !relay.dq_check) continue
      const match = (existingRelays || []).find((r: any) =>
        r.event_code === relay.event_code &&
        r.team_code === relay.club_code &&
        r.age === relay.age
      )
      if (!match) continue
      const newPlace = relay.eventplace ? parseInt(relay.eventplace) || null : null
      const newDq = relay.dq_check || null
      const relayUnchanged = match.result_time === relay.time_seconds && match.result_dq === newDq
      if (!relayUnchanged) {
        updateOps.push(
          nt.from('nt_relays').update({
            result_time: relay.time_seconds,
            result_place: newPlace,
            result_dq: newDq,
            heat: relay.heat || null,
            lane: relay.lane || null,
          }).eq('id', match.id)
        )
        updatedRelays++
      }
      // Always track relay for leg split processing (even if result unchanged)
      updatedRelayIds.push(match.id)

      // Collect ALL relay splits (recombine from parser's per-leg distribution + raw)
      // The parser's distribution is broken for non-4-split relays, so we recombine and redistribute
      const allRelaySplits: { marker: number; time: number | null }[] = []
      if (relay.legs) {
        for (const leg of relay.legs) {
          if (leg.splits) allRelaySplits.push(...leg.splits)
        }
      }
      // Also check for raw undistributed splits (parser preserves these when legs.length !== 4)
      if ((relay as any).splits) {
        allRelaySplits.push(...(relay as any).splits)
      }
      // Deduplicate by marker (same marker from both sources)
      const seenMarkers = new Set<number>()
      const dedupedSplits = allRelaySplits
        .sort((a, b) => a.marker - b.marker)
        .filter(s => { if (seenMarkers.has(s.marker)) return false; seenMarkers.add(s.marker); return true })

      if (dedupedSplits.length > 0) {
        // Calculate how many split markers correspond to each leg
        const courseLength = (result.meet.course === 'L') ? 50 : 25
        const splitsPerLeg = relay.leg_distance ? Math.round(relay.leg_distance / courseLength) : 1

        // Redistribute by marker range: leg N gets markers ((N-1)*spl+1) to (N*spl)
        const redistributedLegs = [1, 2, 3, 4].map((legNum) => {
          const startMarker = (legNum - 1) * splitsPerLeg
          const endMarker = legNum * splitsPerLeg
          const legSplits = dedupedSplits.filter(s => s.marker > startMarker && s.marker <= endMarker)
          // Last leg also gets any remaining splits beyond 4*splitsPerLeg
          if (legNum === 4) {
            const extra = dedupedSplits.filter(s => s.marker > 4 * splitsPerLeg)
            legSplits.push(...extra)
          }
          return { leg: legNum, splits: legSplits }
        })

        ;(match as any)._parsedLegs = redistributedLegs
      }
    }

    // Execute all updates (batches of 25)
    for (let i = 0; i < updateOps.length; i += 25) {
      await Promise.all(updateOps.slice(i, i + 25))
    }

    // Delete old splits for updated entries, then insert new
    if (splitEntryIds.length > 0) {
      for (let i = 0; i < splitEntryIds.length; i += 50) {
        const batch = splitEntryIds.slice(i, i + 50)
        await nt.from('nt_splits').delete().in('entry_id', batch)
      }
      for (let i = 0; i < splitRows.length; i += 250) {
        const batch = splitRows.slice(i, i + 250)
        await nt.from('nt_splits').insert(batch)
      }
    }

    // Process relay leg splits
    let newRelayLegSplits = 0
    if (updatedRelayIds.length > 0) {
      // Fetch all legs for updated relays
      const allDbLegs: any[] = []
      for (let i = 0; i < updatedRelayIds.length; i += 50) {
        const batch = updatedRelayIds.slice(i, i + 50)
        const { data: legs } = await nt.from('nt_relay_legs')
          .select('id, relay_id, leg_number')
          .in('relay_id', batch)
        if (legs) allDbLegs.push(...legs)
      }

      // Build map: relay_id -> legs sorted by leg_number
      const dbLegsByRelay = new Map<string, any[]>()
      for (const leg of allDbLegs) {
        if (!dbLegsByRelay.has(leg.relay_id)) dbLegsByRelay.set(leg.relay_id, [])
        dbLegsByRelay.get(leg.relay_id)!.push(leg)
      }

      // Delete old relay leg splits
      const allLegIds = allDbLegs.map(l => l.id)
      if (allLegIds.length > 0) {
        for (let i = 0; i < allLegIds.length; i += 50) {
          const batch = allLegIds.slice(i, i + 50)
          await nt.from('nt_splits').delete().in('relay_leg_id', batch)
        }
      }

      // Match parsed legs to DB legs and insert splits
      for (const relay of allRelays) {
        const match = (existingRelays || []).find((r: any) =>
          r.event_code === relay.event_code &&
          r.team_code === relay.club_code &&
          r.age === relay.age
        )
        if (!match || !(match as any)._parsedLegs) continue

        const dbLegs = dbLegsByRelay.get(match.id) || []
        const parsedLegs = (match as any)._parsedLegs as any[]

        for (const parsedLeg of parsedLegs) {
          if (!parsedLeg.splits || parsedLeg.splits.length === 0) continue
          // Match by leg_number
          const dbLeg = dbLegs.find((dl: any) => dl.leg_number === parsedLeg.leg)
          if (!dbLeg) continue

          for (const sp of parsedLeg.splits) {
            relayLegSplitRows.push({
              relay_leg_id: dbLeg.id,
              marker: sp.marker,
              time: sp.time,
            })
          }
        }
      }

      if (relayLegSplitRows.length > 0) {
        for (let i = 0; i < relayLegSplitRows.length; i += 250) {
          const batch = relayLegSplitRows.slice(i, i + 250)
          await nt.from('nt_splits').insert(batch)
        }
        newRelayLegSplits = relayLegSplitRows.length
      }
    }

    // Update campaign has_results flag
    if (updatedEntries > 0 || updatedRelays > 0) {
      await nt.from('nt_campaigns').update({ has_results: true }).eq('id', CAMPAIGN_ID)
    }

    // Log to import history (only if something changed)
    if (updatedEntries > 0 || updatedRelays > 0) {
      await nt.from('nt_import_history').insert({
        campaign_id: CAMPAIGN_ID,
        filename: file.name,
        file_format: fileFormat,
        import_type: 'results',
        swimmers_count: result.stats.totalSwimmers,
        entries_count: result.stats.totalIndividualEntries,
        nts_found: result.stats.totalNTs,
      }).then(() => {}).catch(() => {}) // non-blocking
    }

    // Build warnings list
    const warnings = [...result.warnings]
    if (regressionWarning) warnings.unshift(regressionWarning)

    return NextResponse.json({
      success: true,
      summary: {
        filename: file.name,
        format: fileFormat.toUpperCase(),
        swimmers: result.stats.totalSwimmers,
        entries: result.stats.totalIndividualEntries,
        results: result.stats.totalResults,
        dqs: result.stats.totalDQs,
        relays: result.stats.totalRelays,
        updatedEntries,
        updatedRelays,
        skippedEntries,
        newSplits,
        newRelayLegSplits,
        warnings,
        regressionWarning: regressionWarning || null,
      },
    })
  } catch (err: any) {
    console.error('[RECORDER UPLOAD] Error:', err)
    return NextResponse.json({ error: `Import failed: ${err.message}` }, { status: 500 })
  }
}
