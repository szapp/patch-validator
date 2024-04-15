import write from '../src/write.ts'
import * as core from '@actions/core'
import * as github from '@actions/github'
import { SymbolTable } from 'src/class.ts'

let createCheckMock: jest.Mock

describe('symbols', () => {
  it('prints global symbols with invalid symbols highlighted in red', () => {
    const symbolTable = [
      { name: 'Symbol1', file: '', line: 0 },
      { name: 'Symbol2', file: '', line: 0 },
      { name: 'Symbol3', file: '', line: 0 },
    ]
    const symbolTableInvalid = [
      { name: 'Symbol2', file: '', line: 0 },
      { name: 'Symbol3', file: '', line: 0 },
    ]

    jest.spyOn(core, 'startGroup').mockImplementation()
    jest.spyOn(core, 'endGroup').mockImplementation()
    jest.spyOn(core, 'info').mockImplementation()

    write.symbols(symbolTable, symbolTableInvalid)

    expect(core.startGroup).toHaveBeenCalledWith('Global Symbols')
    expect(core.info).toHaveBeenCalledWith('\u001b[32mSymbol1\u001b[0m')
    expect(core.info).toHaveBeenCalledWith('\u001b[31mSymbol2\u001b[0m')
    expect(core.info).toHaveBeenCalledWith('\u001b[31mSymbol3\u001b[0m')
    expect(core.endGroup).toHaveBeenCalled()
  })
})

describe('summary', () => {
  beforeEach(() => {
    jest.spyOn(core.summary, 'addHeading').mockImplementation(() => core.summary)
    jest.spyOn(core.summary, 'addTable').mockImplementation(() => core.summary)
    jest.spyOn(core.summary, 'addRaw').mockImplementation(() => core.summary)
    jest.spyOn(core.summary, 'addEOL').mockImplementation(() => core.summary)
    jest.spyOn(core.summary, 'write').mockImplementation()

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    createCheckMock = jest.fn((_params) => ({ data: { html_url: 'https://example.com' } }))

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

  it('adds validation results to the summary', async () => {
    const symbolTableInvalid = [
      { name: 'Symbol2', file: 'path/to/file2', line: 10 },
      { name: 'Symbol3', file: 'path/to/file3', line: 20 },
    ]
    const basePath = 'path/to'
    const details_url = 'https://example.com/details'

    await write.summary(symbolTableInvalid, 3, basePath, details_url, '1m 3s')

    expect(core.summary.addHeading).toHaveBeenCalledWith('Validation Results')
    expect(core.summary.addTable).toHaveBeenCalledWith([
      [
        { data: 'Test result 🔬', header: true },
        { data: 'Symbol 📇', header: true },
        { data: 'File 📁', header: true },
      ],
      ['🔴 Fail', 'Symbol2', 'file2:10'],
      ['🔴 Fail', 'Symbol3', 'file3:20'],
    ])
    expect(core.summary.addEOL).toHaveBeenCalledTimes(2)
    expect(core.summary.addRaw).toHaveBeenCalledWith('Violations: 2/3. Duration: 1m 3s.', true)
    expect(core.summary.addRaw).toHaveBeenCalledWith('<a href="https://example.com/details">Details</a>.', true)
    expect(core.summary.write).toHaveBeenCalledWith({ overwrite: false })
  })

  it('adds blank results to the summary if there are no violations', async () => {
    const basePath = 'path/to'
    const details_url = 'https://example.com/details'

    await write.summary([], 3, basePath, details_url, '1m 3s')

    expect(core.summary.addHeading).toHaveBeenCalledWith('Validation Results')
    expect(core.summary.addTable).toHaveBeenCalledWith([
      [
        { data: 'Test result 🔬', header: true },
        { data: 'Symbol 📇', header: true },
        { data: 'File 📁', header: true },
      ],
      ['🟢 Pass', '-', '-'],
    ])
    expect(core.summary.addEOL).toHaveBeenCalledTimes(2)
    expect(core.summary.addRaw).toHaveBeenCalledWith('Violations: 0/3. Duration: 1m 3s.', true)
    expect(core.summary.addRaw).toHaveBeenCalledWith('<a href="https://example.com/details">Details</a>.', true)
    expect(core.summary.write).toHaveBeenCalledWith({ overwrite: false })
  })

  it('does not add details link if details_url is null', async () => {
    const symbolTableInvalid = [
      { name: 'Symbol2', file: 'file2', line: 10 },
      { name: 'Symbol3', file: 'file3', line: 20 },
    ]
    const basePath = ''
    const details_url = null

    await write.summary(symbolTableInvalid, 3, basePath, details_url, '1m 3s')

    expect(core.summary.addRaw).toHaveBeenCalledWith('', true)
  })
})

describe('annotations', () => {
  beforeEach(() => {
    jest.spyOn(core, 'getInput').mockReturnValue('dummy-token')

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    createCheckMock = jest.fn((_params) => ({ data: { html_url: 'https://example.com' } }))

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

  it('creates annotations for invalid symbols', async () => {
    const symbolTableInvalid = [
      { name: 'Symbol2', file: 'path/to/file2', line: 10 },
      { name: 'Symbol3', file: 'path/to/file3', line: 20 },
    ]

    const expectedAnnotations = [
      {
        path: 'path/to/file2',
        start_line: 10,
        end_line: 10,
        annotation_level: 'failure',
        message:
          'The symbol "Symbol2" poses a compatibility risk. Add a prefix to its name (e.g. PATCH_). If overwriting this symbol is intended, add it to the ignore list.',
        title: 'Naming convention violation: Symbol2',
      },
      {
        path: 'path/to/file3',
        start_line: 20,
        end_line: 20,
        annotation_level: 'failure',
        message:
          'The symbol "Symbol3" poses a compatibility risk. Add a prefix to its name (e.g. PATCH_). If overwriting this symbol is intended, add it to the ignore list.',
        title: 'Naming convention violation: Symbol3',
      },
    ]

    const expectedOutput = {
      title: '2 violations',
      summary: 'The patch validator found 2 invalid symbol names (1m 30s)',
      text: `The patch validator checked 3 global symbol names.

For more details, see [Ninja documentation](https://github.com/szapp/Ninja/wiki/Inject-Changes#naming-conventions).`,
      annotations: expectedAnnotations,
    }

    const result = await write.annotations(symbolTableInvalid, 3, ['PATCH_'], new Date(), '1m 30s')

    expect(createCheckMock).toHaveBeenCalledWith(
      expect.objectContaining({
        ...github.context.repo,
        name: 'Patch Validator',
        head_sha: github.context.sha,
        external_id: 'workflow.yml',
        started_at: expect.any(String),
        completed_at: expect.any(String),
        conclusion: 'failure',
        output: expectedOutput,
      })
    )
    expect(result).toBe('https://example.com')
  })

  it('creates annotations for one invalid symbol', async () => {
    const symbolTableInvalid = [{ name: 'Symbol2', file: 'path/to/file2', line: 10 }]

    const expectedAnnotations = [
      {
        path: 'path/to/file2',
        start_line: 10,
        end_line: 10,
        annotation_level: 'failure',
        message:
          'The symbol "Symbol2" poses a compatibility risk. Add a prefix to its name (e.g. PATCH_, FOO_, BAR_). If overwriting this symbol is intended, add it to the ignore list.',
        title: 'Naming convention violation: Symbol2',
      },
    ]

    const expectedOutput = {
      title: '1 violation',
      summary: 'The patch validator found 1 invalid symbol name (1m 30s)',
      text: `The patch validator checked 1 global symbol name.

For more details, see [Ninja documentation](https://github.com/szapp/Ninja/wiki/Inject-Changes#naming-conventions).`,
      annotations: expectedAnnotations,
    }

    const result = await write.annotations(symbolTableInvalid, 1, ['PATCH_', 'FOO_', 'BAR_', 'BAZ_'], new Date(), '1m 30s')

    expect(createCheckMock).toHaveBeenCalledWith(
      expect.objectContaining({
        ...github.context.repo,
        name: 'Patch Validator',
        head_sha: github.context.sha,
        external_id: 'workflow.yml',
        started_at: expect.any(String),
        completed_at: expect.any(String),
        conclusion: 'failure',
        output: expectedOutput,
      })
    )
    expect(result).toBe('https://example.com')
  })

  it('creates annotations for one valid symbol', async () => {
    const symbolTableInvalid: SymbolTable = []
    const expectedAnnotations: Record<string, unknown>[] = []

    const expectedOutput = {
      title: 'No violations',
      summary: 'The patch validator found no invalid symbol names (1m 30s)',
      text: `The patch validator checked 1 global symbol name.

For more details, see [Ninja documentation](https://github.com/szapp/Ninja/wiki/Inject-Changes#naming-conventions).`,
      annotations: expectedAnnotations,
    }

    const result = await write.annotations(symbolTableInvalid, 1, [], new Date(), '1m 30s')

    expect(createCheckMock).toHaveBeenCalledWith(
      expect.objectContaining({
        ...github.context.repo,
        name: 'Patch Validator',
        head_sha: github.context.sha,
        external_id: 'workflow.yml',
        started_at: expect.any(String),
        completed_at: expect.any(String),
        conclusion: 'success',
        output: expectedOutput,
      })
    )
    expect(result).toBe('https://example.com')
  })
})
