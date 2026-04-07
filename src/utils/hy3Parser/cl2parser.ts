// CL2 Parser — Hy-Tek Win Meet Manager 8.0+ "Meet Results" format
//
// CL2 is self-contained: every D0 record has the swimmer's name, member ID, DOB
// inline. No key-based cross-referencing needed (unlike HY3).
//
// Outputs the same HY3ParseResult type for UI compatibility.

import type {
  HY3ParseResult,
  HY3Meet,
  HY3Team,
  HY3Swimmer,
  HY3SwimmerEvent,
  HY3Relay,
  HY3RelayLeg,
  HY3Split,
  HY3ParseStats,
} from './types';
import { cl2CodeToHY3 } from './eventCodes';

// ── Utilities ───────────────────────────────────────────────────────────

/** CL2 uses 0-indexed positions in docs. This helper uses 0-indexed start/end (inclusive). */
function cl2Slice(line: string, start: number, end: number): string {
  return line.substring(start, end + 1);
}

function computeAgeGroup(age: number): string {
  if (age >= 18 && age <= 24) return '18-24';
  const low = Math.floor(age / 5) * 5;
  return `${low}-${low + 4}`;
}

function parseCL2Date(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.length < 8) return null;
  // MMDDYYYY → YYYY-MM-DD
  return `${trimmed.substring(4, 8)}-${trimmed.substring(0, 2)}-${trimmed.substring(2, 4)}`;
}

/** Parse CL2 time string like "  14.29S", " 1:23.45L", "DQS", "DQL", "NSS" */
function parseCL2Time(raw: string): {
  time: number | null;
  course: 'S' | 'L' | null;
  isDQ: boolean;
  isNS: boolean;
} {
  const trimmed = raw.trim();
  if (!trimmed) return { time: null, course: null, isDQ: false, isNS: false };

  // DQ detection: "DQS" or "DQL"
  if (/^DQ[SL]?$/i.test(trimmed)) {
    const course = trimmed.toUpperCase().endsWith('S') ? 'S' :
                   trimmed.toUpperCase().endsWith('L') ? 'L' : null;
    return { time: null, course, isDQ: true, isNS: false };
  }

  // NS detection: "NSS" or "NSL" or "NS"
  if (/^NS[SL]?$/i.test(trimmed)) {
    const course = trimmed.toUpperCase().endsWith('S') ? 'S' :
                   trimmed.toUpperCase().endsWith('L') ? 'L' : null;
    return { time: null, course, isDQ: false, isNS: true };
  }

  // Extract course suffix
  let course: 'S' | 'L' | null = null;
  let timeStr = trimmed;
  if (/[SL]$/i.test(timeStr)) {
    course = timeStr.slice(-1).toUpperCase() as 'S' | 'L';
    timeStr = timeStr.slice(0, -1).trim();
  }

  // Parse time: "1:23.45" or "23.45"
  let seconds: number | null = null;
  if (timeStr.includes(':')) {
    const parts = timeStr.split(':');
    const mins = parseInt(parts[0], 10);
    const secs = parseFloat(parts[1]);
    if (!isNaN(mins) && !isNaN(secs)) {
      seconds = mins * 60 + secs;
    }
  } else {
    const t = parseFloat(timeStr);
    if (!isNaN(t)) seconds = t;
  }

  return { time: seconds, course, isDQ: false, isNS: false };
}

/** Parse a CL2 swimmer name field "Smith, John Andrew" → { surname, given_name } */
function parseName(raw: string): { surname: string; given_name: string } {
  const trimmed = raw.trim();
  const commaIdx = trimmed.indexOf(',');
  if (commaIdx === -1) return { surname: trimmed, given_name: '' };
  return {
    surname: trimmed.substring(0, commaIdx).trim(),
    given_name: trimmed.substring(commaIdx + 1).trim(),
  };
}

// ── Main Parser ─────────────────────────────────────────────────────────

export function parseCL2(text: string): HY3ParseResult {
  const lines = text.split(/\r?\n/);
  const warnings: string[] = [];

  const meet: HY3Meet = {
    name: '',
    location: '',
    start_date: '',
    end_date: '',
  };

  // Track teams by short code
  const teamMap = new Map<string, HY3Team>();
  const teamOrder: string[] = [];

  // Track swimmers by team+memberId to avoid duplicates
  const swimmerIndex = new Map<string, HY3Swimmer>();

  // Relay tracking
  let currentRelayClub: string | null = null;
  let currentRelay: HY3Relay | null = null;
  let legIndex = 0;

  // Stats
  let totalSplits = 0;
  let totalNTs = 0;
  let totalDQs = 0;
  let totalNSs = 0;
  let totalResults = 0;
  let linesParsed = 0;

  // Track last D0 event for G0 split attachment
  let lastD0Event: HY3SwimmerEvent | null = null;

  for (const line of lines) {
    if (!line || line.length < 2) continue;
    linesParsed++;

    const recordType = line.substring(0, 2);

    switch (recordType) {
      // ── A0: File header ────────────────────────────────────────────
      case 'A0':
        // Not much useful beyond validation
        break;

      // ── B1: Meet info ──────────────────────────────────────────────
      // CL2 B1: pos 2 = format version, 3-10 = padding
      // Pos 11-40 = meet name, 41-62 = location/venue
      // Pos 121-128 = start date, 129-136 = end date, 149 = course
      case 'B1': {
        meet.name = cl2Slice(line, 11, 40).trim();
        meet.location = cl2Slice(line, 41, 62).trim();
        const startRaw = cl2Slice(line, 121, 128).trim();
        const endRaw = cl2Slice(line, 129, 136).trim();
        meet.start_date = parseCL2Date(startRaw) || '';
        meet.end_date = parseCL2Date(endRaw) || '';
        if (line.length > 149) {
          const courseChar = line.charAt(149);
          if (courseChar === 'S' || courseChar === 'L') {
            meet.course = courseChar;
          }
        }
        break;
      }

      // ── C1: Club/Team ──────────────────────────────────────────────
      case 'C1': {
        const shortCode = cl2Slice(line, 13, 15).trim();
        const longName = cl2Slice(line, 17, 46).trim();
        if (shortCode && !teamMap.has(shortCode)) {
          const team: HY3Team = {
            short_code: shortCode,
            long_name: longName,
            swimmers: [],
            relays: [],
          };
          teamMap.set(shortCode, team);
          teamOrder.push(shortCode);
        }
        break;
      }

      // ── D3: Swimmer roster (skip — D0 has all data inline) ─────────
      case 'D3':
        break;

      // ── D0: Individual entry/result ────────────────────────────────
      case 'D0': {
        lastD0Event = null;
        const nameRaw = cl2Slice(line, 3, 38);
        const { surname, given_name } = parseName(nameRaw);
        const memberId = cl2Slice(line, 39, 44).trim();
        const dobRaw = cl2Slice(line, 55, 62).trim();
        const ageRaw = cl2Slice(line, 63, 64).trim();
        const gender = cl2Slice(line, 65, 65).trim();

        let age = parseInt(ageRaw, 10);
        if (isNaN(age)) age = 0;
        if (ageRaw === '00') age = 100;
        else if (age < 10 && age > 0) age += 100;

        const ageGroup = computeAgeGroup(age);

        // Event data
        const cl2EventCode = cl2Slice(line, 68, 72).trim();
        const hy3EventCode = cl2CodeToHY3(cl2EventCode);
        const statusMarker = cl2Slice(line, 76, 79).trim();
        const eventDateRaw = cl2Slice(line, 80, 87).trim();
        const seedRaw = cl2Slice(line, 88, 96);
        const resultRaw = cl2Slice(line, 118, 125);
        const heatRaw = cl2Slice(line, 130, 131).trim();
        const laneRaw = line.length > 137 ? cl2Slice(line, 137, 137).trim() : '';
        const placeRaw = line.length > 141 ? cl2Slice(line, 139, 141).trim() : '';

        const seed = parseCL2Time(seedRaw);
        const result = parseCL2Time(resultRaw);

        // Determine team — memberId often starts with state code like "QLD"
        // We need to find which team this swimmer belongs to.
        // CL2 D0 doesn't have a club code field. We infer from the most recent C1.
        // Actually, D0 records are grouped by club in CL2 files (after their C1).
        // Use the last C1 club code as the team.
        let teamCode = teamOrder[teamOrder.length - 1] || '';

        // Ensure team exists
        if (!teamMap.has(teamCode)) {
          const team: HY3Team = {
            short_code: teamCode || 'UNK',
            long_name: 'Unknown',
            swimmers: [],
            relays: [],
          };
          teamMap.set(teamCode || 'UNK', team);
          if (teamCode) teamOrder.push(teamCode);
          else { teamCode = 'UNK'; teamOrder.push('UNK'); }
        }

        const team = teamMap.get(teamCode)!;

        // Find or create swimmer
        const swimmerKey = `${teamCode}-${memberId}`;
        let swimmer = swimmerIndex.get(swimmerKey);
        if (!swimmer) {
          swimmer = {
            key: swimmerKey,
            surname,
            given_name,
            member_id: memberId,
            gender,
            age,
            age_group: ageGroup,
            dob: dobRaw || undefined,
            events: [],
          };
          swimmerIndex.set(swimmerKey, swimmer);
          team.swimmers.push(swimmer);
        }

        // Build seed time string
        let seedTimeStr: string | undefined;
        if (seed.time !== null) {
          seedTimeStr = seedRaw.trim();
        }

        // NT detection from seed
        const isNT = seed.time === null || seed.time === 0;
        if (isNT) totalNTs++;

        const event: HY3SwimmerEvent = {
          event_code: hy3EventCode,
          event_number: '',
          seed_time: seedTimeStr,
          time_seconds: result.time,
          course: result.course || seed.course || (meet.course ?? null),
          points: null,
          date: parseCL2Date(eventDateRaw),
          splits: [],
          dq_check: result.isDQ ? 'Q' : result.isNS ? 'R' : undefined,
          is_nt: isNT,
          nt_course: seed.course ?? undefined,
          // UNOV appears on all CL2 records — it means "unofficial" not exhibition
          exh_check: undefined,
          heat: heatRaw || undefined,
          lane: laneRaw || undefined,
          eventplace: placeRaw ? String(parseInt(placeRaw, 10)) : undefined,
        };

        swimmer.events.push(event);
        lastD0Event = event;

        if (result.isDQ) totalDQs++;
        if (result.isNS) totalNSs++;
        if (result.time !== null) totalResults++;
        break;
      }

      // ── G0: Cumulative splits ──────────────────────────────────────
      case 'G0': {
        if (!lastD0Event) break;

        // Position 57 = split count, 60-62 = split config (e.g. "25C")
        const splitCountRaw = line.length > 57 ? line[57] : '';
        const splitCount = parseInt(splitCountRaw, 10) || 0;

        // Parse split times from position 64 onwards, 8-char fixed-width chunks
        const splitsStr = line.substring(64);
        const splits: HY3Split[] = [];

        for (let i = 0; i < splitCount && i * 8 < splitsStr.length; i++) {
          const chunk = splitsStr.substring(i * 8, (i + 1) * 8).trim();
          if (!chunk) continue;
          const parsed = parseCL2Time(chunk);
          splits.push({
            marker: i + 1,
            time: parsed.time,
          });
        }

        if (splits.length > 0) {
          totalSplits += splits.length;
          lastD0Event.splits.push(...splits);
        }
        break;
      }

      // ── E0: Relay result ───────────────────────────────────────────
      case 'E0': {
        lastD0Event = null;
        const relayLetter = line.length > 9 ? cl2Slice(line, 9, 9).trim() : '';
        const clubCode = cl2Slice(line, 12, 14).trim();
        const genderChar = line.length > 18 ? cl2Slice(line, 18, 18).trim() : '';
        const resultRaw = line.length > 82 ? cl2Slice(line, 72, 82) : '';
        const heatRaw = line.length > 89 ? cl2Slice(line, 88, 89).trim() : '';

        const result = parseCL2Time(resultRaw);

        const eventGender =
          genderChar === 'F' ? 'Female' :
          genderChar === 'M' ? 'Male' :
          genderChar === 'X' ? 'Mixed' :
          undefined;

        // Ensure team exists
        if (clubCode && !teamMap.has(clubCode)) {
          const team: HY3Team = {
            short_code: clubCode,
            long_name: clubCode,
            swimmers: [],
            relays: [],
          };
          teamMap.set(clubCode, team);
          teamOrder.push(clubCode);
        }

        currentRelayClub = clubCode;
        currentRelay = {
          team_short_code: clubCode,
          age: '',
          event_type: genderChar,
          event_code: '', // will be populated if we find event info
          event_gender: eventGender,
          r_score: '',
          exh_check: '',
          legs: [],
          time_seconds: result.time,
          course: result.course || (meet.course ?? null),
          date: null,
          dq_check: result.isDQ ? 'Q' : result.isNS ? 'R' : undefined,
          heat: heatRaw || undefined,
        };
        legIndex = 0;

        if (clubCode) {
          teamMap.get(clubCode)!.relays.push(currentRelay);
        }

        if (result.isDQ) totalDQs++;
        if (result.isNS) totalNSs++;
        break;
      }

      // ── F0: Relay leg ──────────────────────────────────────────────
      case 'F0': {
        if (!currentRelay) break;
        lastD0Event = null;

        const clubCode = cl2Slice(line, 15, 17).trim();
        const nameRaw = cl2Slice(line, 20, 49);
        const { surname, given_name } = parseName(nameRaw);
        const memberId = cl2Slice(line, 50, 55).trim();
        const ageRaw = line.length > 74 ? cl2Slice(line, 73, 74).trim() : '';

        let age = parseInt(ageRaw, 10);
        if (isNaN(age)) age = 0;

        legIndex++;
        const leg: HY3RelayLeg = {
          key: `${clubCode}-${memberId}`,
          leg: legIndex,
          member_id: memberId || null,
          surname: surname || null,
          given_name: given_name || null,
          age: age || null,
          age_group: age ? computeAgeGroup(age) : null,
          splits: [],
        };

        currentRelay.legs.push(leg);
        break;
      }

      // ── Z0: Summary footer ─────────────────────────────────────────
      case 'Z0':
        // Could validate counts against parsed totals
        break;

      default:
        break;
    }
  }

  // ── Build output ──────────────────────────────────────────────────────
  const teams = teamOrder.map(code => teamMap.get(code)!);

  let totalSwimmers = 0;
  let totalEntries = 0;
  let totalRelays = 0;
  for (const team of teams) {
    totalSwimmers += team.swimmers.length;
    for (const swimmer of team.swimmers) {
      totalEntries += swimmer.events.length;
    }
    totalRelays += team.relays.length;
  }

  const stats: HY3ParseStats = {
    totalTeams: teams.length,
    totalSwimmers,
    totalIndividualEntries: totalEntries,
    totalRelays,
    totalSplits,
    totalNTs,
    totalDQs,
    totalNSs,
    totalResults,
    hasResults: totalResults > 0,
    linesParsed,
  };

  return { meet, teams, warnings, stats, fileType: 'unknown' as const };
}
