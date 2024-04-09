import * as core from '@actions/core'
import * as github from '@actions/github'

export async function workflow(): Promise<boolean> {
  // Only for completed check runs
  if (github.context.eventName !== 'check_run' || github.context.payload.action !== 'completed') return false
  const octokit = github.getOctokit(core.getInput('token'))

  // First, get the workflow ID
  const {
    data: { workflow_id },
  } = await octokit.rest.actions.getWorkflowRun({
    ...github.context.repo,
    run_id: github.context.runId,
  })

  // Then, list all workflow runs for the same commit and workflow
  const {
    data: { workflow_runs },
  } = await octokit.rest.actions.listWorkflowRuns({
    ...github.context.repo,
    workflow_id,
    head_sha: github.context.payload.check_run.head_sha,
  })

  // For all workflow runs that are not check runs, delete them
  const workflows = workflow_runs.filter((w) => w.event !== 'check_run')
  Promise.all(
    workflows.map((w) =>
      octokit.rest.actions.deleteWorkflowRun({
        ...github.context.repo,
        run_id: w.id,
      })
    )
  ).catch((error) => core.error(error))

  // The summary of the workflow runs is unfortunately not available in the API
  // So we can only link to the check run
  await core.summary
    .addHeading(github.context.payload.check_run.name)
    .addRaw(`<a href="${github.context.payload.check_run.html_url}">Details</a>`, true)
    .write({ overwrite: false })

  // To be able to use a badge, we need to set the exit code
  process.exitCode = Number(github.context.payload.check_run.conclusion !== 'success')

  // True means we stop here
  return true
}
