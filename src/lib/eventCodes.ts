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

/** Pool length in metres from meet_course code */
export function courseLength(meetCourse: string | null | undefined): number {
  return meetCourse === 'L' ? 50 : 25
}

export function relayEventName(hy3Code: string): string {
  const trimmed = hy3Code.toUpperCase().trim()
  const letter = trimmed.slice(-1)
  const totalDistance = parseInt(trimmed.slice(0, -1))
  const stroke = RELAY_STROKE_MAP[letter]
  if (stroke && totalDistance) return `4x${totalDistance / 4} ${stroke} Relay`
  return hy3Code
}
