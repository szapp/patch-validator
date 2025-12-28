import * as core from '@actions/core'
import * as github from '@actions/github'
import fs from 'fs'
import { trueCasePathSync } from 'true-case-path'
import path from 'path'
import YAML from 'yaml'
import { loadInputs, formatFilters } from '../src/inputs.ts'
import { normalizePath } from '../src/utils.ts'

jest.mock('@actions/github')
jest.mock('true-case-path')

let getInputMock: jest.SpiedFunction<typeof core.getInput>
let fsExistsSyncMock: jest.SpiedFunction<typeof fs.existsSync>
let fsReadFileSyncMock: jest.SpiedFunction<typeof fs.readFileSync>
let yamlParseMock: jest.SpiedFunction<typeof YAML.parse>

describe('loadInputs', () => {
  const githubContextMock = github.context as jest.MockedObjectDeep<typeof github.context>
  const trueCasePathSyncMock = trueCasePathSync as jest.MockedFunction<typeof trueCasePathSync>

  beforeEach(() => {
    getInputMock = jest.spyOn(core, 'getInput')
    fsExistsSyncMock = jest.spyOn(fs, 'existsSync')
    fsReadFileSyncMock = jest.spyOn(fs, 'readFileSync')
    yamlParseMock = jest.spyOn(YAML, 'parse')

    jest.replaceProperty(process, 'env', { GITHUB_WORKSPACE: '/path/to/workspace' })
    githubContextMock.payload.repository = { name: 'my-repo', owner: { login: 'owner' } }
    trueCasePathSyncMock.mockImplementation((path: string) => path)
  })

  it('should load inputs correctly without ignore lists', () => {
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

  it('should load inputs correctly without prefix', () => {
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

  it('should throw an error if repository name is not available', () => {
    github.context.payload.repository = undefined
    expect(loadInputs).toThrow('Patch name is not available. Please provide it as an input to the action')
  })

  it('should throw an error if base path is not found', () => {
    jest.replaceProperty(process, 'env', { GITHUB_WORKSPACE: undefined })
    getInputMock.mockReturnValue('')
    trueCasePathSyncMock.mockImplementation(() => {
      throw new Error('Base path not found')
    })

    // eslint-disable-next-line quotes
    expect(loadInputs).toThrow("Base path 'Ninja/my-repo' not found")
  })

  it('should throw an error if configuration file is not found', () => {
    getInputMock.mockReturnValue('subdir')
    fsExistsSyncMock.mockReturnValueOnce(false)

    // eslint-disable-next-line quotes
    expect(loadInputs).toThrow("Configuration file '/path/to/workspace/subdir/.validator.yml' not found")
  })

  it('should throw an error if prefix is shorter than three characters', () => {
    jest.replaceProperty(process, 'env', { GITHUB_WORKSPACE: undefined })
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
    jest.spyOn(core, 'info').mockImplementation()
  })

  it('formats and extends filters', () => {
    const patchName = 'Patch1'
    const prefix = ['pre1', 'PRE2']
    const ignoreDecl = ['Symbol1', 'Symbol2']
    const ignoreRsc = ['\\path\\to\\somefile', '/another/path/to/anotherfile']
    const basePath = '/path/to/workspace/Ninja/Patch1'

    const result = formatFilters(patchName, prefix, ignoreDecl, ignoreRsc, basePath)

    expect(core.info).toHaveBeenCalledWith('Prefixes:              PATCH_PRE1, PATCH_PRE2, PATCH_PATCH1, PRE1, PRE2, PATCH1')
    expect(core.info).toHaveBeenCalledWith('Ignore declarations:   SYMBOL1, SYMBOL2, NINJA_PATCH1_INIT, NINJA_PATCH1_MENU')
    expect(core.info).toHaveBeenCalledWith(
      'Ignore resource files: /PATH/TO/WORKSPACE/PATH/TO/SOMEFILE, /PATH/TO/WORKSPACE/ANOTHER/PATH/TO/ANOTHERFILE'
    )
    expect(result.prefix).toEqual(['PATCH_PRE1', 'PATCH_PRE2', 'PATCH_PATCH1', 'PRE1', 'PRE2', 'PATCH1'])
    expect(result.ignoreDecl).toEqual(['SYMBOL1', 'SYMBOL2', 'NINJA_PATCH1_INIT', 'NINJA_PATCH1_MENU'])
    expect(result.ignoreRsc).toEqual(['/PATH/TO/WORKSPACE/PATH/TO/SOMEFILE', '/PATH/TO/WORKSPACE/ANOTHER/PATH/TO/ANOTHERFILE'])
  })
})
