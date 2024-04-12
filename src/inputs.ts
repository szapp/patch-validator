import * as core from '@actions/core'
import * as github from '@actions/github'
import { posix } from 'path'
import fs from 'fs'
import YAML from 'yaml'

export function loadInputs(): { relPath: string; basePath: string; patchName: string; prefix: string[]; ignore: string[] } {
  const wd = core.toPosixPath(process.env['GITHUB_WORKSPACE'] ?? '')
  const patchName = core.getInput('patchName') || github.context.payload.repository?.name
  if (!patchName) throw new Error('Patch name is not available. Please provide it as an input to the action')

  // Make paths
  const relRootPath = posix.normalize(core.toPosixPath(core.getInput('rootPath'))) // Relative path to patch root
  const relBasePath = posix.join(relRootPath, 'Ninja', patchName) // Relative path to src files
  const rootPath = posix.join(wd, relRootPath) // Absolute path to patch root
  const basePath = posix.join(wd, relBasePath) // Aboslute path to src files
  if (!fs.existsSync(basePath)) throw new Error(`Base path '${relBasePath}' not found`)

  // Read config file
  const configPath = posix.join(rootPath, '.validator.yml')
  if (!fs.existsSync(configPath)) throw new Error(`Configuration file '${configPath}' not found`)
  const configStr = fs.readFileSync(configPath, 'utf8')
  const config = YAML.parse(configStr) as { prefix: string | string[] | undefined; 'ignore-declaration': string | string[] | undefined }

  // Populate configuration
  const prefix = (config.prefix ? [config.prefix] : []).flat()
  const ignore = (config['ignore-declaration'] ? [config['ignore-declaration']] : []).flat()

  // Validate configuration
  if (prefix.some((p) => p.length < 3)) throw new Error('Prefix must be at least three characters long')

  return { relPath: relBasePath, basePath, patchName, prefix, ignore }
}
