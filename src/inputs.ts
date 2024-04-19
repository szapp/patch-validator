import * as core from '@actions/core'
import * as github from '@actions/github'
import { posix } from 'path'
import fs from 'fs'
import YAML from 'yaml'

type Inputs = {
  workingDir: string
  relPath: string
  basePath: string
  patchName: string
  prefixList: string[]
  ignoreList: string[]
}

export function loadInputs(): Inputs {
  const workingDir = core.toPosixPath(process.env['GITHUB_WORKSPACE'] ?? '')
  const patchName = core.getInput('patchName') || github.context.payload.repository?.name
  if (!patchName) throw new Error('Patch name is not available. Please provide it as an input to the action')

  // Make paths
  const relRootPath = posix.normalize(core.toPosixPath(core.getInput('rootPath'))) // Relative path to patch root
  const relBasePath = posix.join(relRootPath, 'Ninja', patchName) // Relative path to src files
  const rootPath = posix.join(workingDir, relRootPath) // Absolute path to patch root
  const basePath = posix.join(workingDir, relBasePath) // Aboslute path to src files
  if (!fs.existsSync(basePath)) throw new Error(`Base path '${relBasePath}' not found`)

  // Read config file
  const configPath = posix.join(rootPath, '.validator.yml')
  if (!fs.existsSync(configPath)) throw new Error(`Configuration file '${configPath}' not found`)
  const configStr = fs.readFileSync(configPath, 'utf8')
  const config = YAML.parse(configStr) as { prefix: string | string[] | undefined; 'ignore-declaration': string | string[] | undefined }

  // Populate configuration
  const prefixList = (config.prefix ? [config.prefix] : []).flat()
  const ignoreList = (config['ignore-declaration'] ? [config['ignore-declaration']] : []).flat()

  // Validate configuration
  if (prefixList.some((p) => p.length < 3)) throw new Error('Prefix must be at least three characters long')

  return { workingDir, relPath: relBasePath, basePath, patchName, prefixList, ignoreList }
}

export function formatFilters(patchName: string, prefix: string[], ignore: string[]): { prefix: string[]; ignore: string[] } {
  const patchNameU = patchName.toUpperCase()

  // Format and extend prefixes
  const prefixForm = prefix.map((p) => p.replace(/_$/, '').toUpperCase() + '_')
  const prefixPatch = prefixForm.map((p) => 'PATCH_' + p)
  prefix = [...new Set([...prefixForm, ...prefixPatch, patchNameU + '_', 'PATCH_' + patchNameU + '_'])]

  // Format and extend ignore list
  const ignoreForm = ignore.map((i) => i.toUpperCase())
  ignore = [...new Set([...ignoreForm, `NINJA_${patchNameU}_INIT`, `NINJA_${patchNameU}_MENU`])]

  // Report filters
  core.info(`Ignore:   ${ignore.join(', ')}`)
  core.info(`Prefixes: ${prefix.join(', ')}`)

  return { prefix, ignore }
}
