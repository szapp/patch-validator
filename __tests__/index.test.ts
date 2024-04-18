import * as main from '../src/main.ts'

let runMock: jest.SpiedFunction<typeof main.run>

describe('index', () => {
  beforeEach(() => {
    runMock = jest.spyOn(main, 'run').mockImplementation()
  })

  it('calls run when imported', async () => {
    require('../src/index.js')

    expect(runMock).toHaveBeenCalled()
  })
})
