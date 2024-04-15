import * as core from '@actions/core'
import fs from 'fs'
import YAML from 'yaml'
import { loadInputs } from '../src/inputs.ts'

let getInputMock: jest.SpiedFunction<typeof core.getInput>
let fsExistsSyncMock: jest.SpiedFunction<typeof fs.existsSync>
let fsReadFileSyncMock: jest.SpiedFunction<typeof fs.readFileSync>
let yamlParseMock: jest.SpiedFunction<typeof YAML.parse>

describe('loadInputs', () => {
  beforeEach(() => {
    getInputMock = jest.spyOn(core, 'getInput')
    fsExistsSyncMock = jest.spyOn(fs, 'existsSync')
    fsReadFileSyncMock = jest.spyOn(fs, 'readFileSync')
    yamlParseMock = jest.spyOn(YAML, 'parse')
  })

  it('should load inputs correctly without ignore', () => {
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
    fsExistsSyncMock.mockReturnValue(true)
    fsReadFileSyncMock.mockReturnValue('prefix:\n  - prefix-value1\n  - prefix-value2')
    yamlParseMock.mockReturnValue({ prefix: ['prefix-value1', 'prefix-value2'] })

    const result = loadInputs()

    expect(result).toEqual({
      relPath: 'Ninja/patchname',
      basePath: '/path/to/workspace/Ninja/patchname',
      patchName: 'patchname',
      prefix: ['prefix-value1', 'prefix-value2'],
      ignore: [],
    })
    expect(getInputMock).toHaveBeenCalledWith('patchName')
    expect(getInputMock).toHaveBeenCalledWith('rootPath')
    expect(fsExistsSyncMock).toHaveBeenCalledWith('/path/to/workspace/Ninja/patchname')
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
    fsExistsSyncMock.mockReturnValue(true)
    fsReadFileSyncMock.mockReturnValue('ignore: ignore-value')
    yamlParseMock.mockReturnValue({ 'ignore-declaration': 'ignore-value' })

    const result = loadInputs()

    expect(result).toEqual({
      relPath: 'Ninja/my-repo',
      basePath: '/path/to/workspace/Ninja/my-repo',
      patchName: 'my-repo',
      prefix: [],
      ignore: ['ignore-value'],
    })
    expect(getInputMock).toHaveBeenCalledWith('patchName')
    expect(getInputMock).toHaveBeenCalledWith('rootPath')
    expect(fsExistsSyncMock).toHaveBeenCalledWith('/path/to/workspace/Ninja/my-repo')
    expect(fsReadFileSyncMock).toHaveBeenCalledWith('/path/to/workspace/.validator.yml', 'utf8')
    expect(yamlParseMock).toHaveBeenCalledWith('ignore: ignore-value')
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
    fsExistsSyncMock.mockReturnValue(false)

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
    fsExistsSyncMock.mockReturnValueOnce(true).mockReturnValueOnce(false)

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
    expect(fsExistsSyncMock).toHaveBeenCalledWith('Ninja/my-repo')
    expect(fsReadFileSyncMock).toHaveBeenCalledWith('.validator.yml', 'utf8')
    expect(yamlParseMock).toHaveBeenCalledWith('prefix:\n  - prefix-value1\n  - ab')
  })
})
