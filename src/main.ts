import * as core from '@actions/core'
import { workflow } from './cleanup.js'
import { Parser } from './parser.js'
import { Resource } from './resources.js'
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

    // Download extras
    await Parser.downloadSpecial()

    // Format inputs
    const { workingDir, basePath, patchName, prefixList, ignoreListDecl, ignoreListRsc } = loadInputs()
    const { prefix, ignoreDecl, ignoreRsc } = formatFilters(patchName, prefixList, ignoreListDecl, ignoreListRsc, basePath)

    // Collect symbol tables
    const parsers = await Parser.from(patchName, basePath, workingDir)

    // Print debugging information
    if (github) {
      core.debug('Symbol tables:')
      for (const parser of parsers) {
        core.debug(`${parser.filename} (${parser.symbolTable.length} symbols)`)
        core.debug('')
        // istanbul ignore next
        for (const { name } of parser.symbolTable) core.debug(name)
        core.debug('')
      }
    }

    // Validate symbol tables
    for (const parser of parsers) {
      parser.validateNames(prefix, ignoreDecl)
      parser.validateReferences()
      parser.validateOverwrites()
    }

    // Validate resource files
    const resources = Resource.from(workingDir, basePath, prefix, ignoreRsc)

    // Initialize check run
    const { details_url, check_id } = await write.createCheckRun(startedAt, github)

    // Collect results and write them to GitHub (github === true)
    const duration = performance.now() - startTime
    const summary = await write.summary(parsers, resources, prefix, duration, details_url, github)
    const annotations = await write.annotations(parsers, resources, prefix, check_id, summary, github)

    // Update exit code
    if (github && annotations.length > 0) {
      process.exitCode = core.ExitCode.Failure
    }

    // Return results
    return { summary, annotations }
  } catch (error) {
    const msg: string = error instanceof Error ? error.message : String(error)
    if (github) core.setFailed(msg)
    else console.error(msg)
  } finally {
    await Parser.clearTmpDir()
  }
}
