import * as core from '@actions/core'
import { workflow } from './cleanup.js'
import { Parser } from './parser.js'
import { loadInputs, formatFilters } from './inputs.js'
import write, { Annotation } from './write.js'
import { DefaultArtifactClient } from '@actions/artifact'
import fs from 'fs'

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

    // Save symbol table and reference table as workflow artifacts
    if (github) {
      const artifactFiles: string[] = []
      for (const parser of parsers) {
        fs.writeFileSync(`./${parser.filename}-symbol-table.json`, JSON.stringify(parser.symbolTable, null, 2))
        fs.writeFileSync(`./${parser.filename}-reference-table.json`, JSON.stringify(parser.referenceTable, null, 2))
        artifactFiles.push(`./${parser.filename}-symbol-table.json`)
        artifactFiles.push(`./${parser.filename}-reference-table.json`)
      }
      const artifact = new DefaultArtifactClient()
      await artifact.uploadArtifact('symbol-tables', artifactFiles, '', { retentionDays: 3 })
      artifactFiles.forEach((file) => fs.unlinkSync(file))
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
  }
}
