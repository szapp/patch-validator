import * as core from '@actions/core'
import * as main from '../src/main.ts'
import { Parser } from '../src/parser.ts'
import * as inputs from '../src/inputs.ts'
import write from '../src/write.ts'
import * as cleanup from '../src/cleanup.ts'

let runMock: jest.SpiedFunction<typeof main.run>

describe('run', () => {
  beforeEach(() => {
    jest
      .spyOn(inputs, 'loadInputs')
      .mockReturnValue({ workingDir: '', relPath: '', basePath: '', patchName: '', prefixList: [], ignoreList: [] })
    jest.spyOn(inputs, 'formatFilters').mockReturnValue({ prefix: [], ignore: [] })
    jest.spyOn(Parser, 'from').mockResolvedValue([new Parser('', '')])
    jest.spyOn(write, 'createCheckRun').mockResolvedValue({ details_url: '', check_id: 0 })
    jest.spyOn(write, 'annotations').mockResolvedValue([])
    jest.spyOn(write, 'summary').mockImplementation()
    jest.spyOn(cleanup, 'workflow').mockResolvedValue(false)
    jest.spyOn(core, 'setFailed').mockImplementation()
    jest.spyOn(core, 'error').mockImplementation()
    runMock = jest.spyOn(main, 'run')
  })

  it('should run the main function successfully', async () => {
    const result = await main.run(true)
    expect(runMock).toHaveReturned()
    expect(cleanup.workflow).toHaveBeenCalledTimes(1)
    expect(inputs.loadInputs).toHaveBeenCalledTimes(1)
    expect(inputs.formatFilters).toHaveBeenCalledTimes(1)
    expect(Parser.from).toHaveBeenCalledTimes(1)
    expect(write.createCheckRun).toHaveBeenCalledTimes(1)
    expect(write.annotations).toHaveBeenCalledTimes(1)
    expect(write.summary).toHaveBeenCalledTimes(1)
    expect(core.setFailed).not.toHaveBeenCalled()
    expect(result).toMatchObject({ summary: undefined, annotations: [] })
  })

  it('should run the cleanup function and return', async () => {
    jest.spyOn(cleanup, 'workflow').mockResolvedValue(true)
    await main.run(true)
    expect(runMock).toHaveReturned()
    expect(cleanup.workflow).toHaveBeenCalledTimes(1)
    expect(inputs.loadInputs).not.toHaveBeenCalled()
    expect(inputs.formatFilters).not.toHaveBeenCalled()
    expect(Parser.from).not.toHaveBeenCalled()
    expect(write.createCheckRun).not.toHaveBeenCalled()
    expect(write.annotations).not.toHaveBeenCalled()
    expect(write.summary).not.toHaveBeenCalled()
    expect(core.setFailed).not.toHaveBeenCalled()
  })

  it('should handle errors and set the appropriate outputs (Error)', async () => {
    jest.spyOn(cleanup, 'workflow').mockImplementation(() => {
      throw new Error('test error')
    })

    await main.run(true)
    expect(runMock).toHaveReturned()
    expect(cleanup.workflow).toThrow('test error')
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

  it('should handle errors and set the appropriate outputs (non-Error)', async () => {
    jest.spyOn(cleanup, 'workflow').mockImplementation(() => {
      throw 'test error'
    })

    await main.run(true)
    expect(runMock).toHaveReturned()
    expect(cleanup.workflow).toThrow('test error')
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

  it('should handle errors when run in non-github mode', async () => {
    jest.spyOn(inputs, 'loadInputs').mockImplementation(() => {
      throw new Error('test error')
    })
    jest.spyOn(console, 'error').mockImplementation()

    await main.run()
    expect(runMock).toHaveReturned()

    expect(runMock).toHaveReturned()
    expect(cleanup.workflow).not.toHaveBeenCalled()
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
