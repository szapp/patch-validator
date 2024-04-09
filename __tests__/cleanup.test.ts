import * as core from '@actions/core'
import * as github from '@actions/github'
import { workflow } from '../src/cleanup.ts'

// Mock the GitHub API
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const getWorkflowRunMock = jest.fn((_params) => ({
  data: { workflow_id: 123 },
}))
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const listWorkflowRunsMock = jest.fn((_params) => ({
  data: {
    workflow_runs: [
      { id: 1, event: 'push' },
      { id: 2, event: 'check_run' },
      { id: 3, event: 'workflow_run' },
    ],
  },
}))
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const deleteWorkflowRunMock = jest.fn(async (_params) => {})
jest.mock('@actions/github', () => {
  return {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    getOctokit: (_token: string) => {
      return {
        rest: {
          actions: {
            getWorkflowRun: getWorkflowRunMock,
            listWorkflowRuns: listWorkflowRunsMock,
            deleteWorkflowRun: deleteWorkflowRunMock,
          },
        },
      }
    },
    context: {
      eventName: 'check_run',
      payload: {
        action: 'completed',
        check_run: {
          head_sha: 'abc123',
          name: 'My Check Run',
          html_url: 'https://example.com/check_run',
          conclusion: 'success',
        },
      },
      repo: {
        owner: 'owner',
        repo: 'repo',
      },
      runId: 123,
    },
  }
})

describe('cleanup', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    jest.spyOn(core.summary, 'addHeading').mockImplementation(() => core.summary)
    jest.spyOn(core.summary, 'addRaw').mockImplementation(() => core.summary)
    jest.spyOn(core.summary, 'write').mockImplementation()
    jest.spyOn(core, 'error').mockImplementation()
    jest.spyOn(process, 'exit').mockImplementation()
  })

  it('should return false if the event is not check_run or action is not completed', async () => {
    github.context.eventName = 'push'
    github.context.payload.action = 'created'

    const result = await workflow()

    expect(result).toBe(false)
    expect(getWorkflowRunMock).not.toHaveBeenCalled()
    expect(listWorkflowRunsMock).not.toHaveBeenCalled()
    expect(deleteWorkflowRunMock).not.toHaveBeenCalled()
    expect(core.summary.addHeading).not.toHaveBeenCalled()
    expect(core.summary.addRaw).not.toHaveBeenCalled()
    expect(core.summary.write).not.toHaveBeenCalled()
    expect(core.error).not.toHaveBeenCalled()
    expect(process.exit).not.toHaveBeenCalled()
  })

  it('should delete workflow runs and set exit code if the event is check_run and action is completed', async () => {
    github.context.eventName = 'check_run'
    github.context.payload.action = 'completed'
    github.context.payload.check_run.conclusion = 'success'

    const result = await workflow()

    expect(result).toBe(true)
    expect(getWorkflowRunMock).toHaveBeenCalledWith({
      ...github.context.repo,
      run_id: github.context.runId,
    })
    expect(listWorkflowRunsMock).toHaveBeenCalledWith({
      ...github.context.repo,
      workflow_id: 123,
      head_sha: github.context.payload.check_run.head_sha,
    })
    expect(deleteWorkflowRunMock).toHaveBeenCalledWith({
      ...github.context.repo,
      run_id: 1,
    })
    expect(deleteWorkflowRunMock).toHaveBeenCalledWith({
      ...github.context.repo,
      run_id: 3,
    })
    expect(core.summary.addHeading).toHaveBeenCalledWith(github.context.payload.check_run.name)
    expect(core.summary.addRaw).toHaveBeenCalledWith(`<a href="${github.context.payload.check_run.html_url}">Details</a>`, true)
    expect(core.summary.write).toHaveBeenCalledWith({ overwrite: false })
    expect(core.error).not.toHaveBeenCalled()
    expect(process.exitCode).toBe(core.ExitCode.Success)
  })

  it('should handle errors when deleting workflow runs', async () => {
    github.context.eventName = 'check_run'
    github.context.payload.action = 'completed'
    github.context.payload.check_run.conclusion = 'failure'
    deleteWorkflowRunMock.mockRejectedValueOnce(new Error('Delete error'))

    const result = await workflow()

    expect(result).toBe(true)
    expect(getWorkflowRunMock).toHaveBeenCalledWith({
      ...github.context.repo,
      run_id: github.context.runId,
    })
    expect(listWorkflowRunsMock).toHaveBeenCalledWith({
      ...github.context.repo,
      workflow_id: 123,
      head_sha: github.context.payload.check_run.head_sha,
    })
    expect(deleteWorkflowRunMock).toHaveBeenCalledWith({
      ...github.context.repo,
      run_id: 1,
    })
    expect(deleteWorkflowRunMock).toHaveBeenCalledWith({
      ...github.context.repo,
      run_id: 3,
    })
    expect(core.summary.addHeading).toHaveBeenCalledWith(github.context.payload.check_run.name)
    expect(core.summary.addRaw).toHaveBeenCalledWith(`<a href="${github.context.payload.check_run.html_url}">Details</a>`, true)
    expect(core.summary.write).toHaveBeenCalledWith({ overwrite: false })
    expect(core.error).toHaveBeenCalledWith(new Error('Delete error'))
    expect(process.exitCode).toBe(core.ExitCode.Failure)
  })
})
