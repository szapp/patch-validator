import * as core from '@actions/core'
import * as github from '@actions/github'
import { Parser } from './parser.js'
import { formatDuration } from './utils.js'
import fs from 'fs'

export type Annotation = {
  path: string
  start_line: number
  end_line: number
  annotation_level: 'failure' | 'notice' | 'warning'
  title: string
  message: string
  raw_details?: string
}

export async function createCheckRun(startedAt: Date, write: boolean = true): Promise<{ details_url: string | null; check_id: number }> {
  // Return empty details if writing is disabled
  if (!write) return { details_url: null, check_id: 0 }

  // Create checkrun on GitHub
  const octokit = github.getOctokit(core.getInput('token'))
  const {
    data: { html_url: details_url, id: check_id },
  } = await octokit.rest.checks.create({
    ...github.context.repo,
    name: 'Patch Validator',
    head_sha: github.context.sha,
    external_id: github.context.workflow,
    started_at: startedAt.toISOString(),
    status: 'in_progress',
  })
  return { details_url, check_id }
}

export async function annotations(
  parsers: Parser[],
  prefix: string[],
  check_id: number,
  summary: string,
  write: boolean = true
): Promise<Annotation[]> {
  // List first few prefixes
  const prefixes = prefix.slice(0, 3).join(', ')

  // Make a list of annotations
  const annotations = parsers
    .map((p) => {
      // Naming violations
      const nameVio = p.namingViolations.map((v) => {
        const content = fs.readFileSync(v.file, 'ascii')
        const context = content.split('\n')[v.line - 1]
        return {
          path: v.file,
          start_line: v.line,
          end_line: v.line,
          annotation_level: 'failure',
          title: `Naming convention violation: ${v.name}`,
          message: `The symbol "${v.name}" poses a compatibility risk. Add a prefix to its name (e.g. ${prefixes}). If overwriting this symbol is intended, add it to the ignore list.`,
          raw_details: context.replace(new RegExp(`(?<![\\d\\w_])(${v.name})(?![\\d\\w_])`, 'gi'), `${prefix[0]}$1`),
        } as Annotation
      })

      // Reference violations
      const refVio = p.referenceViolations.map(
        (v) =>
          ({
            path: v.file,
            start_line: v.line,
            end_line: v.line,
            annotation_level: 'failure',
            title: `Reference violation: ${v.name}`,
            message: `The symbol "${v.name}" might not exist ("Unknown identifier"). Reference only symbols that are declared in the patch or safely search for other symbols by their name.`,
            raw_details: `if (MEM_FindParserSymbol("${v.name}") != -1) {
    var zCPar_Symbol symb; symb = _^(MEM_GetSymbol("${v.name}"));
    // Access content with symb.content
} else {
    // Fallback to a default if the symbol does not exist
};`,
          }) as Annotation
      )

      // Overwrite violations
      const overVio = p.overwriteViolations.map(
        (v) =>
          ({
            path: v.file,
            start_line: v.line,
            end_line: v.line,
            annotation_level: 'failure',
            title: `Overwrite violation: ${v.name}`,
            message: `The symbol "${v.name}" is not allowed to be re-declared / defined.`,
          }) as Annotation
      )

      // Concatenate and return
      return [...nameVio, ...refVio, ...overVio]
    })
    .flat()

  // Write to GitHub check run if enabled
  if (write) {
    // Collect details
    const numViolations = parsers.reduce(
      (acc, p) => acc + p.namingViolations.length + p.referenceViolations.length + p.overwriteViolations.length,
      0
    )
    const numSymbols = parsers.reduce((acc, p) => acc + p.numSymbols, 0)
    const text =
      `The patch validator checked ${numSymbols} symbol${numSymbols !== 1 ? 's' : ''}.\n\n` +
      'For more details, see [Ninja documentation](https://github.com/szapp/Ninja/wiki/Inject-Changes).'

    const octokit = github.getOctokit(core.getInput('token'))
    await octokit.rest.checks.update({
      ...github.context.repo,
      check_run_id: check_id,
      completed_at: new Date().toISOString(),
      conclusion: numViolations ? 'failure' : 'success',
      output: {
        title: `${numViolations || 'No'} violation${numViolations !== 1 ? 's' : ''}`,
        summary,
        text,
        annotations: annotations.slice(0, 50), // Limit to 50 annotations, see https://docs.github.com/en/rest/reference/checks#create-a-check-run
      },
    })
  }

  // Return unformatted annotation list
  return annotations
}

export async function summary(
  parsers: Parser[],
  prefixes: string[],
  duration: number,
  details_url: string | null,
  write: boolean = true
): Promise<string> {
  const rows = parsers.map((p) => [
    p.namingViolations.length + p.referenceViolations.length + p.overwriteViolations.length > 0 ? '🔴 Fail' : '🟢 Pass',
    p.filename,
    String(p.namingViolations.length),
    String(p.referenceViolations.length),
    String(p.overwriteViolations.length),
    String(p.numSymbols),
    formatDuration(p.duration),
  ])
  const numViolations = parsers.reduce(
    (acc, p) => acc + p.namingViolations.length + p.referenceViolations.length + p.overwriteViolations.length,
    0
  )
  const numSymbols = parsers.reduce((acc, p) => acc + p.numSymbols, 0)
  const prefixList = prefixes.map((p) => `<code>${p}</code>`)

  // Construct summary
  core.summary.addTable([
    [
      { data: 'Result 🔬', header: true, colspan: '1', rowspan: '2' },
      { data: 'Source 📝', header: true, colspan: '1', rowspan: '2' },
      { data: 'Violations 🛑', header: true, colspan: '3', rowspan: '1' },
      { data: 'Symbols 📇', header: true, colspan: '1', rowspan: '2' },
      { data: 'Duration ⏰', header: true, colspan: '1', rowspan: '2' },
    ],
    [
      { data: 'Naming 🚫', header: true, colspan: '1', rowspan: '1' },
      { data: 'Reference ❌', header: true, colspan: '1', rowspan: '1' },
      { data: 'Overwrite ⛔', header: true, colspan: '1', rowspan: '1' },
    ],
    ...rows,
  ])

  // Details on results
  core.summary.addRaw(`Violations: ${numViolations}/${numSymbols}. Duration: ${formatDuration(duration)}.`, true)
  core.summary.addEOL()
  core.summary.addRaw(details_url !== null ? `See the <a href="${details_url}">check run for details</a>.` : '', true)

  // Legend on violations
  core.summary.addHeading('Types of violations', 3)
  core.summary.addList([
    '<b>Naming violations</b> occur when global Daedalus symbols are declared without a <a href="https://github.com/szapp/Ninja/wiki/Inject-Changes#naming-conventions">patch-specific prefix</a> in their name (e.g. <code>Patch_Name_*</code>, see below). This is important to ensure cross-mod compatibility.',
    '<b>Reference violations</b> occur when Daedalus symbols are referenced that may not exist (i.e. "Unknown Identifier"). A patch cannot presuppose <a href="https://github.com/szapp/Ninja/wiki/Inject-Changes#common-symbols">common symbols</a>.',
    '<b>Overwrite violations</b> occur when Daedalus symbols are declared that are <a href="https://github.com/szapp/Ninja/wiki/Inject-Changes#preserved-symbols">not allowed to be overwritten</a>. This is important to ensure proper function across mods.',
  ])
  core.summary.addRaw(
    'Naming violations can be corrected by prefixing the names of all global symbols (i.e. symbols declared outside of functions, classes, instances, and prototypes) with one of the following prefixes (add more in the <a href="https://github.com/szapp/patch-validator/#configuration">configuration</a>).',
    true
  )
  core.summary.addList(prefixList)

  // Format the summary as a string
  const result = core.summary.stringify()

  // Write summary to GitHub if enabled and clear buffer
  if (write) await core.summary.write({ overwrite: false })
  core.summary.emptyBuffer()
  return result
}

export default { createCheckRun, annotations, summary }
