import * as core from '@actions/core'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import * as cleanup from './cleanup.js'
import * as inputs from './inputs.js'
import * as main from './main.js'
import { Parser } from './parser.js'
import write, { type Annotation } from './write.js'

vi.mock('./main.js', { spy: true })
vi.mock('@actions/core')

describe('run', () => {
  beforeEach(() => {
    vi.resetAllMocks()

    vi.spyOn(Parser, 'downloadSpecial').mockResolvedValue()
    vi.spyOn(inputs, 'loadInputs').mockReturnValue({
      workingDir: '',
      basePath: '',
      patchName: '',
      prefixList: [],
      ignoreListDecl: [],
      ignoreListRsc: [],
    })
    vi.spyOn(inputs, 'formatFilters').mockReturnValue({ prefix: [], ignoreDecl: [], ignoreRsc: [] })
    vi.spyOn(Parser, 'from').mockResolvedValue([new Parser('', '')])
    vi.spyOn(write, 'createCheckRun').mockResolvedValue({ details_url: '', check_id: 0 })
    vi.spyOn(write, 'annotations').mockResolvedValue([{} as Annotation])
    vi.spyOn(write, 'summary').mockResolvedValue('test')
    vi.spyOn(cleanup, 'workflow').mockResolvedValue(false)
  })

  test('should run the main function successfully', async () => {
    const result = await main.run(true)
    expect(main.run).toHaveReturned()
    expect(cleanup.workflow).toHaveBeenCalledTimes(1)
    expect(Parser.downloadSpecial).toHaveBeenCalledTimes(1)
    expect(inputs.loadInputs).toHaveBeenCalledTimes(1)
    expect(inputs.formatFilters).toHaveBeenCalledTimes(1)
    expect(Parser.from).toHaveBeenCalledTimes(1)
    expect(write.createCheckRun).toHaveBeenCalledTimes(1)
    expect(write.annotations).toHaveBeenCalledTimes(1)
    expect(write.summary).toHaveBeenCalledTimes(1)
    expect(core.setFailed).not.toHaveBeenCalled()
    expect(result).toMatchObject({ summary: 'test', annotations: [{} as Annotation] })
    expect(process.exitCode).toBe(core.ExitCode.Failure)
  })

  test('should run the cleanup function and return', async () => {
    vi.spyOn(cleanup, 'workflow').mockResolvedValue(true)
    await main.run(true)
    expect(main.run).toHaveReturned()
    expect(cleanup.workflow).toHaveBeenCalledTimes(1)
    expect(Parser.downloadSpecial).not.toHaveBeenCalled()
    expect(inputs.loadInputs).not.toHaveBeenCalled()
    expect(inputs.formatFilters).not.toHaveBeenCalled()
    expect(Parser.from).not.toHaveBeenCalled()
    expect(write.createCheckRun).not.toHaveBeenCalled()
    expect(write.annotations).not.toHaveBeenCalled()
    expect(write.summary).not.toHaveBeenCalled()
    expect(core.setFailed).not.toHaveBeenCalled()
  })

  test('should handle errors and set the appropriate outputs (Error)', async () => {
    vi.spyOn(cleanup, 'workflow').mockImplementation(() => {
      throw new Error('test error')
    })

    await main.run(true)
    expect(main.run).toHaveReturned()
    expect(cleanup.workflow).toThrow('test error')
    expect(Parser.downloadSpecial).not.toHaveBeenCalled()
    expect(inputs.loadInputs).not.toHaveBeenCalled()
    expect(inputs.formatFilters).not.toHaveBeenCalled()
    expect(Parser.from).not.toHaveBeenCalled()
    expect(write.createCheckRun).not.toHaveBeenCalled()
    expect(write.annotations).not.toHaveBeenCalled()
    expect(write.summary).not.toHaveBeenCalled()
    expect(core.setFailed).toHaveBeenCalledTimes(1)
    expect(core.setFailed).toHaveBeenCalledWith('test error')
    expect(core.setFailed).toHaveReturned()
  })

  test('should handle errors and set the appropriate outputs (non-Error)', async () => {
    vi.spyOn(cleanup, 'workflow').mockImplementation(() => {
      throw 'test error'
    })

    await main.run(true)
    expect(main.run).toHaveReturned()
    expect(cleanup.workflow).toThrow('test error')
    expect(Parser.downloadSpecial).not.toHaveBeenCalled()
    expect(inputs.loadInputs).not.toHaveBeenCalled()
    expect(inputs.formatFilters).not.toHaveBeenCalled()
    expect(Parser.from).not.toHaveBeenCalled()
    expect(write.createCheckRun).not.toHaveBeenCalled()
    expect(write.annotations).not.toHaveBeenCalled()
    expect(write.summary).not.toHaveBeenCalled()
    expect(core.setFailed).toHaveBeenCalledTimes(1)
    expect(core.setFailed).toHaveBeenCalledWith('test error')
    expect(core.setFailed).toHaveReturned()
  })

  test('should handle errors when run in non-github mode', async () => {
    vi.spyOn(inputs, 'loadInputs').mockImplementation(() => {
      throw new Error('test error')
    })
    vi.spyOn(console, 'error').mockReturnValueOnce()

    await main.run()
    expect(main.run).toHaveReturned()

    expect(main.run).toHaveReturned()
    expect(cleanup.workflow).not.toHaveBeenCalled()
    expect(Parser.downloadSpecial).toHaveBeenCalledTimes(1)
    expect(inputs.loadInputs).toThrow('test error')
    expect(console.error).toHaveBeenCalledWith('test error')
    expect(inputs.formatFilters).not.toHaveBeenCalled()
    expect(Parser.from).not.toHaveBeenCalled()
    expect(write.createCheckRun).not.toHaveBeenCalled()
    expect(write.annotations).not.toHaveBeenCalled()
    expect(write.summary).not.toHaveBeenCalled()
    expect(core.setFailed).not.toHaveBeenCalled()
  })
})
