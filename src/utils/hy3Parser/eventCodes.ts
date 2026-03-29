// HY3 event code → human-readable name mapping
// Source: admin_msq_nationals/supabase/migrations (events_ref table)

export interface EventRef {
  code: string;       // HY3 code e.g. "200A"
  name: string;       // e.g. "200 Freestyle"
  distance: number;
  stroke: string;
  isRelay: boolean;
}

const EVENTS: EventRef[] = [
  // Freestyle (A)
  { code: '25A',   name: '25 Freestyle',            distance: 25,   stroke: 'Freestyle',   isRelay: false },
  { code: '50A',   name: '50 Freestyle',            distance: 50,   stroke: 'Freestyle',   isRelay: false },
  { code: '100A',  name: '100 Freestyle',           distance: 100,  stroke: 'Freestyle',   isRelay: false },
  { code: '200A',  name: '200 Freestyle',           distance: 200,  stroke: 'Freestyle',   isRelay: false },
  { code: '400A',  name: '400 Freestyle',           distance: 400,  stroke: 'Freestyle',   isRelay: false },
  { code: '800A',  name: '800 Freestyle',           distance: 800,  stroke: 'Freestyle',   isRelay: false },
  { code: '1500A', name: '1500 Freestyle',          distance: 1500, stroke: 'Freestyle',   isRelay: false },
  // Backstroke (B)
  { code: '25B',   name: '25 Backstroke',           distance: 25,   stroke: 'Backstroke',  isRelay: false },
  { code: '50B',   name: '50 Backstroke',           distance: 50,   stroke: 'Backstroke',  isRelay: false },
  { code: '100B',  name: '100 Backstroke',          distance: 100,  stroke: 'Backstroke',  isRelay: false },
  { code: '200B',  name: '200 Backstroke',          distance: 200,  stroke: 'Backstroke',  isRelay: false },
  { code: '400B',  name: '400 Backstroke',          distance: 400,  stroke: 'Backstroke',  isRelay: false },
  // Breaststroke (C)
  { code: '25C',   name: '25 Breaststroke',         distance: 25,   stroke: 'Breaststroke', isRelay: false },
  { code: '50C',   name: '50 Breaststroke',         distance: 50,   stroke: 'Breaststroke', isRelay: false },
  { code: '100C',  name: '100 Breaststroke',        distance: 100,  stroke: 'Breaststroke', isRelay: false },
  { code: '200C',  name: '200 Breaststroke',        distance: 200,  stroke: 'Breaststroke', isRelay: false },
  { code: '400C',  name: '400 Breaststroke',        distance: 400,  stroke: 'Breaststroke', isRelay: false },
  // Butterfly (D)
  { code: '25D',   name: '25 Butterfly',            distance: 25,   stroke: 'Butterfly',   isRelay: false },
  { code: '50D',   name: '50 Butterfly',            distance: 50,   stroke: 'Butterfly',   isRelay: false },
  { code: '100D',  name: '100 Butterfly',           distance: 100,  stroke: 'Butterfly',   isRelay: false },
  { code: '200D',  name: '200 Butterfly',           distance: 200,  stroke: 'Butterfly',   isRelay: false },
  { code: '400D',  name: '400 Butterfly',           distance: 400,  stroke: 'Butterfly',   isRelay: false },
  // Individual Medley (E)
  { code: '100E',  name: '100 Individual Medley',   distance: 100,  stroke: 'IM',          isRelay: false },
  { code: '200E',  name: '200 Individual Medley',   distance: 200,  stroke: 'IM',          isRelay: false },
  { code: '400E',  name: '400 Individual Medley',   distance: 400,  stroke: 'IM',          isRelay: false },
  // Medley Relay (F)
  { code: '100F',  name: '4x25 Medley Relay',       distance: 100,  stroke: 'Medley',      isRelay: true },
  { code: '200F',  name: '4x50 Medley Relay',       distance: 200,  stroke: 'Medley',      isRelay: true },
  { code: '400F',  name: '4x100 Medley Relay',      distance: 400,  stroke: 'Medley',      isRelay: true },
  // Freestyle Relay (G)
  { code: '100G',  name: '4x25 Freestyle Relay',    distance: 100,  stroke: 'Freestyle',   isRelay: true },
  { code: '200G',  name: '4x50 Freestyle Relay',    distance: 200,  stroke: 'Freestyle',   isRelay: true },
  { code: '400G',  name: '4x100 Freestyle Relay',   distance: 400,  stroke: 'Freestyle',   isRelay: true },
  { code: '800G',  name: '4x200 Freestyle Relay',   distance: 800,  stroke: 'Freestyle',   isRelay: true },
];

const eventMap = new Map<string, EventRef>();
for (const e of EVENTS) {
  eventMap.set(e.code.toUpperCase(), e);
}

export function lookupEvent(hy3Code: string): EventRef | undefined {
  return eventMap.get(hy3Code.toUpperCase().trim());
}

export function eventName(hy3Code: string): string {
  return lookupEvent(hy3Code)?.name ?? hy3Code;
}

// ── Relay-aware name resolution ──────────────────────────────────────────
// HY3 F1 relay records store per-leg distance + individual stroke letter:
//   50A = 4x50 Freestyle Relay, 50E = 4x50 Medley Relay
// But eventCodes uses total-distance + relay letter (200G, 200F).
// This helper converts the per-leg code to the correct relay name.
const RELAY_STROKE_MAP: Record<string, string> = {
  'A': 'Freestyle',
  'E': 'Medley',
};

export function relayEventName(hy3Code: string): string {
  // First check if it already matches a relay entry (e.g. 200F, 200G)
  const existing = lookupEvent(hy3Code);
  if (existing?.isRelay) return existing.name;
  // Otherwise, interpret as per-leg relay code: distance + stroke letter
  const trimmed = hy3Code.toUpperCase().trim();
  const letter = trimmed.slice(-1);
  const legDistance = parseInt(trimmed.slice(0, -1));
  const stroke = RELAY_STROKE_MAP[letter];
  if (stroke && legDistance) {
    return `4x${legDistance} ${stroke} Relay`;
  }
  return hy3Code;
}

export function allEvents(): EventRef[] {
  return [...EVENTS];
}

// ── CL2 numeric code conversion ──────────────────────────────────────────
// CL2 uses numeric stroke codes: 1=Free, 2=Back, 3=Breast, 4=Fly, 5=IM
// Relay codes: 6=Medley Relay, 7=Free Relay (not confirmed in docs but follows pattern)

const CL2_STROKE_MAP: Record<string, string> = {
  '1': 'A',  // Freestyle
  '2': 'B',  // Backstroke
  '3': 'C',  // Breaststroke
  '4': 'D',  // Butterfly
  '5': 'E',  // Individual Medley
};

/** Convert CL2 numeric event code (e.g. "1001") to HY3 alpha code (e.g. "100A") */
export function cl2CodeToHY3(cl2Code: string): string {
  const trimmed = cl2Code.trim();
  if (!trimmed) return trimmed;
  const strokeDigit = trimmed.slice(-1);
  const distance = trimmed.slice(0, -1);
  const letter = CL2_STROKE_MAP[strokeDigit];
  if (letter && distance) return `${distance}${letter}`;
  return trimmed; // return as-is if can't convert
}
