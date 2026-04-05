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

export const BADGE_LEGEND = {
  EXH: 'Exhibition',
  IN:  'Checked In',
  SCR: 'Scratched (strikethrough, no badge)',
  DQ:  'Disqualified (results only)',
  NS:  'No Splash (results only)',
} as const;
