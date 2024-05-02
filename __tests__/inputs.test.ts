import * as core from '@actions/core'
import fs from 'fs'
import YAML from 'yaml'
import { loadInputs, formatFilters } from '../src/inputs.ts'

let getInputMock: jest.SpiedFunction<typeof core.getInput>
let fsExistsSyncMock: jest.SpiedFunction<typeof fs.existsSync>
let fsReadFileSyncMock: jest.SpiedFunction<typeof fs.readFileSync>
let fsRealpathSyncNativeMock: jest.SpiedFunction<typeof fs.realpathSync.native>
let yamlParseMock: jest.SpiedFunction<typeof YAML.parse>

describe('loadInputs', () => {
  beforeEach(() => {
    getInputMock = jest.spyOn(core, 'getInput')
    fsExistsSyncMock = jest.spyOn(fs, 'existsSync')
    fsReadFileSyncMock = jest.spyOn(fs, 'readFileSync')
    fsRealpathSyncNativeMock = jest.spyOn(fs.realpathSync, 'native').mockImplementation((path) => String(path))
    yamlParseMock = jest.spyOn(YAML, 'parse')
  })

  it('should load inputs correctly without ignore lists', () => {
    jest.replaceProperty(process, 'env', { GITHUB_WORKSPACE: '/path/to/workspace' })
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const github = require('@actions/github')
    github.context = {
      payload: {
        repository: {
          name: 'my-repo',
          owner: { login: 'owner' },
        },
      },
    }
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
    expect(fsRealpathSyncNativeMock).toHaveBeenCalledWith('/path/to/workspace/Ninja/patchname')
    expect(fsReadFileSyncMock).toHaveBeenCalledWith('/path/to/workspace/.validator.yml', 'utf8')
    expect(yamlParseMock).toHaveBeenCalledWith('prefix:\n  - prefix-value1\n  - prefix-value2')
  })

  it('should load inputs correctly without prefix', () => {
    jest.replaceProperty(process, 'env', { GITHUB_WORKSPACE: '/path/to/workspace' })
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const github = require('@actions/github')
    github.context = {
      payload: {
        repository: {
          name: 'my-repo',
          owner: { login: 'owner' },
        },
      },
    }
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
    expect(fsRealpathSyncNativeMock).toHaveBeenCalledWith('/path/to/workspace/Ninja/my-repo')
    expect(fsReadFileSyncMock).toHaveBeenCalledWith('/path/to/workspace/.validator.yml', 'utf8')
    expect(yamlParseMock).toHaveBeenCalledWith('ignore-declaration: ignore-value1\nignore-resource: ignore-value2')
  })

  it('should throw an error if repository name is not available', () => {
    jest.replaceProperty(process, 'env', { GITHUB_WORKSPACE: '/path/to/workspace' })
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const github = require('@actions/github')
    github.context = {
      payload: {
        repository: undefined,
      },
    }
    expect(loadInputs).toThrow('Patch name is not available. Please provide it as an input to the action')
  })

  it('should throw an error if base path is not found', () => {
    jest.replaceProperty(process, 'env', { GITHUB_WORKSPACE: undefined })
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const github = require('@actions/github')
    github.context = {
      payload: {
        repository: {
          name: 'my-repo',
          owner: { login: 'owner' },
        },
      },
    }
    getInputMock.mockReturnValue('')
    fsRealpathSyncNativeMock.mockImplementation(() => {
      throw new Error('Base path not found')
    })

    // eslint-disable-next-line quotes
    expect(loadInputs).toThrow("Base path 'Ninja/my-repo' not found")
  })

  it('should throw an error if configuration file is not found', () => {
    jest.replaceProperty(process, 'env', { GITHUB_WORKSPACE: '/path/to/workspace' })
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const github = require('@actions/github')
    github.context = {
      payload: {
        repository: {
          name: 'my-repo',
          owner: { login: 'owner' },
        },
      },
    }
    getInputMock.mockReturnValue('subdir')
    fsExistsSyncMock.mockReturnValueOnce(false)

    // eslint-disable-next-line quotes
    expect(loadInputs).toThrow("Configuration file '/path/to/workspace/subdir/.validator.yml' not found")
  })

  it('should throw an error if prefix is shorter than three characters', () => {
    jest.replaceProperty(process, 'env', { GITHUB_WORKSPACE: undefined })
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const github = require('@actions/github')
    github.context = {
      payload: {
        repository: {
          name: 'my-repo',
          owner: { login: 'owner' },
        },
      },
    }
    getInputMock.mockReturnValue('')
    fsExistsSyncMock.mockReturnValue(true)
    fsReadFileSyncMock.mockReturnValue('prefix:\n  - prefix-value1\n  - ab')
    yamlParseMock.mockReturnValue({ prefix: ['prefix-value1', 'ab'] })

    expect(() => loadInputs()).toThrow('Prefix must be at least three characters long')

    expect(getInputMock).toHaveBeenCalledWith('patchName')
    expect(getInputMock).toHaveBeenCalledWith('rootPath')
    expect(fsRealpathSyncNativeMock).toHaveBeenCalledWith('Ninja/my-repo')
    expect(fsReadFileSyncMock).toHaveBeenCalledWith('.validator.yml', 'utf8')
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
