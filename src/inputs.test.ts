import fs from 'node:fs'
import path from 'node:path'
import * as core from '@actions/core'
import trueCase from 'true-case-path'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import YAML from 'yaml'
import { normalizePath } from './utils.js'

const { githubContextMock } = vi.hoisted(() => ({
  githubContextMock: {
    payload: {
      repository: {
        name: 'my-repo',
        owner: {
          login: 'owner',
        },
      },
    },
  },
}))
vi.mock(import('@actions/github'), async (importOriginal) => {
  const originalModule = await importOriginal()
  return {
    ...originalModule,
    context: githubContextMock as typeof originalModule.context,
  }
})
const { getInputMock } = vi.hoisted(() => ({
  getInputMock: vi.fn(),
}))
vi.mock(import('@actions/core'), async (importOriginal) => {
  const originalModule = await importOriginal()
  return {
    ...originalModule,
    getInput: getInputMock,
  }
})
const fsExistsSyncMock = vi.spyOn(fs, 'existsSync')
const fsReadFileSyncMock = vi.spyOn(fs, 'readFileSync')
const yamlParseMock = vi.spyOn(YAML, 'parse')
const trueCasePathSyncMock = vi.spyOn(trueCase, 'trueCasePathSync')

import { formatFilters, loadInputs } from './inputs.js'

describe('loadInputs', () => {
  beforeEach(() => {
    vi.resetAllMocks()

    vi.stubEnv('GITHUB_WORKSPACE', '/path/to/workspace')
    githubContextMock.payload.repository = { name: 'my-repo', owner: { login: 'owner' } }
    trueCasePathSyncMock.mockImplementation((path: string) => path)
  })

  test('should load inputs correctly without ignore lists', () => {
    getInputMock.mockReturnValueOnce('patchname')
    getInputMock.mockReturnValue('')
    fsExistsSyncMock.mockReturnValue(true)
    fsReadFileSyncMock.mockReturnValue('prefix:\n  - prefix-value1\n  - prefix-value2')
    yamlParseMock.mockReturnValue({ prefix: ['prefix-value1', 'prefix-value2'] })

    const result = loadInputs()

    expect(result).toEqual({
      workingDir: '/path/to/workspace',
      basePath: '/path/to/workspace/Ninja/patchname',
      patchName: 'patchname',
      prefixList: ['prefix-value1', 'prefix-value2'],
      ignoreListDecl: [],
      ignoreListRsc: [],
    })
    expect(getInputMock).toHaveBeenCalledWith('patchName')
    expect(getInputMock).toHaveBeenCalledWith('rootPath')
    expect(trueCasePathSyncMock).toHaveBeenCalledWith('/path/to/workspace/Ninja/patchname')
    expect(fsReadFileSyncMock).toHaveBeenCalledWith('/path/to/workspace/.validator.yml', 'utf8')
    expect(yamlParseMock).toHaveBeenCalledWith('prefix:\n  - prefix-value1\n  - prefix-value2')
  })

  test('should load inputs correctly without prefix', () => {
    getInputMock.mockReturnValue('')
    fsExistsSyncMock.mockReturnValue(true)
    fsReadFileSyncMock.mockReturnValue('ignore-declaration: ignore-value1\nignore-resource: ignore-value2')
    yamlParseMock.mockReturnValue({ 'ignore-declaration': 'ignore-value1', 'ignore-resource': 'ignore-value2' })

    const result = loadInputs()

    expect(result).toEqual({
      workingDir: '/path/to/workspace',
      basePath: '/path/to/workspace/Ninja/my-repo',
      patchName: 'my-repo',
      prefixList: [],
      ignoreListDecl: ['ignore-value1'],
      ignoreListRsc: ['ignore-value2'],
    })
    expect(getInputMock).toHaveBeenCalledWith('patchName')
    expect(getInputMock).toHaveBeenCalledWith('rootPath')
    expect(trueCasePathSyncMock).toHaveBeenCalledWith('/path/to/workspace/Ninja/my-repo')
    expect(fsReadFileSyncMock).toHaveBeenCalledWith('/path/to/workspace/.validator.yml', 'utf8')
    expect(yamlParseMock).toHaveBeenCalledWith('ignore-declaration: ignore-value1\nignore-resource: ignore-value2')
  })

  test('should throw an error if repository name is not available', () => {
    githubContextMock.payload.repository = undefined as unknown as typeof githubContextMock.payload.repository
    expect(loadInputs).toThrow('Patch name is not available. Please provide it as an input to the action')
  })

  test('should throw an error if base path is not found', () => {
    vi.stubEnv('GITHUB_WORKSPACE', undefined)
    getInputMock.mockReturnValue('')
    trueCasePathSyncMock.mockImplementation(() => {
      throw new Error('Base path not found')
    })

    // eslint-disable-next-line quotes
    expect(loadInputs).toThrow("Base path 'Ninja/my-repo' not found")
  })

  test('should throw an error if configuration file is not found', () => {
    getInputMock.mockReturnValue('subdir')
    fsExistsSyncMock.mockReturnValueOnce(false)

    // eslint-disable-next-line quotes
    expect(loadInputs).toThrow("Configuration file '/path/to/workspace/subdir/.validator.yml' not found")
  })

  test('should throw an error if prefix is shorter than three characters', () => {
    vi.stubEnv('GITHUB_WORKSPACE', undefined)
    getInputMock.mockReturnValue('')
    fsExistsSyncMock.mockReturnValue(true)
    fsReadFileSyncMock.mockReturnValue('prefix:\n  - prefix-value1\n  - ab')
    yamlParseMock.mockReturnValue({ prefix: ['prefix-value1', 'ab'] })

    expect(() => loadInputs()).toThrow('Prefix must be at least three characters long')

    expect(getInputMock).toHaveBeenCalledWith('patchName')
    expect(getInputMock).toHaveBeenCalledWith('rootPath')
    expect(trueCasePathSyncMock).toHaveBeenCalledWith(normalizePath(path.resolve('./Ninja/my-repo')))
    expect(fsReadFileSyncMock).toHaveBeenCalledWith(normalizePath(path.resolve('./.validator.yml')), 'utf8')
    expect(yamlParseMock).toHaveBeenCalledWith('prefix:\n  - prefix-value1\n  - ab')
  })
})

describe('formatFilters', () => {
  beforeEach(() => {
    vi.spyOn(core, 'info').mockImplementation(() => {})
  })

  test('formats and extends filters', () => {
    const patchName = 'Patch1'
    const prefix = ['pre1', 'PRE2']
    const ignoreDecl = ['Symbol1', 'Symbol2']
    const ignoreRsc = ['\\path\\to\\somefile', '/another/path/to/anotherfile']
    const basePath = '/path/to/workspace/Ninja/Patch1'

    const result = formatFilters(patchName, prefix, ignoreDecl, ignoreRsc, basePath)

    expect(core.info).toHaveBeenCalledWith('Prefixes:              PATCH_PRE1, PATCH_PRE2, PATCH_PATCH1, PRE1, PRE2, PATCH1')
    expect(core.info).toHaveBeenCalledWith('Ignore declarations:   SYMBOL1, SYMBOL2, NINJA_PATCH1_INIT, NINJA_PATCH1_MENU')
    expect(core.info).toHaveBeenCalledWith(
      'Ignore resource files: /PATH/TO/WORKSPACE/PATH/TO/SOMEFILE, /PATH/TO/WORKSPACE/ANOTHER/PATH/TO/ANOTHERFILE',
    )
    expect(result.prefix).toEqual(['PATCH_PRE1', 'PATCH_PRE2', 'PATCH_PATCH1', 'PRE1', 'PRE2', 'PATCH1'])
    expect(result.ignoreDecl).toEqual(['SYMBOL1', 'SYMBOL2', 'NINJA_PATCH1_INIT', 'NINJA_PATCH1_MENU'])
    expect(result.ignoreRsc).toEqual(['/PATH/TO/WORKSPACE/PATH/TO/SOMEFILE', '/PATH/TO/WORKSPACE/ANOTHER/PATH/TO/ANOTHERFILE'])
  })
})
