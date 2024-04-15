import * as core from '@actions/core'
import * as github from '@actions/github'
import { workflow } from '../src/cleanup.ts'
import timers from 'timers/promises'

let getWorkflowRunMock: jest.Mock
let listWorkflowRunsMock: jest.Mock
let listWorkflowRunsForRepoMock: jest.Mock
let deleteWorkflowRunMock: jest.Mock

describe('cleanup', () => {
  beforeEach(() => {
    jest.spyOn(core.summary, 'addHeading').mockImplementation(() => core.summary)
    jest.spyOn(core.summary, 'addRaw').mockImplementation(() => core.summary)
    jest.spyOn(core.summary, 'write').mockImplementation()
    jest.spyOn(core, 'info').mockImplementation()
    jest.spyOn(core, 'setFailed').mockImplementation()
    jest.spyOn(process, 'exit').mockImplementation()
    jest.spyOn(timers, 'setTimeout').mockImplementation()

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    getWorkflowRunMock = jest.fn(async (_params) => ({
      data: { workflow_id: 123 },
    }))
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    listWorkflowRunsMock = jest.fn(async (_params) => ({
      data: {
        workflow_runs: [
          { id: 1, event: 'push', status: 'in_progress' },
          { id: 2, event: 'check_run', status: 'in_progress' },
          { id: 3, event: 'workflow_run', status: 'completed' },
        ],
      },
    }))
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    listWorkflowRunsForRepoMock = jest.fn(async (_params) => ({
      data: {
        workflow_runs: [] as { id: number; event: string }[],
      },
    }))
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    deleteWorkflowRunMock = jest.fn(async (_params) => {})

    jest.spyOn(github, 'getOctokit').mockReturnValue({
      rest: {
        actions: {
          getWorkflowRun: getWorkflowRunMock,
          listWorkflowRuns: listWorkflowRunsMock,
          listWorkflowRunsForRepo: listWorkflowRunsForRepoMock,
          deleteWorkflowRun: deleteWorkflowRunMock,
        },
      },
    } as unknown as ReturnType<typeof github.getOctokit>)
    jest.replaceProperty(github, 'context', {
      eventName: 'check_run',
      workflow: 'workflow.yml',
      payload: {
        action: 'completed',
        check_run: {
          head_sha: 'abc123',
          external_id: 'workflow.yml',
          name: 'Patch Validator',
          html_url: 'https://example.com/check_run',
          conclusion: 'success',
        },
      },
      repo: {
        owner: 'owner',
        repo: 'repo',
      },
      runId: 2,
    } as unknown as typeof github.context)
  })

  it('should return false if the event is not check_run or action is not completed', async () => {
    github.context.eventName = 'push'
    github.context.payload.action = 'created'

    const result = await workflow()

    expect(result).toBe(false)
    expect(listWorkflowRunsForRepoMock).not.toHaveBeenCalled()
    expect(getWorkflowRunMock).not.toHaveBeenCalled()
    expect(listWorkflowRunsMock).not.toHaveBeenCalled()
    expect(deleteWorkflowRunMock).not.toHaveBeenCalled()
    expect(core.summary.addHeading).not.toHaveBeenCalled()
    expect(core.summary.addRaw).not.toHaveBeenCalled()
    expect(core.summary.write).not.toHaveBeenCalled()
    expect(core.setFailed).not.toHaveBeenCalled()
    expect(process.exit).not.toHaveBeenCalled()
  })

  it('should fail when run with the incorrect check_un', async () => {
    github.context.eventName = 'check_run'
    github.context.payload.action = 'completed'
    github.context.payload.check_run.conclusion = 'failure'
    github.context.payload.check_run.external_id = 'wrong-workflow.yml'

    const result = await workflow()

    expect(result).toBe(true)
    expect(timers.setTimeout).not.toHaveBeenCalled()
    expect(listWorkflowRunsForRepoMock).not.toHaveBeenCalled()
    expect(getWorkflowRunMock).not.toHaveBeenCalled()
    expect(listWorkflowRunsMock).not.toHaveBeenCalled()
    expect(deleteWorkflowRunMock).not.toHaveBeenCalled()
    expect(deleteWorkflowRunMock).not.toHaveBeenCalled()
    expect(core.summary.addHeading).not.toHaveBeenCalled()
    expect(core.summary.addRaw).not.toHaveBeenCalled()
    expect(core.summary.write).not.toHaveBeenCalled()
    expect(core.setFailed).toHaveBeenCalledWith('This action is only intended to be run on the "Patch Validator" check run')
  })

  it('should delete workflow runs and set exit code if the event is check_run and action is completed', async () => {
    github.context.eventName = 'check_run'
    github.context.payload.action = 'completed'
    github.context.payload.check_run.conclusion = 'success'
    github.context.payload.check_run.external_id = 'workflow.yml'
    listWorkflowRunsForRepoMock.mockResolvedValueOnce({
      data: {
        workflow_runs: [{ id: 1, event: 'push' }],
      },
    })

    const result = await workflow()

    expect(result).toBe(true)
    expect(timers.setTimeout).toHaveBeenCalledWith(15000)
    expect(timers.setTimeout).toHaveBeenCalledTimes(2)
    expect(listWorkflowRunsForRepoMock).toHaveBeenCalledWith({
      ...github.context.repo,
      status: 'in_progress',
      head_sha: github.context.payload.check_run.head_sha,
    })
    expect(listWorkflowRunsForRepoMock).toHaveBeenCalledTimes(2)
    expect(getWorkflowRunMock).toHaveBeenCalledWith({
      ...github.context.repo,
      run_id: github.context.runId,
    })
    expect(listWorkflowRunsMock).toHaveBeenCalledWith({
      ...github.context.repo,
      workflow_id: 123,
      head_sha: github.context.payload.check_run.head_sha,
    })
    expect(core.info).toHaveBeenCalledWith('Runs to delete: 1(in_progress), 3(completed)')
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
    expect(core.setFailed).not.toHaveBeenCalled()
    expect(process.exitCode).toBe(core.ExitCode.Success)
  })

  it('should handle errors when deleting workflow runs', async () => {
    github.context.eventName = 'check_run'
    github.context.payload.action = 'completed'
    github.context.payload.check_run.conclusion = 'failure'
    github.context.payload.check_run.external_id = 'workflow.yml'
    deleteWorkflowRunMock.mockRejectedValueOnce(new Error('Delete error'))

    const result = await workflow()

    expect(result).toBe(true)
    expect(timers.setTimeout).toHaveBeenCalledWith(15000)
    expect(timers.setTimeout).toHaveBeenCalledTimes(1)
    expect(listWorkflowRunsForRepoMock).toHaveBeenCalledWith({
      ...github.context.repo,
      status: 'in_progress',
      head_sha: github.context.payload.check_run.head_sha,
    })
    expect(getWorkflowRunMock).toHaveBeenCalledWith({
      ...github.context.repo,
      run_id: github.context.runId,
    })
    expect(listWorkflowRunsMock).toHaveBeenCalledWith({
      ...github.context.repo,
      workflow_id: 123,
      head_sha: github.context.payload.check_run.head_sha,
    })
    expect(core.info).toHaveBeenCalledWith('Runs to delete: 1(in_progress), 3(completed)')
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
    expect(core.info).toHaveBeenCalledWith(`\u001b[31m${new Error('Delete error')}\u001b[0m`)
    expect(core.setFailed).not.toHaveBeenCalled()
    expect(process.exitCode).toBe(core.ExitCode.Failure)
  })
})
