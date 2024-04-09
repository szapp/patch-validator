import * as core from '@actions/core'
import * as github from '@actions/github'
import { SymbolTable } from './class.js'

export function symbols(symbolTable: SymbolTable, symbolTableInvalid: SymbolTable): void {
  core.startGroup('Global Symbols')
  const symbolNamesInvalid = symbolTableInvalid.map((s) => s.name)
  symbolTable.map((s) => {
    const colorPrefix = symbolNamesInvalid.includes(s.name) ? '\u001b[31m' : '\u001b[32m'
    core.info(colorPrefix + s.name + '\u001b[0m')
  })
  core.endGroup()
}

export async function annotations(
  symbolTableInvalid: SymbolTable,
  numSymbols: number,
  prefix: string[],
  startedAt: Date,
  duration: string
): Promise<string | null> {
  const numErr = symbolTableInvalid.length
  const details = `The patch validator checked ${numSymbols} global symbol name${numSymbols !== 1 ? 's' : ''}.

For more details, see [Ninja documentation](https://github.com/szapp/Ninja/wiki/Inject-Changes#naming-conventions).`

  const prefixes = prefix.slice(0, 3).join(', ')
  const annotations: {
    path: string
    start_line: number
    end_line: number
    annotation_level: 'failure' | 'notice' | 'warning'
    message: string
    title: string
  }[] = symbolTableInvalid.map((s) => ({
    path: s.file,
    start_line: s.line,
    end_line: s.line,
    annotation_level: 'failure',
    message: `The symbol ${s.name} poses a compatibility risk. Add a prefix to its name (e.g. ${prefixes}). If overwriting this symbol is intended, add it to the ignore list.`,
    title: 'Naming convention violation',
  }))
  const octokit = github.getOctokit(core.getInput('token'))
  const {
    data: { details_url },
  } = await octokit.rest.checks.create({
    ...github.context.repo,
    name: 'Naming Convention',
    head_sha: github.context.sha,
    started_at: startedAt.toISOString(),
    completed_at: new Date().toISOString(),
    conclusion: numErr ? 'failure' : 'success',
    output: {
      title: `${numErr || 'No'} violation${numErr !== 1 ? 's' : ''}`,
      summary: `The patch validator found ${numErr || 'no'} invalid symbol name${numErr !== 1 ? 's' : ''} (${duration})`,
      text: details,
      annotations,
    },
  })
  return details_url
}

export async function summary(
  symbolTableInvalid: SymbolTable,
  numSymbols: number,
  relPath: string,
  details_url: string | null,
  duration: string
): Promise<void> {
  const relPathRE = RegExp(`^${relPath}${relPath.length > 1 && !relPath.endsWith('/') ? '/' : ''}`)
  const rows =
    symbolTableInvalid.length > 0
      ? symbolTableInvalid.map((s) => ['🔴 Fail', s.name, `${s.file.replace(relPathRE, '')}:${s.line}`])
      : [['🟢 Pass', '-', '-']]
  await core.summary
    .addHeading('Validation Results')
    .addTable([
      [
        { data: 'Test result 🔬', header: true },
        { data: 'Symbol 📇', header: true },
        { data: 'File 📁', header: true },
      ],
      ...rows,
    ])
    .addEOL()
    .addRaw(`Violations: ${symbolTableInvalid.length}/${numSymbols}. Duration: ${duration}.`, true)
    .addEOL()
    .addRaw(details_url !== null ? `<a href="${details_url}">Details</a>.` : '', true)
    .write({ overwrite: false })
}

export default { symbols, annotations, summary }
