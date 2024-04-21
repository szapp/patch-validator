import * as main from '../src/main.ts'

let runMock: jest.SpiedFunction<typeof main.run>

describe('index', () => {
  beforeEach(() => {
    runMock = jest.spyOn(main, 'run').mockImplementation()
  })

  it('calls run when imported', async () => {
    jest.replaceProperty(process, 'env', { ...process.env, GITHUB_WORKSPACE: '' })
    require('../src/index.js')

    expect(runMock).toHaveBeenCalledWith(true)
  })

  it('does not call run when imported out side of GitHub actions', async () => {
    jest.replaceProperty(process, 'env', { ...process.env, GITHUB_WORKSPACE: undefined })
    require('../src/index.js')

    expect(runMock).not.toHaveBeenCalled()
  })
})
