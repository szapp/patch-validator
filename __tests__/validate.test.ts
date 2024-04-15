import * as core from '@actions/core'
import { SymbolTable } from '../src/class.ts'
import { validate, formatFilters } from '../src/validate.ts'

describe('formatFilters', () => {
  beforeEach(() => {
    jest.spyOn(core, 'info').mockImplementation()
  })

  it('formats and extends filters', () => {
    const patchName = 'Patch1'
    const prefix = ['pre1', 'PRE2']
    const ignore = ['Symbol1', 'Symbol2']

    const result = formatFilters(patchName, prefix, ignore)

    expect(core.info).toHaveBeenCalledWith('Ignore:   SYMBOL1, SYMBOL2, NINJA_PATCH1_INIT, NINJA_PATCH1_MENU')
    expect(core.info).toHaveBeenCalledWith('Prefixes: PRE1_, PRE2_, PATCH_PRE1_, PATCH_PRE2_, PATCH1_, PATCH_PATCH1_')
    expect(result.prefix).toEqual(['PRE1_', 'PRE2_', 'PATCH_PRE1_', 'PATCH_PRE2_', 'PATCH1_', 'PATCH_PATCH1_'])
    expect(result.ignore).toEqual(['SYMBOL1', 'SYMBOL2', 'NINJA_PATCH1_INIT', 'NINJA_PATCH1_MENU'])
  })
})

describe('validate', () => {
  it('returns invalid symbols', () => {
    const emptyProp = { file: 'test.d', line: 0 }
    const ignSymbols: SymbolTable = [{ name: 'symbol1', ...emptyProp }]
    const scpSymbols: SymbolTable = [{ name: 'symbol2.foo', ...emptyProp }]
    const outSymbols: SymbolTable = [{ name: 'symbol3', file: '', line: 0 }]
    const invSymbols: SymbolTable = [
      { name: 'SYMBOL4', ...emptyProp },
      { name: 'Symbol5', ...emptyProp },
    ]
    const symbols: SymbolTable = [...scpSymbols, ...outSymbols, ...ignSymbols, ...invSymbols]
    const prefix: string[] = []
    const ignore = ['SYMBOL1']

    const result = validate(symbols, prefix, ignore)

    expect(result).toEqual(invSymbols)
  })

  it('returns empty array when all symbols are valid', () => {
    const emptyProp = { file: '', line: 0 }
    const symbols: SymbolTable = [
      { name: 'Pt1_Symbol1', ...emptyProp },
      { name: 'pt1_Symbol2', ...emptyProp },
      { name: 'PATCH1_Symbol1', ...emptyProp },
      { name: 'patch1_Symbol2', ...emptyProp },
    ]
    const prefix = ['PT1_', 'PATCH1_']
    const ignore: string[] = []

    const result = validate(symbols, prefix, ignore)

    expect(result).toEqual([])
  })
})
