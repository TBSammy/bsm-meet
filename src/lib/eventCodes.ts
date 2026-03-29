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

export function relayEventName(hy3Code: string): string {
  const trimmed = hy3Code.toUpperCase().trim()
  const letter = trimmed.slice(-1)
  const legDistance = parseInt(trimmed.slice(0, -1))
  const stroke = RELAY_STROKE_MAP[letter]
  if (stroke && legDistance) return `4x${legDistance} ${stroke} Relay`
  return hy3Code
}
