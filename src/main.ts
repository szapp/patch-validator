import * as core from '@actions/core'
import { workflow } from './cleanup.js'
import { Parser } from './parser.js'
import { validate, formatFilters } from './validate.js'
import { loadInputs } from './inputs.js'
import write from './write.js'
import humanizeDuration from 'humanize-duration'

export async function run(): Promise<void> {
  try {
    // Clean up
    if (await workflow()) return

    // Start timer
    const startedAt = new Date()
    const startTime = performance.now()

    // Format inputs
    const { relPath, basePath, patchName, prefix: prefixList, ignore: ignoreList } = loadInputs()

    // Collect global symbols
    const symbolTable = Parser.from(basePath, '')[0].symbolTable

    // Validate symbols by naming convention
    const { prefix, ignore } = formatFilters(patchName, prefixList, ignoreList)
    const symbolTableInvalid = validate(symbolTable, prefix, ignore)

    // Write outputs
    write.symbols(symbolTable, symbolTableInvalid)
    const duration = humanizeDuration(performance.now() - startTime, { round: true, largest: 2, units: ['m', 's', 'ms'] })
    const details_url = await write.annotations(symbolTableInvalid, symbolTable.length, prefix, startedAt, duration)
    await write.summary(symbolTableInvalid, symbolTable.length, relPath, details_url, duration)
  } catch (error) {
    const msg: string = error instanceof Error ? error.message : String(error)
    core.setFailed(msg)
  }
}
