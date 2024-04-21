import * as core from '@actions/core'
import { workflow } from './cleanup.js'
import { Parser } from './parser.js'
import { loadInputs, formatFilters } from './inputs.js'
import write, { Annotation } from './write.js'

export async function run(github: boolean = false): Promise<{ summary: string; annotations: Annotation[] } | void> {
  try {
    // Clean up
    if (github) {
      if (await workflow()) return
    }

    // Start timer
    const startedAt = new Date()
    const startTime = performance.now()

    // Format inputs
    const { workingDir, basePath, patchName, prefixList, ignoreList } = loadInputs()
    const { prefix, ignore } = formatFilters(patchName, prefixList, ignoreList)

    // Collect symbol tables
    const parsers = await Parser.from(patchName, basePath, workingDir)

    // Validate symbol tables
    for (const parser of parsers) {
      parser.validateNames(prefix, ignore)
      parser.validateReferences()
      parser.validateOverwrites()
    }

    // Initialize check run
    const { details_url, check_id } = await write.createCheckRun(startedAt, github)

    // Collect results and write them to GitHub (github === true)
    const duration = performance.now() - startTime
    const summary = await write.summary(parsers, prefix, duration, details_url, github)
    const annotations = await write.annotations(parsers, prefix, check_id, summary, github)

    // Return results
    return { summary, annotations }
  } catch (error) {
    const msg: string = error instanceof Error ? error.message : String(error)
    if (github) core.setFailed(msg)
    else console.error(msg)
    await Parser.clearTmpDir()
  }
}
