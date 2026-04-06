// Unified HY3 Parser
// Consolidates: Admin (hy3parser.ts), NT Portal (hy3Parser.ts), Multi-Class (hy3Parser.ts)
//
// Features from Admin:   E2 results, G1 splits, DQ detection, relay leg resolution
// Features from NT:      NT detection, course detection from meet name, swimmer number indexing
// Features from Multi:   (same as Admin — they were copies)

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

// ── Utilities ───────────────────────────────────────────────────────────

function sliceFixed(str: string, start: number, end: number): string {
  return str.substring(start - 1, end);
}

function computeAgeGroup(age: number): string {
  if (age >= 18 && age <= 24) return '18-24';
  const low = Math.floor(age / 5) * 5;
  return `${low}-${low + 4}`;
}

/** Normalize HY3 relay/event gender codes to canonical strings.
 * Handles E1 2-char codes (MM, FW, FF, XF, XM, XX) and
 * F1 3-char codes (FFF, FFW, MMM, MMW, XXX) from all MM5 versions.
 * Uses first-character match — future MM5 variants handled automatically. */
function normalizeGenderCode(code: string): 'Male' | 'Female' | 'Mixed' | undefined {
  const c = code.trim().toUpperCase();
  if (!c) return undefined;
  if (c[0] === 'F') return 'Female';
  if (c[0] === 'M') return 'Male';
  if (c[0] === 'X') return 'Mixed';
  return undefined;
}

/** Detect NT from an E1 line (from NT Portal) */
function detectNT(line: string): { isNT: boolean; course: 'S' | 'L' | null } {
  if (/\bNTS\b/.test(line)) return { isNT: true, course: 'S' };
  if (/\bNTL\b/.test(line)) return { isNT: true, course: 'L' };
  if (/\b0\.00S\b/.test(line)) return { isNT: true, course: 'S' };
  if (/\b0\.00L\b/.test(line)) return { isNT: true, course: 'L' };
  return { isNT: false, course: null };
}

/** Detect course from meet name (from NT Portal) */
function detectCourseFromName(name: string): 'S' | 'L' | undefined {
  const upper = name.toUpperCase();
  if (upper.includes(' LC ') || upper.includes('LONG COURSE')) return 'L';
  if (upper.includes(' SC ') || upper.includes('SHORT COURSE')) return 'S';
  return undefined;
}

// ── Main Parser ─────────────────────────────────────────────────────────

export function parseHY3(text: string): HY3ParseResult {
  const lines = text.split(/\r?\n/);
  const warnings: string[] = [];

  const meet: HY3Meet = {
    name: '',
    location: '',
    start_date: '',
    end_date: '',
  };
  const teams: HY3Team[] = [];

  let currentTeam: HY3Team | null = null;
  let currentRelay: HY3Relay | null = null;
  let currentEvent: HY3SwimmerEvent | null = null;
  let swimmerMap: Record<string, HY3Swimmer> = {};
  let pendingLegs: Record<string, HY3RelayLeg[]> = {};
  let g1Buffer: HY3Split[] = [];

  // Stats tracking
  let totalSplits = 0;
  let totalNTs = 0;
  let totalDQs = 0;
  let totalNSs = 0;
  let totalResults = 0;
  let linesParsed = 0;

  for (const line of lines) {
    if (!line) continue;
    linesParsed++;

    const recordType = line.charAt(0);
    const subType = line.charAt(1);

    switch (recordType) {
      // ── B1: Meet info ──────────────────────────────────────────────
      case 'B':
        if (subType === '1') {
          const eventName = sliceFixed(line, 3, 47).trim();
          const location = sliceFixed(line, 48, 92).trim();
          const startDateRaw = sliceFixed(line, 93, 100).trim();
          const endDateRaw = sliceFixed(line, 101, 108).trim();
          const toIso = (raw: string): string => {
            if (raw.length < 8) return '';
            return `${raw.substring(4, 8)}-${raw.substring(0, 2)}-${raw.substring(2, 4)}`;
          };
          meet.name = eventName;
          meet.location = location;
          meet.start_date = toIso(startDateRaw);
          meet.end_date = toIso(endDateRaw);
          meet.course = detectCourseFromName(eventName);
        }
        break;

      // ── C1: Club/Team ──────────────────────────────────────────────
      case 'C':
        if (subType === '1') {
          const shortCode = sliceFixed(line, 3, 5).trim();
          const longName = sliceFixed(line, 6, 37).trim();
          currentTeam = {
            short_code: shortCode,
            long_name: longName,
            swimmers: [],
            relays: [],
          };
          teams.push(currentTeam);
          swimmerMap = {};
        }
        break;

      // ── D1: Swimmer ────────────────────────────────────────────────
      case 'D':
        if (subType === '1' && currentTeam) {
          const key = sliceFixed(line, 4, 13);
          const surname = sliceFixed(line, 9, 28).trim();
          const givenName = sliceFixed(line, 29, 60).trim();
          const memberID = sliceFixed(line, 70, 84).trim();
          const gender = sliceFixed(line, 3, 3).trim();
          const ageRaw = sliceFixed(line, 97, 99).trim();

          // Age handling: 00 = 100, < 10 = 100+
          let age = parseInt(ageRaw, 10);
          if (ageRaw === '00') {
            age = 100;
          } else if (!isNaN(age) && age < 10) {
            age += 100;
          }

          const ageGroup = computeAgeGroup(age);

          // Extract swimmer number (from NT Portal)
          const numMatch = line.match(/^D1[MF]\s+(\d{1,4})/);
          const swimmerNumber = numMatch?.[1];

          // Extract DOB if present
          const dobMatch = line.match(/\b((?:19|20)\d{6})\b/);
          const dob = dobMatch?.[1];

          const swimmer: HY3Swimmer = {
            key,
            swimmer_number: swimmerNumber,
            surname,
            given_name: givenName,
            member_id: memberID,
            gender,
            age,
            age_group: ageGroup,
            dob,
            events: [],
          };
          currentEvent = null;
          currentTeam.swimmers.push(swimmer);
          swimmerMap[key] = swimmer;

          // Resolve any pending relay legs for this swimmer
          if (pendingLegs[key]) {
            for (const leg of pendingLegs[key]) {
              leg.member_id = memberID;
              leg.surname = surname;
              leg.given_name = givenName;
              leg.age = age;
              leg.age_group = ageGroup;
            }
            delete pendingLegs[key];
          }
        }
        break;

      // ── E1/E2: Individual entries and results ──────────────────────
      case 'E':
        currentRelay = null;
        if (subType === '1') {
          const key = sliceFixed(line, 4, 13);
          const eventCode = sliceFixed(line, 16, 22).trim();
          const genderCode = sliceFixed(line, 14, 15).trim();
          const eventGender = normalizeGenderCode(genderCode);
          const seedtime = sliceFixed(line, 52, 60).trim();
          const eventNum = sliceFixed(line, 40, 42).trim(); // 3 chars: covers 1-pos shift between entry-only vs results files
          const pointsStr = sliceFixed(line, 64, 68).trim();
          const judgePts = sliceFixed(line, 72, 76).trim();
          const swimmer = swimmerMap[key];

          // NT detection (from NT Portal)
          const ntInfo = detectNT(line);
          if (ntInfo.isNT) totalNTs++;

          // Parse seed time string to seconds (E2 result will overwrite if present)
          const seedParsed = parseFloat(seedtime);
          const seedSecs = Number.isNaN(seedParsed) || seedParsed === 0 ? null : seedParsed;

          if (swimmer) {
            currentEvent = {
              event_code: eventCode,
              seed_time: seedtime,
              event_number: eventNum,
              event_gender: eventGender,
              time_seconds: ntInfo.isNT ? null : seedSecs,
              course: null,
              points: parseFloat(pointsStr) || null,
              judgepoints: parseFloat(judgePts) || null,
              exh_check: sliceFixed(line, 84, 84).trim(),
              date: null,
              splits: [],
              is_nt: ntInfo.isNT,
              nt_course: ntInfo.course ?? undefined,
            };
            swimmer.events.push(currentEvent);
          } else {
            currentEvent = null;
            if (key.trim()) {
              warnings.push(`E1: swimmer key "${key.trim()}" not found in D1 records`);
            }
          }
          g1Buffer = [];
        } else if (subType === '2' && currentEvent) {
          // E2: Result line
          const timeRaw = sliceFixed(line, 6, 12).trim();
          const course = sliceFixed(line, 12, 12).trim();
          const dqCheck = sliceFixed(line, 13, 13).trim();
          const heat = sliceFixed(line, 21, 23).trim();
          const lane = sliceFixed(line, 24, 26).trim();
          const heatPlace = sliceFixed(line, 28, 29).trim();
          const eventPlacing = sliceFixed(line, 32, 33).trim();
          const judgePlacing = sliceFixed(line, 122, 124).trim();
          const dateRaw = sliceFixed(line, 88, 95).trim();
          const date = dateRaw.length >= 8
            ? `${dateRaw.substring(4, 8)}-${dateRaw.substring(0, 2)}-${dateRaw.substring(2, 4)}`
            : null;

          const t = parseFloat(timeRaw);
          currentEvent.time_seconds = Number.isNaN(t) ? null : t;
          currentEvent.course = course || currentEvent.course;
          currentEvent.date = date;
          currentEvent.dq_check = dqCheck;
          currentEvent.heat = heat || undefined;
          currentEvent.lane = lane || undefined;
          currentEvent.heatplace = heatPlace || undefined;
          currentEvent.eventplace = eventPlacing || undefined;
          currentEvent.judgeplace = judgePlacing || undefined;

          if (dqCheck === 'Q') totalDQs++;
          if (dqCheck === 'R') totalNSs++;
          if (currentEvent.time_seconds !== null) totalResults++;
        }
        break;

      // ── F1/F2/F3: Relays ──────────────────────────────────────────
      case 'F': {
        const recType = subType;
        currentEvent = null;

        if (recType === '1' && currentTeam) {
          // Flush any pending G1 splits
          if (g1Buffer.length > 0 && currentRelay) {
            (currentRelay as any).splits = [...g1Buffer];
          }
          g1Buffer = [];

          const genderCode = sliceFixed(line, 13, 15).trim();
          const eventGender = normalizeGenderCode(genderCode);
          const eventCode = sliceFixed(line, 19, 22).trim();
          const eventNum = sliceFixed(line, 40, 42).trim(); // 3 chars: covers 1-pos shift between entry-only vs results files
          const pointsStr = sliceFixed(line, 62, 68).trim();
          const judgePts = sliceFixed(line, 70, 76).trim();
          const eventLegs = parseInt(sliceFixed(line, 85, 85).trim()) || undefined;

          const distanceMatch = eventCode.match(/^(\d+)/);
          const totalDistance = distanceMatch ? parseInt(distanceMatch[1]) : null;
          const legDistance = (totalDistance && eventLegs) ? totalDistance / eventLegs : undefined;

          currentRelay = {
            team_short_code: sliceFixed(line, 3, 5).trim(),
            age: sliceFixed(line, 9, 12).trim(),
            event_type: sliceFixed(line, 13, 15).trim(),
            event_code: eventCode,
            event_number: eventNum,
            event_gender: eventGender,
            event_legs: eventLegs,
            leg_distance: legDistance,
            r_score: sliceFixed(line, 62, 68).trim(),
            points: parseFloat(pointsStr) || null,
            judgepoints: parseFloat(judgePts) || null,
            exh_check: sliceFixed(line, 84, 84).trim(),
            legs: [],
            time_seconds: null,
            course: null,
            date: null,
          };
          currentTeam.relays.push(currentRelay);
          break;
        }

        const relay = currentTeam?.relays[currentTeam.relays.length - 1];
        if (!relay) break;

        if (recType === '2') {
          // F2: Relay result
          const timeRaw = sliceFixed(line, 5, 11).trim();
          const course = sliceFixed(line, 12, 12).trim();
          const dqCheck = sliceFixed(line, 13, 13).trim();
          const heat = sliceFixed(line, 21, 23).trim();
          const lane = sliceFixed(line, 24, 26).trim();
          const heatPlace = sliceFixed(line, 28, 29).trim();
          const eventPlacing = sliceFixed(line, 32, 33).trim();
          const judgePlacing = sliceFixed(line, 122, 124).trim();
          const dateRaw = sliceFixed(line, 103, 110).trim();
          const t = parseFloat(timeRaw.replace(/[^\d.]/g, ''));
          if (!Number.isNaN(t) && relay.time_seconds == null) relay.time_seconds = t;
          if (course && !relay.course) relay.course = course;
          if (dateRaw.length === 8) {
            relay.date = `${dateRaw.slice(4, 8)}-${dateRaw.slice(0, 2)}-${dateRaw.slice(2, 4)}`;
          }
          relay.dq_check = dqCheck;
          relay.heat = heat || undefined;
          relay.lane = lane || undefined;
          relay.heatplace = heatPlace || undefined;
          relay.eventplace = eventPlacing || undefined;
          relay.judgeplace = judgePlacing || undefined;
          if (dqCheck === 'Q') totalDQs++;
          if (dqCheck === 'R') totalNSs++;
          break;
        }

        if (recType === '3') {
          // F3: Relay leg swimmers
          const offsets = [
            { keyStart: 4, keyEnd: 13, legCol: 15 },
            { keyStart: 17, keyEnd: 26, legCol: 28 },
            { keyStart: 30, keyEnd: 39, legCol: 41 },
            { keyStart: 43, keyEnd: 52, legCol: 54 },
          ];

          relay.legs = offsets.map(({ keyStart, keyEnd, legCol }) => {
            const swimmerKey = sliceFixed(line, keyStart, keyEnd);
            const legStr = sliceFixed(line, legCol, legCol);
            const legNum = parseInt(legStr, 10) || null;
            const swimmer = swimmerMap[swimmerKey];

            const legObj: HY3RelayLeg = {
              key: swimmerKey,
              leg: legNum,
              member_id: swimmer?.member_id || null,
              surname: swimmer?.surname || null,
              given_name: swimmer?.given_name || null,
              age: swimmer?.age || null,
              age_group: swimmer?.age_group || null,
              splits: [],
            };

            if (!swimmer) {
              if (!pendingLegs[swimmerKey]) pendingLegs[swimmerKey] = [];
              pendingLegs[swimmerKey].push(legObj);
            }

            return legObj;
          });
          break;
        }

        break;
      }

      // ── G1: Splits ────────────────────────────────────────────────
      case 'G':
        if (subType === '1') {
          const payload = line.slice(2);
          const sections: string[] = [];
          for (let i = 0; i + 11 <= payload.length; i += 11) {
            sections.push(payload.slice(i, i + 11));
          }

          const splits: HY3Split[] = [];
          for (const sec of sections) {
            if (sec[0] !== 'F') continue;
            const marker = parseInt(sec.slice(1, 3), 10);
            const timeStr = sec.slice(3, 11).trim();
            if (!Number.isFinite(marker) || !timeStr) continue;
            const time = parseFloat(timeStr);
            splits.push({ marker, time: Number.isNaN(time) ? null : time });
          }

          if (splits.length > 0) {
            totalSplits += splits.length;
            if (currentEvent) {
              if (!currentEvent.splits) currentEvent.splits = [];
              currentEvent.splits.push(...splits);
            } else if (currentRelay) {
              if (!(currentRelay as any).splits) (currentRelay as any).splits = [];
              (currentRelay as any).splits.push(...splits);
            }
          }

          g1Buffer.push(...splits);
        }
        break;

      default:
        break;
    }
  }

  // ── Post-processing: distribute relay splits to legs ────────────────
  // Ceil-based equal-group distribution on sorted marker ORDER.
  // Works for all step sizes (1, 2, 4) regardless of course/venue.
  for (const team of teams) {
    for (const relay of team.relays) {
      if (!(relay as any).splits?.length || relay.legs.length === 0) continue;

      const sorted = ((relay as any).splits as HY3Split[]).sort((a, b) => a.marker - b.marker);
      const legCount = relay.legs.length;
      const perLeg = Math.ceil(sorted.length / legCount);

      for (let i = 0; i < legCount; i++) {
        const start = i * perLeg;
        const end = Math.min(start + perLeg, sorted.length);
        relay.legs[i].splits = sorted.slice(start, end);
      }

      delete (relay as any).splits;
    }
  }

  // ── Build stats ────────────────────────────────────────────────────
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

  return { meet, teams, warnings, stats };
}
