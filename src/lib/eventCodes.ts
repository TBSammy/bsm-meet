// HY3 event code → human-readable name mapping
// Copied from admin_msq_nationals/src/utils/hy3Parser/eventCodes.ts

const STROKE_MAP: Record<string, string> = {
  A: 'Freestyle',
  B: 'Backstroke',
  C: 'Breaststroke',
  D: 'Butterfly',
  E: 'Individual Medley',
}

const RELAY_STROKE_MAP: Record<string, string> = {
  A: 'Freestyle',
  E: 'Medley',
}

export function eventName(hy3Code: string): string {
  const trimmed = hy3Code.toUpperCase().trim()
  const letter = trimmed.slice(-1)
  const distance = trimmed.slice(0, -1)
  const stroke = STROKE_MAP[letter]
  if (stroke && distance) return `${distance} ${stroke}`
  return hy3Code
}

/** Extract total swim distance in metres from an event code */
export function eventDistance(hy3Code: string): number {
  const trimmed = hy3Code.toUpperCase().trim()
  const d = parseInt(trimmed.slice(0, -1))
  return isNaN(d) ? 0 : d
}

/** Extract per-leg distance for a relay event code */
export function relayLegDistance(hy3Code: string): number {
  return eventDistance(hy3Code)
}

export function relayEventName(hy3Code: string): string {
  const trimmed = hy3Code.toUpperCase().trim()
  const letter = trimmed.slice(-1)
  const legDistance = parseInt(trimmed.slice(0, -1))
  const stroke = RELAY_STROKE_MAP[letter]
  if (stroke && legDistance) return `4x${legDistance} ${stroke} Relay`
  return hy3Code
}
