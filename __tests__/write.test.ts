import write, { Annotation } from '../src/write.ts'
import * as core from '@actions/core'
import * as github from '@actions/github'
import { Parser } from '../src/parser.ts'
import fs from 'fs'

let createCheckMock: jest.Mock
let updateCheckMock: jest.Mock
let fsReadFileSyncMock: jest.SpiedFunction<typeof fs.readFileSync>

describe('createCheckRun', () => {
  beforeEach(() => {
    jest.spyOn(core, 'getInput').mockReturnValue('dummy-token')

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    createCheckMock = jest.fn((_params) => ({ data: { html_url: 'https://example.com', id: 42 } }))

    jest.spyOn(github, 'getOctokit').mockReturnValue({
      rest: {
        checks: {
          create: createCheckMock,
        },
      },
    } as unknown as ReturnType<typeof github.getOctokit>)
    jest.replaceProperty(github, 'context', {
      repo: {
        owner: 'owner',
        repo: 'repo',
      },
      sha: 'sha',
      workflow: 'workflow.yml',
    } as unknown as typeof github.context)
  })

  it('creates check run', async () => {
    const result = await write.createCheckRun(new Date())

    expect(createCheckMock).toHaveBeenCalledWith(
      expect.objectContaining({
        ...github.context.repo,
        name: 'Patch Validator',
        head_sha: github.context.sha,
        external_id: 'workflow.yml',
        started_at: expect.any(String),
        status: 'in_progress',
      })
    )
    expect(result).toEqual({ details_url: 'https://example.com', check_id: 42 })
  })

  it('does not create a check run if write is not truthy', async () => {
    const result = await write.createCheckRun(new Date(), false)

    expect(createCheckMock).not.toHaveBeenCalled()
    expect(result).toEqual({ details_url: null, check_id: 0 })
  })
})

describe('annotations', () => {
  beforeEach(() => {
    fsReadFileSyncMock = jest.spyOn(fs, 'readFileSync')
    jest.spyOn(core, 'getInput').mockReturnValue('dummy-token')

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    updateCheckMock = jest.fn((_params) => ({ data: { html_url: 'https://example.com' } }))

    jest.spyOn(github, 'getOctokit').mockReturnValue({
      rest: {
        checks: {
          update: updateCheckMock,
        },
      },
    } as unknown as ReturnType<typeof github.getOctokit>)
    jest.replaceProperty(github, 'context', {
      repo: {
        owner: 'owner',
        repo: 'repo',
      },
      sha: 'sha',
      workflow: 'workflow.yml',
    } as unknown as typeof github.context)
  })

  it('creates annotations for invalid symbols', async () => {
    const parsers = [
      {
        numSymbols: 4,
        namingViolations: [{ name: 'SYMBOL1', file: 'path/to/file1', line: 2 }],
        referenceViolations: [{ name: 'SYMBOL2', file: 'path/to/file2', line: 3 }],
        overwriteViolations: [{ name: 'SYMBOL3', file: 'path/to/file3', line: 4 }],
      } as unknown as Parser,
    ]
    const prefix = ['PATCH_']
    const check_id = 42
    const summary = 'summary text'

    const expectedAnnotations = [
      {
        path: 'path/to/file1',
        start_line: 2,
        end_line: 2,
        annotation_level: 'failure',
        title: 'Naming convention violation: SYMBOL1',
        message:
          'The symbol "SYMBOL1" poses a compatibility risk. Add a prefix to its name (e.g. PATCH_). If overwriting this symbol is intended, add it to the ignore list.',
        raw_details: 'const int PATCH_Symbol1 = 0; // The PATCH_Symbol1 is a global symbol',
      },
      {
        path: 'path/to/file2',
        start_line: 3,
        end_line: 3,
        annotation_level: 'failure',
        title: 'Reference violation: SYMBOL2',
        message:
          'The symbol "SYMBOL2" might not exist ("Unknown identifier"). Reference only symbols that are declared in the patch or safely search for other symbols by their name.',
        raw_details: `if (MEM_FindParserSymbol("SYMBOL2") != -1) {
    var zCPar_Symbol symb; symb = _^(MEM_GetSymbol("SYMBOL2"));
    // Access content with symb.content
} else {
    // Fallback to a default if the symbol does not exist
};`,
      },
      {
        path: 'path/to/file3',
        start_line: 4,
        end_line: 4,
        annotation_level: 'failure',
        title: 'Overwrite violation: SYMBOL3',
        message: 'The symbol "SYMBOL3" is not allowed to be re-declared / defined.',
      },
    ]
    const expectedOutput = {
      title: '3 violations',
      summary,
      text:
        'The patch validator checked 4 symbols.\n\n' +
        'For more details, see [Ninja documentation](https://github.com/szapp/Ninja/wiki/Inject-Changes).',
      annotations: expectedAnnotations,
    }

    fsReadFileSyncMock.mockReturnValue(`
const int Symbol1 = 0; // The Symbol1 is a global symbol
const int Symbol2 = 0;
const int Symbol3 = 0;
`)

    const result = await write.annotations(parsers, prefix, check_id, summary)

    expect(updateCheckMock).toHaveBeenCalledWith(
      expect.objectContaining({
        ...github.context.repo,
        check_run_id: check_id,
        completed_at: expect.any(String),
        conclusion: 'failure',
        output: expectedOutput,
      })
    )

    expect(result).toEqual(expectedAnnotations)
  })

  it('creates annotations for one invalid symbol', async () => {
    const parsers = [
      {
        numSymbols: 1,
        namingViolations: [{ name: 'SYMBOL2', file: 'path/to/file2', line: 3 }],
        referenceViolations: [],
        overwriteViolations: [],
      } as unknown as Parser,
    ]
    const prefix = ['PATCH_', 'FOO_', 'BAR_', 'BAZ_']
    const check_id = 42
    const summary = 'summary text'
    const writeVal = true

    const expectedAnnotations = [
      {
        path: 'path/to/file2',
        start_line: 3,
        end_line: 3,
        annotation_level: 'failure',
        title: 'Naming convention violation: SYMBOL2',
        message:
          'The symbol "SYMBOL2" poses a compatibility risk. Add a prefix to its name (e.g. PATCH_, FOO_, BAR_). If overwriting this symbol is intended, add it to the ignore list.',
        raw_details: 'var int Symbol21; var int PATCH_Symbol2;',
      },
    ]

    const expectedOutput = {
      title: '1 violation',
      summary,
      text:
        'The patch validator checked 1 symbol.\n\n' +
        'For more details, see [Ninja documentation](https://github.com/szapp/Ninja/wiki/Inject-Changes).',
      annotations: expectedAnnotations,
    }

    fsReadFileSyncMock.mockReturnValue(`
var int Symbol1;
var int Symbol21; var int Symbol2;
`)

    const result = await write.annotations(parsers, prefix, check_id, summary, writeVal)

    expect(updateCheckMock).toHaveBeenCalledWith(
      expect.objectContaining({
        ...github.context.repo,
        check_run_id: check_id,
        completed_at: expect.any(String),
        conclusion: 'failure',
        output: expectedOutput,
      })
    )
    expect(result).toEqual(expectedAnnotations)
  })

  it('creates annotations for one valid symbol', async () => {
    const parsers = [
      {
        numSymbols: 1,
        namingViolations: [],
        referenceViolations: [],
        overwriteViolations: [],
      } as unknown as Parser,
    ]
    const prefix: string[] = []
    const check_id = 42
    const summary = 'summary text'
    const writeVal = true

    const expectedAnnotations: Annotation[] = []

    const expectedOutput = {
      title: 'No violations',
      summary,
      text:
        'The patch validator checked 1 symbol.\n\n' +
        'For more details, see [Ninja documentation](https://github.com/szapp/Ninja/wiki/Inject-Changes).',
      annotations: expectedAnnotations,
    }

    const result = await write.annotations(parsers, prefix, check_id, summary, writeVal)

    expect(updateCheckMock).toHaveBeenCalledWith(
      expect.objectContaining({
        ...github.context.repo,
        check_run_id: check_id,
        completed_at: expect.any(String),
        conclusion: 'success',
        output: expectedOutput,
      })
    )
    expect(result).toEqual(expectedAnnotations)
  })

  it('does not create annotations if write is not truthy', async () => {
    const parsers = [
      {
        numSymbols: 1,
        namingViolations: [{ name: 'SYMBOL2', file: 'path/to/file2', line: 2 }],
        referenceViolations: [],
        overwriteViolations: [],
      } as unknown as Parser,
    ]
    const prefix: string[] = []
    const check_id = 42
    const summary = 'summary text'
    const writeVal = false

    const expectedAnnotations = [
      {
        path: 'path/to/file2',
        start_line: 2,
        end_line: 2,
        annotation_level: 'failure',
        title: 'Naming convention violation: SYMBOL2',
        message:
          'The symbol "SYMBOL2" poses a compatibility risk. Add a prefix to its name (e.g. ). If overwriting this symbol is intended, add it to the ignore list.',
        raw_details: 'var int Symbol21; var int undefinedSymbol2;',
      },
    ]

    fsReadFileSyncMock.mockReturnValue(`
var int Symbol21; var int Symbol2;
`)

    const result = await write.annotations(parsers, prefix, check_id, summary, writeVal)

    expect(updateCheckMock).not.toHaveBeenCalled()
    expect(result).toEqual(expectedAnnotations)
  })
})

describe('summary', () => {
  beforeEach(() => {
    jest.spyOn(core.summary, 'addHeading').mockImplementation(() => core.summary)
    jest.spyOn(core.summary, 'addTable').mockImplementation(() => core.summary)
    jest.spyOn(core.summary, 'addRaw').mockImplementation(() => core.summary)
    jest.spyOn(core.summary, 'addEOL').mockImplementation(() => core.summary)
    jest.spyOn(core.summary, 'addList').mockImplementation(() => core.summary)
    jest.spyOn(core.summary, 'stringify').mockImplementation(() => 'summary text')
    jest.spyOn(core.summary, 'emptyBuffer').mockImplementation()
    jest.spyOn(core.summary, 'write').mockImplementation()
  })

  it('builds summary, writes it to GitHub and returns it', async () => {
    const parsers = [new Parser('', 'path/to/File1.src'), new Parser('', 'File2.src'), new Parser('', 'File3.src')]
    const duration = 4035
    const prefixes = ['PATCH_', 'FOO_', 'BAR_']
    const details_url = 'https://example.com/details'
    parsers[0].numSymbols = 3
    parsers[1].numSymbols = 1
    parsers[2].numSymbols = 5
    parsers[0].duration = 42
    parsers[1].duration = 20
    parsers[2].duration = 2040
    parsers[0].namingViolations = [{ name: 'Symbol1', file: 'path/to/file1', line: 10 }]
    parsers[2].referenceViolations = [{ name: 'Symbol2', file: 'path/to/file2', line: 20 }]
    parsers[2].overwriteViolations = [{ name: 'Symbol3', file: 'path/to/file3', line: 30 }]

    const result = await write.summary(parsers, prefixes, duration, details_url)

    expect(core.summary.addTable).toHaveBeenCalledWith([
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
      ['🔴 Fail', 'File1.src', '1', '0', '0', '3', '42 milliseconds'],
      ['🟢 Pass', 'File2.src', '0', '0', '0', '1', '20 milliseconds'],
      ['🔴 Fail', 'File3.src', '0', '1', '1', '5', '2 seconds, 40 milliseconds'],
    ])
    expect(core.summary.addRaw).toHaveBeenCalledWith('Violations: 3/9. Duration: 4 seconds, 35 milliseconds.', true)
    expect(core.summary.addEOL).toHaveBeenCalled()
    expect(core.summary.addRaw).toHaveBeenCalledWith('See the <a href="https://example.com/details">check run for details</a>.', true)
    expect(core.summary.addHeading).toHaveBeenCalledWith('Types of violations', 3)
    expect(core.summary.addList).toHaveBeenCalledWith(expect.arrayContaining([expect.any(String)]))
    expect(core.summary.addRaw).toHaveBeenCalledWith(
      'Naming violations can be corrected by prefixing the names of all global symbols (i.e. symbols declared outside of functions, classes, instances, and prototypes) with one of the following prefixes (add more in the <a href="https://github.com/szapp/patch-validator/#configuration">configuration</a>).',
      true
    )
    expect(core.summary.addList).toHaveBeenCalledWith(['<code>PATCH_</code>', '<code>FOO_</code>', '<code>BAR_</code>'])
    expect(core.summary.stringify).toHaveBeenCalled()
    expect(core.summary.write).toHaveBeenCalledWith({ overwrite: false })
    expect(core.summary.emptyBuffer).toHaveBeenCalled()
    expect(result).toBe('summary text')
  })

  it('builds summary for no violations and no details_url and does not write it to GitHub', async () => {
    const parsers = [new Parser('', 'path/to/File1.src')]
    const duration = 1024
    const prefixes: string[] = []
    const details_url = null
    const writeVal = false
    parsers[0].numSymbols = 1
    parsers[0].duration = 20

    const result = await write.summary(parsers, prefixes, duration, details_url, writeVal)

    expect(core.summary.addTable).toHaveBeenCalledWith([
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
      ['🟢 Pass', 'File1.src', '0', '0', '0', '1', '20 milliseconds'],
    ])
    expect(core.summary.addRaw).toHaveBeenCalledWith('Violations: 0/1. Duration: 1 second, 24 milliseconds.', true)
    expect(core.summary.addEOL).toHaveBeenCalled()
    expect(core.summary.addRaw).not.toHaveBeenCalledWith(expect.stringContaining('check run for details'), expect.any(Boolean))
    expect(core.summary.addHeading).toHaveBeenCalledWith('Types of violations', 3)
    expect(core.summary.addList).toHaveBeenCalledWith(expect.arrayContaining([expect.any(String)]))
    expect(core.summary.addRaw).toHaveBeenCalledWith(
      'Naming violations can be corrected by prefixing the names of all global symbols (i.e. symbols declared outside of functions, classes, instances, and prototypes) with one of the following prefixes (add more in the <a href="https://github.com/szapp/patch-validator/#configuration">configuration</a>).',
      true
    )
    expect(core.summary.addList).toHaveBeenCalledWith([])
    expect(core.summary.stringify).toHaveBeenCalled()
    expect(core.summary.write).not.toHaveBeenCalled()
    expect(core.summary.emptyBuffer).toHaveBeenCalled()
    expect(result).toBe('summary text')
  })
})
