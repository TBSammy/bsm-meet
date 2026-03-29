import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatTime(seconds: number | null): string {
  if (!seconds) return 'NT'
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  if (mins > 0) {
    return `${mins}:${secs.toFixed(2).padStart(5, '0')}`
  }
  return secs.toFixed(2)
}

export function formatSeedTime(timeStr: string | number | null): string {
  if (!timeStr || timeStr === 'NT') return 'NT'
  if (typeof timeStr === 'number') return formatTime(timeStr)
  return timeStr
}
