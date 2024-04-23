import { posix } from 'path'
import * as glob from 'glob'
import { Resource } from '../src/resources.ts'

let posixResolveMock: jest.SpiedFunction<typeof posix.resolve>
let globGlobSyncMock: jest.SpiedFunction<typeof glob.globSync>
let resourceValidateMock: jest.SpiedFunction<typeof Resource.prototype.validate>

describe('Resource', () => {
  beforeEach(() => {
    posixResolveMock = jest.spyOn(posix, 'resolve')
    globGlobSyncMock = jest.spyOn(glob, 'globSync')
  })

  describe('constructor', () => {
    it('should create a new Resource instance', () => {
      const name = 'name'
      const workingDir = '/path/to/workspace'
      const basePath = '/path/to/workspace/Ninja/patchname'
      const extensions = ['.ext1', '.ext2']
      const prefix = ['PATCH_FOO_', 'FOO_']
      const ignoreList = ['_WORK/DATA/TEXTURES/FILE-C.TEX']

      posixResolveMock.mockReturnValue('/path/to/workspace/_work/data')
      const resource = new Resource(name, workingDir, basePath, extensions, prefix, ignoreList)

      expect(resource).toBeInstanceOf(Resource)
      expect(resource.name).toBe(name)
      expect(resource.extViolations).toEqual([])
      expect(resource.nameViolations).toEqual([])
      expect(resource.numFiles).toBe(0)
      expect(resource['workingDir']).toBe(workingDir)
      expect(resource['extensions']).toBe(extensions)
      expect(resource['prefix']).toBe(prefix)
      expect(resource['rscPath']).toBe('/path/to/workspace/_work/data/name/**/*')
    })
  })

  describe('validate', () => {
    it('should collect violations', () => {
      const name = 'textures'
      const workingDir = '/path/to/workspace'
      const basePath = '/path/to/workspace/Ninja/patchname'
      const extensions = ['.tex', '.fnt']
      const prefix = ['PATCH_FOO_', 'FOO_']
      const ignoreList = ['/PATH/TO/WORKSPACE/_WORK/DATA/TEXTURES/_COMPILED/FILEBASE_002-C.TEX']

      posixResolveMock.mockReturnValue('/path/to/workspace/_work/data')
      globGlobSyncMock.mockReturnValue([
        '/path/to/workspace/_work/data/Textures/file.txt',
        '/path/to/workspace/_work/data/Textures/file.md',
        '/path/to/workspace/_work/data/Textures/_compiled/Foo_file-c.tex',
        '/path/to/workspace/_work/data/Textures/_compiled/PATCH_FOO_file.fnt',
        '/path/to/workspace/_work/data/Textures/_compiled/file-c.tex',
        '/path/to/workspace/_work/data/Textures/_compiled/filebase_002-c.tex',
        '/path/to/workspace/_work/data/Textures/_compiled/file.fnt',
        '/path/to/workspace/_work/data/Textures/file.wrg',
        '/path/to/workspace/_work/data/Textures/_compiled/file.mo',
      ])

      const resource = new Resource(name, workingDir, basePath, extensions, prefix, ignoreList)
      resource.validate()

      expect(globGlobSyncMock).toHaveBeenCalled()
      expect(resource['extViolations']).toEqual([
        { file: '_work/data/Textures/file.wrg', name: '.wrg', line: 0 },
        { file: '_work/data/Textures/_compiled/file.mo', name: '.mo', line: 0 },
      ])
      expect(resource['nameViolations']).toEqual([
        { file: '_work/data/Textures/_compiled/file-c.tex', name: 'file-c', line: 0 },
        { file: '_work/data/Textures/_compiled/file.fnt', name: 'file', line: 0 },
      ])
      expect(resource['numFiles']).toBe(9)
    })

    it('should handle empty violations', () => {
      const name = 'textures'
      const workingDir = '/path/to/workspace'
      const basePath = '/path/to/workspace/Ninja/patchname'
      const extensions = ['.fnt', '.tex']
      const prefix = ['PATCH_FOO_', 'FOO_']
      const ignoreList: string[] = []

      posixResolveMock.mockReturnValue('/path/to/workspace/_work/data')
      globGlobSyncMock.mockReturnValue([
        '/path/to/workspace/_work/data/Textures/_compiled/file1.txt',
        '/path/to/workspace/_work/data/Textures/_compiled/file2.md',
      ])

      const resource = new Resource(name, workingDir, basePath, extensions, prefix, ignoreList)
      resource.validate()

      expect(globGlobSyncMock).toHaveBeenCalled()
      expect(resource['extViolations']).toEqual([])
      expect(resource['nameViolations']).toEqual([])
      expect(resource['numFiles']).toBe(2)
    })
  })

  describe('from', () => {
    beforeEach(() => {
      resourceValidateMock = jest.spyOn(Resource.prototype, 'validate')
    })

    it('should create a list of Resource instances', () => {
      const workingDir = '/path/to/workspace'
      const basePath = '/path/to/workspace/Ninja/patchname'
      const prefix = ['PATCH_FOO_', 'FOO_']
      const ignoreList: string[] = []

      posixResolveMock.mockReturnValue('/path/to/workspace/_work/data')
      resourceValidateMock.mockImplementation(function (this: Resource) {
        this.numFiles = 42
      })

      const resources = Resource.from(workingDir, basePath, prefix, ignoreList)
      expect(resources).toHaveLength(6)
      expect(resources[0]).toBeInstanceOf(Resource)
      expect(resources[0].numFiles).toBe(42)
    })

    it('should create and validate all resources', () => {
      const workingDir = '/path/to/workspace'
      const basePath = '/path/to/workspace/Ninja/patchname'
      const prefix = ['PATCH_FOO_', 'FOO_']
      const ignoreList = ['/PATH/TO/WORKSPACE/_WORK/DATA/TEXTURES/_COMPILED/FILEBASE_002-C.TEX']

      posixResolveMock.mockReturnValue('/path/to/workspace/_work/data')
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      globGlobSyncMock.mockImplementation((resourcePath, _opt) => {
        switch (resourcePath) {
          case '/path/to/workspace/_work/data/anims/**/*':
            return [
              '/path/to/workspace/_work/data/Anims/file.txt',
              '/path/to/workspace/_work/data/Anims/file.md',
              '/path/to/workspace/_work/data/Anims/_compiled/file.man',
              '/path/to/workspace/_work/data/Anims/_compiled/file.mdh',
              '/path/to/workspace/_work/data/Anims/_compiled/file.mdl',
              '/path/to/workspace/_work/data/Anims/_compiled/file.mdm',
              '/path/to/workspace/_work/data/Anims/_compiled/file.mmb',
              '/path/to/workspace/_work/data/Anims/file.msb',
              '/path/to/workspace/_work/data/Anims/file.wrg',
              '/path/to/workspace/_work/data/Anims/_compiled/file.mo',
            ]
          case '/path/to/workspace/_work/data/meshes/**/*':
            return [
              '/path/to/workspace/_work/data/Meshes/file.txt',
              '/path/to/workspace/_work/data/Meshes/file.md',
              '/path/to/workspace/_work/data/Meshes/_compiled/foo_file.mrm',
              '/path/to/workspace/_work/data/Meshes/_compiled/file.mrm',
              '/path/to/workspace/_work/data/Meshes/_compiled/patch_foo_file.msh',
              '/path/to/workspace/_work/data/Meshes/_compiled/file.msh',
              '/path/to/workspace/_work/data/Meshes/file.wrg',
              '/path/to/workspace/_work/data/Meshes/_compiled/file.mo',
            ]
          case '/path/to/workspace/_work/data/presets/**/*':
            return [
              '/path/to/workspace/_work/data/Presets/file.txt',
              '/path/to/workspace/_work/data/Presets/file.md',
              '/path/to/workspace/_work/data/Presets/file.zen',
              '/path/to/workspace/_work/data/Presets/file.wrg',
            ]
          case '/path/to/workspace/_work/data/sound/**/*':
            return [
              '/path/to/workspace/_work/data/Sound/file.txt',
              '/path/to/workspace/_work/data/Sound/file.md',
              '/path/to/workspace/_work/data/Sound/SFX/file.wav',
              '/path/to/workspace/_work/data/Sound/SFX/file.mp3',
              '/path/to/workspace/_work/data/Sound/Speech/file.ogg',
              '/path/to/workspace/_work/data/Sound/file.wrg',
              '/path/to/workspace/_work/data/Sound/SFX/file.mo',
            ]
          case '/path/to/workspace/_work/data/textures/**/*':
            return [
              '/path/to/workspace/_work/data/Textures/file.txt',
              '/path/to/workspace/_work/data/Textures/file.md',
              '/path/to/workspace/_work/data/Textures/_compiled/file-c.tex',
              '/path/to/workspace/_work/data/Textures/_compiled/file.fnt',
              '/path/to/workspace/_work/data/Textures/_compiled/filebase_002-c.tex', // Igored
              '/path/to/workspace/_work/data/Textures/file.wrg',
              '/path/to/workspace/_work/data/Textures/_compiled/file.mo',
            ]
          case '/path/to/workspace/_work/data/worlds/**/*':
            return [
              '/path/to/workspace/_work/data/Worlds/file.txt',
              '/path/to/workspace/_work/data/Worlds/file.md',
              '/path/to/workspace/_work/data/Worlds/file.zen',
              '/path/to/workspace/_work/data/Worlds/file.wrg',
            ]
          default:
            return []
        }
      })

      const resources = Resource.from(workingDir, basePath, prefix, ignoreList)
      expect(Resource.prototype.validate).toHaveBeenCalledTimes(6)
      expect(globGlobSyncMock).toHaveBeenCalledTimes(6)
      expect(resources).toHaveLength(6)

      expect(resources[0].numFiles).toBe(10)
      expect(resources[1].numFiles).toBe(8)
      expect(resources[2].numFiles).toBe(4)
      expect(resources[3].numFiles).toBe(7)
      expect(resources[4].numFiles).toBe(7)
      expect(resources[5].numFiles).toBe(4)

      expect(resources[0].extViolations).toEqual([
        { file: '_work/data/Anims/file.wrg', name: '.wrg', line: 0 },
        { file: '_work/data/Anims/_compiled/file.mo', name: '.mo', line: 0 },
      ])
      expect(resources[1].extViolations).toEqual([
        { file: '_work/data/Meshes/file.wrg', name: '.wrg', line: 0 },
        { file: '_work/data/Meshes/_compiled/file.mo', name: '.mo', line: 0 },
      ])
      expect(resources[2].extViolations).toEqual([{ file: '_work/data/Presets/file.wrg', name: '.wrg', line: 0 }])
      expect(resources[3].extViolations).toEqual([
        { file: '_work/data/Sound/file.wrg', name: '.wrg', line: 0 },
        { file: '_work/data/Sound/SFX/file.mo', name: '.mo', line: 0 },
      ])
      expect(resources[4].extViolations).toEqual([
        { file: '_work/data/Textures/file.wrg', name: '.wrg', line: 0 },
        { file: '_work/data/Textures/_compiled/file.mo', name: '.mo', line: 0 },
      ])
      expect(resources[5].extViolations).toEqual([{ file: '_work/data/Worlds/file.wrg', name: '.wrg', line: 0 }])

      expect(resources[0].nameViolations).toEqual([])
      expect(resources[1].nameViolations).toEqual([
        { file: '_work/data/Meshes/_compiled/file.mrm', name: 'file', line: 0 },
        { file: '_work/data/Meshes/_compiled/file.msh', name: 'file', line: 0 },
      ])
      expect(resources[2].nameViolations).toEqual([{ file: '_work/data/Presets/file.zen', name: 'file', line: 0 }])
      expect(resources[3].nameViolations).toEqual([
        { file: '_work/data/Sound/SFX/file.wav', name: 'file', line: 0 },
        { file: '_work/data/Sound/SFX/file.mp3', name: 'file', line: 0 },
        { file: '_work/data/Sound/Speech/file.ogg', name: 'file', line: 0 },
      ])
      expect(resources[4].nameViolations).toEqual([
        { file: '_work/data/Textures/_compiled/file-c.tex', name: 'file-c', line: 0 },
        { file: '_work/data/Textures/_compiled/file.fnt', name: 'file', line: 0 },
      ])
      expect(resources[5].nameViolations).toEqual([{ file: '_work/data/Worlds/file.zen', name: 'file', line: 0 }])
    })
  })
})
