// Unified HY3 type definitions
// Merged from: Admin (hy3.ts), NT Portal (hy3Parser.ts), Multi-Class (hy3.ts)

// ── Meet ────────────────────────────────────────────────────────────────

export interface HY3Meet {
  name: string;
  location: string;
  start_date: string;       // ISO YYYY-MM-DD
  end_date: string;         // ISO YYYY-MM-DD
  course?: 'S' | 'L';       // from NT Portal: detected from meet name
}

// ── Splits ──────────────────────────────────────────────────────────────

export interface HY3Split {
  marker: number;
  time: number | null;
}

// ── Swimmer Events (E1/E2 records) ──────────────────────────────────────

export interface HY3SwimmerEvent {
  event_code: string;
  event_number: string;
  event_gender?: string;     // 'Male' | 'Female' | 'Mixed'
  seed_time?: string;        // raw seed time string
  time_seconds: number | null;  // from E2 result line
  course: string | null;     // 'S' | 'L' from E2
  points: number | null;
  judgepoints?: number | null;
  exh_check?: string;        // non-empty if exhibition
  date: string | null;       // ISO from E2
  splits: HY3Split[];
  // DQ detection (from E2 pos 13)
  dq_check?: string;         // 'Q' = DQ, 'R' = NS/No Show
  // Heat/lane/placing (from E2)
  heat?: string;
  lane?: string;
  heatplace?: string;
  eventplace?: string;
  judgeplace?: string;
  // NT detection (from NT Portal)
  is_nt?: boolean;
  nt_course?: 'S' | 'L';
}

// ── Swimmers (D1 records) ───────────────────────────────────────────────

export interface HY3Swimmer {
  key: string;               // internal Hy-Tek key (D1 cols 4-13)
  swimmer_number?: string;   // from NT Portal: D1 number (e.g., "172")
  surname: string;
  given_name: string;
  member_id: string;         // MSA member ID
  gender: string;            // 'M' | 'F'
  age: number;
  age_group: string;         // computed: '18-24', '25-29', etc.
  dob?: string;              // MMDDYYYY if present
  events: HY3SwimmerEvent[];
}

// ── Relay Legs (F3 records) ─────────────────────────────────────────────

export interface HY3RelayLeg {
  key: string;
  leg: number | null;
  member_id: string | null;
  surname: string | null;
  given_name: string | null;
  age: number | null;
  age_group: string | null;
  splits: HY3Split[];
}

// ── Relays (F1/F2/F3 records) ──────────────────────────────────────────

export interface HY3Relay {
  team_short_code: string;
  age: string;
  event_type: string;
  event_code: string;
  event_number?: string;
  event_gender?: string;
  team_letter?: string;   // 'A' | 'B' | 'C' | 'D' — from F1 cols 7-8
  event_legs?: number;
  leg_distance?: number;
  r_score: string;
  points?: number | null;
  judgepoints?: number | null;
  exh_check: string;
  legs: HY3RelayLeg[];
  time_seconds: number | null;
  course: string | null;
  date: string | null;
  dq_check?: string;
  heat?: string;
  lane?: string;
  heatplace?: string;
  eventplace?: string;
  judgeplace?: string;
}

// ── Teams (C1 records) ─────────────────────────────────────────────────

export interface HY3Team {
  short_code: string;
  long_name: string;
  swimmers: HY3Swimmer[];
  relays: HY3Relay[];
}

// ── Top-level parse result ─────────────────────────────────────────────

export interface HY3ParseResult {
  meet: HY3Meet;
  teams: HY3Team[];
  warnings: string[];
  stats: HY3ParseStats;
}

// ── Parse statistics ───────────────────────────────────────────────────

export interface HY3ParseStats {
  totalTeams: number;
  totalSwimmers: number;
  totalIndividualEntries: number;
  totalRelays: number;
  totalSplits: number;
  totalNTs: number;
  totalDQs: number;
  totalNSs: number;           // dq_check 'R' = no show / scratched
  totalResults: number;       // entries with E2 result times
  hasResults: boolean;        // true if any E2 records found
  linesParsed: number;
}
