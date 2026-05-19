import * as core from '@actions/core'
import { beforeEach, describe, expect, test, vi } from 'vitest'

vi.mock('@actions/core')

// Mock github's context in an accessible way
const { githubContextMock, getWorkflowRunMock, listWorkflowRunsMock, listWorkflowRunsForRepoMock, deleteWorkflowRunMock } = vi.hoisted(
  () => ({
    githubContextMock: {
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
    },
    getWorkflowRunMock: vi.fn(async () => ({
      data: { workflow_id: 123 },
    })),
    listWorkflowRunsMock: vi.fn(async () => ({
      data: {
        workflow_runs: [
          { id: 1, event: 'push', status: 'in_progress' },
          { id: 2, event: 'check_run', status: 'in_progress' },
          { id: 3, event: 'workflow_run', status: 'completed' },
        ],
      },
    })),
    listWorkflowRunsForRepoMock: vi.fn(async () => ({
      data: {
        workflow_runs: [] as { id: number; event: string }[],
      },
    })),
    deleteWorkflowRunMock: vi.fn(async () => {}),
  }),
)
vi.mock(import('@actions/github'), async (importOriginal) => {
  const originalModule = await importOriginal()
  return {
    context: githubContextMock as unknown as typeof originalModule.context,
    getOctokit: vi.fn(
      () =>
        ({
          rest: {
            actions: {
              getWorkflowRun: getWorkflowRunMock,
              listWorkflowRuns: listWorkflowRunsMock,
              listWorkflowRunsForRepo: listWorkflowRunsForRepoMock,
              deleteWorkflowRun: deleteWorkflowRunMock,
            },
          },
        }) as unknown as ReturnType<typeof originalModule.getOctokit>,
    ),
  }
})

import { workflow } from './cleanup.js'

describe('cleanup', () => {
  beforeEach(() => {
    vi.resetAllMocks()

    vi.spyOn(process, 'exit').mockImplementation(() => 0 as never)
    vi.spyOn(core.summary, 'addHeading').mockReturnValue(core.summary)
    vi.spyOn(core.summary, 'addRaw').mockReturnValue(core.summary)
  })

  test('should return false if the event is not check_run or action is not completed', async () => {
    githubContextMock.eventName = 'push'
    githubContextMock.payload.action = 'created'

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

  test('should fail when run with the incorrect check_un', async () => {
    githubContextMock.eventName = 'check_run'
    githubContextMock.payload.action = 'completed'
    githubContextMock.payload.check_run.conclusion = 'failure'
    githubContextMock.payload.check_run.external_id = 'wrong-workflow.yml'

    const result = await workflow()

    expect(result).toBe(true)
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

  test('should delete workflow runs and set exit code if the event is check_run and action is completed', async () => {
    githubContextMock.eventName = 'check_run'
    githubContextMock.payload.action = 'completed'
    githubContextMock.payload.check_run.conclusion = 'success'
    githubContextMock.payload.check_run.external_id = 'workflow.yml'
    listWorkflowRunsForRepoMock.mockResolvedValueOnce({
      data: {
        workflow_runs: [{ id: 1, event: 'push' }],
      },
    })

    const result = await workflow(0)

    expect(result).toBe(true)
    expect(listWorkflowRunsForRepoMock).toHaveBeenCalledWith({
      ...githubContextMock.repo,
      status: 'in_progress',
      head_sha: githubContextMock.payload.check_run.head_sha,
    })
    expect(listWorkflowRunsForRepoMock).toHaveBeenCalledTimes(2)
    expect(getWorkflowRunMock).toHaveBeenCalledWith({
      ...githubContextMock.repo,
      run_id: githubContextMock.runId,
    })
    expect(listWorkflowRunsMock).toHaveBeenCalledWith({
      ...githubContextMock.repo,
      workflow_id: 123,
      head_sha: githubContextMock.payload.check_run.head_sha,
    })
    expect(core.info).toHaveBeenCalledWith('Runs to delete: 1(in_progress), 3(completed)')
    expect(deleteWorkflowRunMock).toHaveBeenCalledWith({
      ...githubContextMock.repo,
      run_id: 1,
    })
    expect(deleteWorkflowRunMock).toHaveBeenCalledWith({
      ...githubContextMock.repo,
      run_id: 3,
    })
    expect(core.summary.addHeading).toHaveBeenCalledWith(githubContextMock.payload.check_run.name)
    expect(core.summary.addRaw).toHaveBeenCalledWith(`<a href="${githubContextMock.payload.check_run.html_url}">Details</a>`, true)
    expect(core.summary.write).toHaveBeenCalledWith({ overwrite: false })
    expect(core.setFailed).not.toHaveBeenCalled()
    expect(process.exitCode).toBe(core.ExitCode.Success)
  })

  test('should handle errors when deleting workflow runs', async () => {
    githubContextMock.eventName = 'check_run'
    githubContextMock.payload.action = 'completed'
    githubContextMock.payload.check_run.conclusion = 'failure'
    githubContextMock.payload.check_run.external_id = 'workflow.yml'
    deleteWorkflowRunMock.mockRejectedValueOnce(new Error('Delete error'))

    const result = await workflow(0)

    expect(result).toBe(true)
    expect(listWorkflowRunsForRepoMock).toHaveBeenCalledWith({
      ...githubContextMock.repo,
      status: 'in_progress',
      head_sha: githubContextMock.payload.check_run.head_sha,
    })
    expect(getWorkflowRunMock).toHaveBeenCalledWith({
      ...githubContextMock.repo,
      run_id: githubContextMock.runId,
    })
    expect(listWorkflowRunsMock).toHaveBeenCalledWith({
      ...githubContextMock.repo,
      workflow_id: 123,
      head_sha: githubContextMock.payload.check_run.head_sha,
    })
    expect(core.info).toHaveBeenCalledWith('Runs to delete: 1(in_progress), 3(completed)')
    expect(deleteWorkflowRunMock).toHaveBeenCalledWith({
      ...githubContextMock.repo,
      run_id: 1,
    })
    expect(deleteWorkflowRunMock).toHaveBeenCalledWith({
      ...githubContextMock.repo,
      run_id: 3,
    })
    expect(core.summary.addHeading).toHaveBeenCalledWith(githubContextMock.payload.check_run.name)
    expect(core.summary.addRaw).toHaveBeenCalledWith(`<a href="${githubContextMock.payload.check_run.html_url}">Details</a>`, true)
    expect(core.summary.write).toHaveBeenCalledWith({ overwrite: false })
    expect(core.info).toHaveBeenCalledWith(`\u001b[31m${new Error('Delete error')}\u001b[0m`)
    expect(core.setFailed).not.toHaveBeenCalled()
    expect(process.exitCode).toBe(core.ExitCode.Failure)
  })
})
