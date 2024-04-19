import humanizeDuration from 'humanize-duration'

const winRE: RegExp = /[\\]/g

export function normalizePath(filepath: string): string {
  return filepath.replace(winRE, '/')
}

export function formatDuration(duration: number): string {
  return humanizeDuration(duration, { round: true, largest: 2, units: ['m', 's', 'ms'] })
}
