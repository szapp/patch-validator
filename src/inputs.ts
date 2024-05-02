import * as core from '@actions/core'
import * as github from '@actions/github'
import { posix } from 'path'
import { normalizePath } from './utils.js'
import fs from 'fs'
import YAML from 'yaml'

type Inputs = {
  workingDir: string
  basePath: string
  patchName: string
  prefixList: string[]
  ignoreListDecl: string[]
  ignoreListRsc: string[]
}

export function loadInputs(): Inputs {
  const workingDir = core.toPosixPath(process.env['GITHUB_WORKSPACE'] ?? '')
  const patchName = core.getInput('patchName') || github.context.payload.repository?.name
  if (!patchName) throw new Error('Patch name is not available. Please provide it as an input to the action')

  // Make paths
  const relRootPath = posix.normalize(core.toPosixPath(core.getInput('rootPath'))) // Relative path to patch root
  const relBasePath = posix.join(relRootPath, 'Ninja', patchName) // Relative path to src files
  const rootPath = posix.join(workingDir, relRootPath) // Absolute path to patch root
  let basePath = posix.join(workingDir, relBasePath) // Aboslute path to src files
  try {
    basePath = fs.realpathSync.native(basePath) // Check if path exists (and correct case)
  } catch {
    throw new Error(`Base path '${relBasePath}' not found`)
  }

  // Read config file
  const configPath = posix.join(rootPath, '.validator.yml')
  if (!fs.existsSync(configPath)) throw new Error(`Configuration file '${configPath}' not found`)
  const configStr = fs.readFileSync(configPath, 'utf8')
  const config = YAML.parse(configStr) as {
    prefix: string | string[] | undefined
    'ignore-declaration': string | string[] | undefined
    'ignore-resource': string | string[] | undefined
  }

  // Populate configuration
  const prefixList = (config.prefix ? [config.prefix] : []).flat()
  const ignoreListDecl = (config['ignore-declaration'] ? [config['ignore-declaration']] : []).flat()
  const ignoreListRsc = (config['ignore-resource'] ? [config['ignore-resource']] : []).flat()

  // Validate configuration
  if (prefixList.some((p) => p.length < 3)) throw new Error('Prefix must be at least three characters long')

  return { workingDir, basePath, patchName, prefixList, ignoreListDecl, ignoreListRsc }
}

export function formatFilters(
  patchName: string,
  prefix: string[],
  ignoreDecl: string[],
  ignoreRsc: string[],
  basePath: string
): { prefix: string[]; ignoreDecl: string[]; ignoreRsc: string[] } {
  const patchNameU = patchName.toUpperCase()

  // Format and extend prefixes
  const prefixForm = prefix.map((p) => p.toUpperCase())
  const prefixPatch = prefixForm.map((p) => 'PATCH_' + p)
  prefix = [...new Set([...prefixPatch, 'PATCH_' + patchNameU, ...prefixForm, patchNameU])]

  // Format and extend ignore lists
  const ignoreDForm = ignoreDecl.map((i) => i.toUpperCase())
  ignoreDecl = [...new Set([...ignoreDForm, `NINJA_${patchNameU}_INIT`, `NINJA_${patchNameU}_MENU`])]
  const rscRootPath = posix.resolve(basePath, '..', '..')
  ignoreRsc = ignoreRsc.map((i) => posix.join(rscRootPath, normalizePath(i)).toUpperCase())

  // Report filters
  core.info(`Prefixes:              ${prefix.join(', ')}`)
  core.info(`Ignore declarations:   ${ignoreDecl.join(', ')}`)
  core.info(`Ignore resource files: ${ignoreRsc.join(', ')}`)

  return { prefix, ignoreDecl, ignoreRsc }
}
