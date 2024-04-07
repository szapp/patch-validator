import * as main from '../src/main.ts'

const runMock = jest.spyOn(main, 'run').mockImplementation()

describe('index', () => {
  it('calls run when imported', async () => {
    require('../src/index.js')

    expect(runMock).toHaveBeenCalled()
  })
})
