// Canonical display constants — Phase 1 Standards (STD-01 through STD-05)
// Shared values across all public sites and admin portal.

export const BADGE = {
  DQ:  'px-1.5 py-0.5 rounded text-xs font-bold bg-red-100 text-red-700',
  NS:  'px-1.5 py-0.5 rounded text-xs font-bold bg-gray-100 text-gray-600',
  EXH: 'px-1.5 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-700',
  IN:  'px-1.5 py-0.5 rounded text-xs font-bold bg-green-100 text-green-700',
  // SCR: NO badge — use strikethrough row styling only
} as const;

export const NT_TIME_COLOR = 'text-orange-400';

export const PLACE_COLOR: Record<number | 'default', string> = {
  1: 'text-yellow-500',
  2: 'text-[#8E9196]',    // silver
  3: 'text-amber-600',
  default: 'text-gray-700',
};

const pr = new Intl.PluralRules('en', { type: 'ordinal' });
const suffixes = new Map<string, string>([['one', 'st'], ['two', 'nd'], ['few', 'rd'], ['other', 'th']]);
export function ordinal(n: number): string {
  return `${n}${suffixes.get(pr.select(n)) ?? 'th'}`;
}

// Sex prefix for event names (entry list, program, results)
export function sexPrefix(gender: string | null | undefined): string {
  if (gender === 'Male') return 'Mens ';
  if (gender === 'Female') return 'Womens ';
  if (gender === 'Mixed') return 'Mixed ';
  return '';
}

// Relay leg stroke derivation
const MEDLEY_LEG_STROKES: readonly string[] = ['Backstroke', 'Breaststroke', 'Butterfly', 'Freestyle'];

export function deriveRelayLegStroke(eventStroke: string | undefined, legNumber: number): string {
  if (!eventStroke) return '';
  if (eventStroke === 'Medley') return MEDLEY_LEG_STROKES[(legNumber - 1) % 4] || '';
  return eventStroke;
}

// Lane 0 sort helper — respects campaign-level lane_zero_position setting
export function laneSortValue(lane: string | null | undefined, laneZeroPos: 'first' | 'last' = 'first'): number {
  const n = parseInt(lane || '0') || 0;
  if (n === 0) return laneZeroPos === 'first' ? -1 : 999;
  return n;
}

// Build ordered lane list for empty-lane grid rendering
export function buildLaneOrder(totalLanes: number, laneZeroPos: 'first' | 'last'): number[] {
  const lanes = Array.from({ length: totalLanes }, (_, i) => i);
  if (laneZeroPos === 'last') {
    lanes.push(lanes.shift()!);
  }
  return lanes;
}

export const BADGE_LEGEND = {
  EXH: 'Exhibition',
  IN:  'Checked In',
  SCR: 'Scratched (strikethrough, no badge)',
  DQ:  'Disqualified (results only)',
  NS:  'No Splash (results only)',
} as const;
