import * as core from '@actions/core'
import * as github from '@actions/github'
import { Parser } from './parser.js'
import { formatDuration } from './utils.js'
import { Resource } from './resources.js'
import fs from 'fs'

const commonClasses = [
  'C_MISSION',
  'C_FOCUS',
  'C_ITEMREACT',
  'C_SPELL',
  'C_SVM',
  'C_GILVALUES',
  'C_FIGHTAI',
  'CCAMSYS',
  'C_MENU_ITEM',
  'C_MENU',
  'C_PARTICLEFXEMITKEY',
  'CFX_BASE',
  'C_SFX',
  'C_SNDSYS_CFG',
  'C_MUSICSYS_CFG',
  'C_MUSICTHEME',
  'C_MUSICJINGLE',
]
const commonPrototypes = [
  'NPC_DEFAULT',
  'C_SPELL_PROTO',
  'CCAMSYS_DEF',
  'C_MENU_ITEM_DEF',
  'C_MENU_DEF',
  'C_MUSICTHEME_DEF',
  'C_MUSICJINGLE_DEF',
  'C_SFX_DEF',
  'CFX_BASE_PROTO',
]

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
  resources: Resource[],
  prefix: string[],
  check_id: number,
  summary: string,
  write: boolean = true
): Promise<Annotation[]> {
  // List first few prefixes
  const prefixes = prefix
    .slice(0, 3)
    .map((s) => `${s}_`)
    .join(', ')

  // Make a list of annotations
  let annotations = parsers
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
          raw_details: context.replace(new RegExp(`(?<![\\d\\w_])(${v.name})(?![\\d\\w_])`, 'gi'), `${prefix[0]}_$1`),
        } as Annotation
      })

      // Reference violations
      const refVio = p.referenceViolations.map((v) => {
        let raw_details: string
        let suggestion: string
        if (commonClasses.includes(v.name)) {
          // Check for common classes and suggest a fix
          suggestion =
            'Although that class is very standard, it technically does not have to exist or might even have a different name!\nIt is safer to define a copy of that class and use that instead to ensure compatibility.'
          raw_details = `// Copy of ${v.name} to ensure it exists
class ${prefix[0]}_${v.name} {
    // ...
};`
        } else if (commonPrototypes.includes(v.name)) {
          // Check for common protoypes and suggest a fix
          suggestion =
            'Although that prototype is very standard, it technically does not have to exist or might even have a different name!\nIt is safer to define a copy of the prototype and use that instead to ensure compatibility.'
          raw_details = `// Copy of ${v.name} to ensure it exists
prototype ${prefix[0]}_${v.name}( /* class name */ ) {
    // ...
};`
        } else {
          // Give general advice on how to handle unknown identifiers
          suggestion = 'Reference only symbols that are declared in the patch or safely search for other symbols by their name.'
          raw_details = `// If ${v.name} is a variable/constant
if (MEM_FindParserSymbol("${v.name}") != -1) {
    var zCPar_Symbol symb; symb = _^(MEM_GetSymbol("${v.name}"));
    // Access content with symb.content
} else {
    // Fallback to a default if the symbol does not exist
};

// -----

// OR: If ${v.name} is a function
if (MEM_FindParserSymbol("${v.name}") != -1) {
    // Push any necessary arguments onto the stack in the order of the function's parameters
    //MEM_PushIntParam(1);
    //MEM_PushInstParam(hero);
    //MEM_PushStringParam("Hello world!");

    // Call the function in a safe way
    MEM_CallByString("${v.name}");
} else {
    // Optionally provide a fallback if the function does not exist
};`
        }

        return {
          path: v.file,
          start_line: v.line,
          end_line: v.line,
          annotation_level: 'failure',
          title: `Reference violation: ${v.name}`,
          message: `The symbol "${v.name}" might not exist ("Unknown identifier").\n${suggestion}`,
          raw_details,
        } as Annotation
      })

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
    .concat(
      resources.map((r) => {
        // Extension violations
        const extVio = r.extViolations.map(
          (v) =>
            ({
              path: v.file,
              start_line: v.line,
              end_line: v.line,
              annotation_level: 'failure',
              title: `Invalid file extension: ${v.name}`,
              message: `The file extension "${v.name}" is not allowed for ${r.name} resources. Use one of the following: ${r.extensions.join(', ')}.`,
            }) as Annotation
        )

        // Naming violations
        const nameVio = r.nameViolations.map(
          (v) =>
            ({
              path: v.file,
              start_line: v.line,
              end_line: v.line,
              annotation_level: 'failure',
              title: `Naming convention violation: ${v.name}`,
              message: `The resource file "${v.name}" poses a compatibility risk. Add a prefix to its name (e.g. ${prefixes}). If overwriting this symbol is intended, add it to the ignore list.`,
            }) as Annotation
        )

        // Concatenate and return
        return [...extVio, ...nameVio]
      })
    )
    .flat()

  // Remove duplicates
  // Duplicate annotations occur when the same file is parsed across game versions (e.g. in Content_G1.src and Content_G2.src)
  annotations = annotations.filter(
    (v, i, a) => a.findIndex((t) => t.path === v.path && t.start_line === v.start_line && t.title === v.title) === i
  )

  // Write to GitHub check run if enabled
  if (write) {
    // Collect details
    const numViolations =
      parsers.reduce((acc, p) => acc + p.namingViolations.length + p.referenceViolations.length + p.overwriteViolations.length, 0) +
      resources.reduce((acc, r) => acc + r.extViolations.length + r.nameViolations.length, 0)
    const numSymbols = parsers.reduce((acc, p) => acc + p.numSymbols, 0)
    const numFiles = resources.reduce((acc, r) => acc + r.numFiles, 0)
    const text =
      `The patch validator checked ${numSymbols} script symbol${numSymbols !== 1 ? 's' : ''} and ${numFiles} resource file${numFiles !== 1 ? 's' : ''}.\n\n` +
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
  resources: Resource[],
  prefixes: string[],
  duration: number,
  details_url: string | null,
  write: boolean = true
): Promise<string> {
  const rows = parsers
    .map((p) => [
      p.namingViolations.length + p.referenceViolations.length + p.overwriteViolations.length > 0 ? '🔴 Fail' : '🟢 Pass',
      p.filename,
      String(p.namingViolations.length),
      String(p.referenceViolations.length),
      String(p.overwriteViolations.length),
      String(p.numSymbols),
      formatDuration(p.duration),
    ])
    .concat(
      resources.map((r) => [
        r.extViolations.length + r.nameViolations.length > 0 ? '🔴 Fail' : '🟢 Pass',
        r.name,
        String(r.extViolations.length + r.nameViolations.length),
        '-',
        '-',
        String(r.numFiles),
        formatDuration(r.duration),
      ])
    )

  const numViolations =
    parsers.reduce((acc, p) => acc + p.namingViolations.length + p.referenceViolations.length + p.overwriteViolations.length, 0) +
    resources.reduce((acc, r) => acc + r.extViolations.length + r.nameViolations.length, 0)
  const numSymbolsFiles = parsers.reduce((acc, p) => acc + p.numSymbols, 0) + resources.reduce((acc, r) => acc + r.numFiles, 0)
  const prefixList = prefixes.map((p) => `<code>${p}_</code>`)

  // Construct summary
  core.summary.addTable([
    [
      { data: 'Result 🔬', header: true, colspan: '1', rowspan: '2' },
      { data: 'Source 📝', header: true, colspan: '1', rowspan: '2' },
      { data: 'Violations 🛑', header: true, colspan: '3', rowspan: '1' },
      { data: 'Symbols / Files 📇', header: true, colspan: '1', rowspan: '2' },
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
  core.summary.addRaw(`Violations: ${numViolations}/${numSymbolsFiles}. Duration: ${formatDuration(duration)}.`, true)
  core.summary.addEOL()
  core.summary.addRaw(details_url !== null ? `See the <a href="${details_url}">check run for details</a>.` : '', true)

  // Legend on violations
  core.summary.addHeading('Types of violations', 3)
  core.summary.addList([
    '<b>Naming violations</b> occur when global Daedalus symbols are declared (or resource files are named) without a <a href="https://github.com/szapp/Ninja/wiki/Inject-Changes#naming-conventions">patch-specific prefix</a> in their name (e.g. <code>Patch_Name_*</code>, see below). This is important to ensure cross-mod compatibility.',
    '<b>Reference violations</b> occur when Daedalus symbols are referenced that may not exist (i.e. "Unknown Identifier"). A patch cannot presuppose <a href="https://github.com/szapp/Ninja/wiki/Inject-Changes#common-symbols">common symbols</a>.',
    '<b>Overwrite violations</b> occur when Daedalus symbols are declared that are <a href="https://github.com/szapp/Ninja/wiki/Inject-Changes#preserved-symbols">not allowed to be overwritten</a>. This is important to ensure proper function across mods.',
  ])
  core.summary.addRaw(
    'Naming violations can be corrected by prefixing the names of all global symbols (i.e. symbols declared outside of functions, classes, instances, and prototypes) and the names of resource files (i.e. files under "_work/Data/") with one of the following prefixes (add more in the <a href="https://github.com/szapp/patch-validator/#configuration">configuration</a>).',
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
