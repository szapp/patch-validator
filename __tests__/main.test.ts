import * as core from '@actions/core'
import * as main from '../src/main.ts'
import * as parse from '../src/parse.ts'
import * as validate from '../src/validate.ts'
import * as inputs from '../src/inputs.ts'
import write from '../src/write.ts'
import * as cleanup from '../src/cleanup.ts'

const runMock = jest.spyOn(main, 'run')

describe('run', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    jest.spyOn(inputs, 'loadInputs').mockReturnValue({ relPath: '', basePath: '', patchName: '', prefix: [], ignore: [] })
    jest.spyOn(parse, 'parseCandidates').mockResolvedValue([])
    jest.spyOn(validate, 'formatFilters').mockReturnValue({ prefix: [], ignore: [] })
    jest.spyOn(validate, 'validate').mockReturnValue([])
    jest.spyOn(write, 'symbols').mockImplementation()
    jest.spyOn(write, 'annotations').mockResolvedValue('')
    jest.spyOn(write, 'summary').mockImplementation()
    jest.spyOn(cleanup, 'workflow').mockResolvedValue(false)
    jest.spyOn(core, 'setFailed').mockImplementation()
  })

  it('should run the main function successfully', async () => {
    await main.run()
    expect(runMock).toHaveReturned()
    expect(cleanup.workflow).toHaveBeenCalledTimes(1)
    expect(inputs.loadInputs).toHaveBeenCalledTimes(1)
    expect(parse.parseCandidates).toHaveBeenCalledTimes(1)
    expect(validate.formatFilters).toHaveBeenCalledTimes(1)
    expect(validate.validate).toHaveBeenCalledTimes(1)
    expect(write.symbols).toHaveBeenCalledTimes(1)
    expect(write.annotations).toHaveBeenCalledTimes(1)
    expect(write.summary).toHaveBeenCalledTimes(1)
    expect(core.setFailed).not.toHaveBeenCalled()
  })

  it('should run the cleanup function and return', async () => {
    jest.spyOn(cleanup, 'workflow').mockResolvedValue(true)
    await main.run()
    expect(runMock).toHaveReturned()
    expect(cleanup.workflow).toHaveBeenCalledTimes(1)
    expect(inputs.loadInputs).not.toHaveBeenCalled()
    expect(parse.parseCandidates).not.toHaveBeenCalled()
    expect(validate.formatFilters).not.toHaveBeenCalled()
    expect(validate.validate).not.toHaveBeenCalled()
    expect(write.symbols).not.toHaveBeenCalled()
    expect(write.annotations).not.toHaveBeenCalled()
    expect(write.summary).not.toHaveBeenCalled()
    expect(core.setFailed).not.toHaveBeenCalled()
  })

  it('should handle errors and set the appropriate outputs (Error)', async () => {
    jest.spyOn(cleanup, 'workflow').mockImplementation(() => {
      throw new Error('test error')
    })

    await main.run()
    expect(runMock).toHaveReturned()
    expect(cleanup.workflow).toThrow('test error')
    expect(inputs.loadInputs).not.toHaveBeenCalled()
    expect(parse.parseCandidates).not.toHaveBeenCalled()
    expect(validate.formatFilters).not.toHaveBeenCalled()
    expect(validate.validate).not.toHaveBeenCalled()
    expect(write.symbols).not.toHaveBeenCalled()
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

    await main.run()
    expect(runMock).toHaveReturned()
    expect(cleanup.workflow).toThrow('test error')
    expect(inputs.loadInputs).not.toHaveBeenCalled()
    expect(parse.parseCandidates).not.toHaveBeenCalled()
    expect(validate.formatFilters).not.toHaveBeenCalled()
    expect(validate.validate).not.toHaveBeenCalled()
    expect(write.symbols).not.toHaveBeenCalled()
    expect(write.annotations).not.toHaveBeenCalled()
    expect(write.summary).not.toHaveBeenCalled()
    expect(core.setFailed).toHaveBeenCalledTimes(1)
    expect(core.setFailed).toHaveBeenCalledWith('test error')
    expect(core.setFailed).toHaveReturned()
  })
})
