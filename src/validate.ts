import { SymbolTable } from './class.js'
import * as core from '@actions/core'

export function formatFilters(patchName: string, prefix: string[], ignore: string[]): { prefix: string[]; ignore: string[] } {
  const patchNameU = patchName.toUpperCase()

  // Format and extend prefixes
  const prefixForm = prefix.map((p) => p.replace(/_$/, '').toUpperCase() + '_')
  const prefixPatch = prefixForm.map((p) => 'PATCH_' + p)
  prefix = [...new Set([...prefixForm, ...prefixPatch, patchNameU + '_', 'PATCH_' + patchNameU + '_'])]

  // Format and extend ignore list
  const ignoreForm = ignore.map((i) => i.toUpperCase())
  ignore = [...new Set([...ignoreForm, `NINJA_${patchNameU}_INIT`, `NINJA_${patchNameU}_MENU`])]

  // Report filters
  core.info(`Ignore:   ${ignore.join(', ')}`)
  core.info(`Prefixes: ${prefix.join(', ')}`)

  return { prefix, ignore }
}

export function validate(symbols: SymbolTable, prefix: string[], ignore: string[]): SymbolTable {
  const invalidSymbols = symbols.filter((symbol) => {
    const name = symbol.name.toUpperCase()
    const hasPrefix = prefix.some((p) => name.includes(p))
    const isIgnored = ignore.includes(name)
    return !hasPrefix && !isIgnored
  })
  return invalidSymbols
}
