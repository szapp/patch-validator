import { beforeEach, describe, expect, test, vi } from 'vitest'

const runMock = vi.fn()

vi.mock('./main.js', () => ({
  run: runMock,
}))

describe('index', () => {
  beforeEach(() => {
    vi.resetModules()
    runMock.mockClear()
  })

  test('calls run when imported', async () => {
    vi.stubEnv('GITHUB_WORKSPACE', '')
    await import('./index.js')

    expect(runMock).toHaveBeenCalledWith(true)
  })

  test('does not call run when imported out side of GitHub actions', async () => {
    vi.stubEnv('GITHUB_WORKSPACE', undefined)
    const { run } = await import('./index.js')

    expect(runMock).not.toHaveBeenCalled()

    await run(false)
    expect(runMock).toHaveBeenCalled()
  })
})
