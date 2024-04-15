const winRE: RegExp = /[\\]/g

export function normalizePath(filepath: string): string {
  return filepath.replace(winRE, '/')
}
