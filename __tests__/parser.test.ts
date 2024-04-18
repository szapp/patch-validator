/* eslint-disable @typescript-eslint/no-explicit-any */

// Avoid some console outputs during tests
jest.mock('@actions/core', () => {
  const core = jest.requireActual('@actions/core')
  return {
    ...core,
    debug: jest.fn(),
    error: jest.fn(),
  }
})

import { Parser } from '../src/parser.js'
import fs from 'fs'
import * as io from '@actions/io'
import * as tc from '@actions/tool-cache'
import * as glob from '@actions/glob'
import { posix } from 'path'

let fsExistsSyncMock: jest.SpiedFunction<typeof fs.existsSync>
let fsReadFileSyncMock: jest.SpiedFunction<typeof fs.readFileSync>
let ioMkdirPMock: jest.SpiedFunction<typeof io.mkdirP>
let ioRmRFMock: jest.SpiedFunction<typeof io.rmRF>
let tcDownloadToolMock: jest.SpiedFunction<typeof tc.downloadTool>
let tcExtractTarMock: jest.SpiedFunction<typeof tc.extractTar>

describe('Parser', () => {
  beforeEach(() => {
    fsExistsSyncMock = jest.spyOn(fs, 'existsSync')
    fsReadFileSyncMock = jest.spyOn(fs, 'readFileSync')
  })

  describe('constructor', () => {
    it('should initialize the Parser object with version and working directory', () => {
      const patchName = 'test'
      const filepath = '/path/to/conTENT_g1.src'
      const workingDir = '/path/to/workingDir'
      fsExistsSyncMock.mockReturnValue(false)

      const parser = new Parser(patchName, filepath, workingDir)

      expect(parser.filepath).toBe(filepath)
      expect(parser.workingDir).toBe(workingDir)
      expect(parser.exists).toBe(false)
      expect(parser.filename).toBe('conTENT_g1.src')
      expect(parser.type).toBe('CONTENT')
      expect(parser.version).toBe(1)
      expect(parser.symbolTable).toEqual([])
      expect(parser.referenceTable).toEqual([])
      expect(parser.namingViolations).toEqual([])
      expect(parser.referenceViolations).toEqual([])
      expect(parser.filelist).toEqual([])
    })

    it('should initialize the Parser object without version and working directory', () => {
      const patchName = 'test'
      const filepath = '/path/to/file.src'
      const workingDir = ''
      fsExistsSyncMock.mockReturnValue(false)

      const parser = new Parser(patchName, filepath)

      expect(parser.filepath).toBe(filepath)
      expect(parser.workingDir).toBe(workingDir)
      expect(parser.exists).toBe(false)
      expect(parser.filename).toBe('file.src')
      expect(parser.type).toBe('FILE')
      expect(parser.version).toBe(-1)
      expect(parser.symbolTable).toEqual([])
      expect(parser.referenceTable).toEqual([])
      expect(parser.namingViolations).toEqual([])
      expect(parser.referenceViolations).toEqual([])
      expect(parser.filelist).toEqual([])
    })
  })

  describe('from', () => {
    it('parses all candidate SRC files', () => {
      const patchName = 'test'
      const basePath = '/path/to/base'
      const workingDir = ''
      const candidates = [
        '/path/to/base/Content_G1.src',
        '/path/to/base/Content_G112.src',
        '/path/to/base/Content_G130.src',
        '/path/to/base/Content_G2.src',
        '/path/to/base/Menu_G1.src',
        '/path/to/base/Menu_G112.src',
        '/path/to/base/Menu_G130.src',
        '/path/to/base/Menu_G2.src',
        '/path/to/base/Menu.src',
        '/path/to/base/PFX_G1.src',
        '/path/to/base/PFX_G112.src',
        '/path/to/base/PFX_G130.src',
        '/path/to/base/PFX_G2.src',
        '/path/to/base/PFX.src',
        '/path/to/base/SFX_G1.src',
        '/path/to/base/SFX_G112.src',
        '/path/to/base/SFX_G130.src',
        '/path/to/base/SFX_G2.src',
        '/path/to/base/SFX.src',
        '/path/to/base/VFX_G1.src',
        '/path/to/base/VFX_G112.src',
        '/path/to/base/VFX_G130.src',
        '/path/to/base/VFX_G2.src',
        '/path/to/base/VFX.src',
        '/path/to/base/Music_G1.src',
        '/path/to/base/Music_G112.src',
        '/path/to/base/Music_G130.src',
        '/path/to/base/Music_G2.src',
        '/path/to/base/Music.src',
        '/path/to/base/Camera_G1.src',
        '/path/to/base/Camera_G112.src',
        '/path/to/base/Camera_G130.src',
        '/path/to/base/Camera_G2.src',
        '/path/to/base/Camera.src',
        '/path/to/base/Fight_G1.src',
        '/path/to/base/Fight_G112.src',
        '/path/to/base/Fight_G130.src',
        '/path/to/base/Fight_G2.src',
        '/path/to/base/Fight.src',
      ]
      const oneParser = {
        exists: true,
        filelist: [],
        filename: 'Content_G1.src',
        filepath: '/path/to/base/Content_G1.src',
        namingViolations: [],
        referenceTable: [],
        referenceViolations: [],
        symbolTable: expect.arrayContaining([{ name: 'PRINT', file: '', line: 0 }]),
        type: 'CONTENT',
        version: 1,
        workingDir: '',
        packageDir: '',
      } as unknown as Parser

      fsExistsSyncMock.mockReturnValue(false).mockReturnValueOnce(true)
      fsReadFileSyncMock.mockReturnValue('').mockReturnValueOnce('test.d\n')

      const result = Parser.from(patchName, basePath, workingDir)
      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject(oneParser)
      expect(fsExistsSyncMock).toHaveBeenCalledTimes(candidates.length + 1)
      candidates.forEach((candidate) => {
        expect(fsExistsSyncMock).toHaveBeenCalledWith(candidate)
      })
      expect(fsReadFileSyncMock).not.toHaveBeenCalled()
    })
  })

  describe('stripPath', () => {
    it('should strip the path from the file path', () => {
      const patchName = 'test'
      const filepath = '/path/to/file.src'
      const workingDir = '/path'
      const parser = new Parser(patchName, filepath, workingDir)

      const result = parser['stripPath'](filepath)

      expect(result).toEqual({ fullPath: filepath, relPath: 'to/file.src' })
    })
  })

  describe('parse', () => {
    it('should parse the file and fill the symbol table', async () => {
      const patchName = 'test'
      const filepath = '/path/to/file.src'

      const parser = new Parser(patchName, filepath)

      const parseExternals = jest.spyOn(parser as any, 'parseExternals').mockImplementation()
      const parseRequired = jest.spyOn(parser as any, 'parseRequired').mockImplementation()
      const parseSrc = jest.spyOn(parser as any, 'parseSrc').mockImplementation()

      await parser.parse()

      expect(parseExternals).toHaveBeenCalled()
      expect(parseRequired).toHaveBeenCalled()
      expect(parseSrc).toHaveBeenCalledWith(filepath, true)
    })
  })

  describe('parseSrc', () => {
    it('should parse the source file and call parseD or parseSrc recursively', async () => {
      const patchName = 'test'
      const filepath = '/path/to/file.src'
      const parser = new Parser(patchName, filepath)

      const stripPath = jest.spyOn(parser as any, 'stripPath').mockReturnValue({ fullPath: '/path/to/file.src', relPath: 'file.src' })
      const parseD = jest.spyOn(parser as any, 'parseD').mockImplementation()
      const parseSrc = jest.spyOn(parser as any, 'parseSrc')

      fsExistsSyncMock.mockReturnValue(false).mockReturnValueOnce(true)
      fsReadFileSyncMock.mockReturnValue('sub\\file.d\nrecurse.src\n')

      await parser['parseSrc'](filepath)

      expect(stripPath).toHaveBeenCalledWith(filepath)
      expect(parseD).toHaveBeenCalledWith('/path/to/sub/file.d', false)
      expect(parseSrc).toHaveBeenCalledWith('/path/to/recurse.src', false, false)
    })

    it('should not parse the source file if it has an invalid extension', async () => {
      const patchName = 'test'
      const filepath = '/path/to/file.src'
      const parser = new Parser(patchName, filepath)

      const parseD = jest.spyOn(parser as any, 'parseD')
      const parseSrc = jest.spyOn(parser as any, 'parseSrc')

      fsExistsSyncMock.mockReturnValue(true)
      fsReadFileSyncMock.mockReturnValue('sub\\file.txt\n')

      await parser['parseSrc'](filepath, true)

      expect(parseD).not.toHaveBeenCalled()
      expect(parseSrc).toHaveBeenCalledTimes(1)
    })

    it('should not parse the source file if it does not exist', async () => {
      const patchName = 'test'
      const filepath = '/path/to/file.src'
      const parser = new Parser(patchName, filepath)

      fsExistsSyncMock.mockReturnValue(false)

      await parser['parseSrc'](filepath, true)

      expect(fsReadFileSyncMock).not.toHaveBeenCalled()
      expect(parser.filelist).toEqual([])
      expect(parser.symbolTable).toEqual([])
      expect(parser.referenceTable).toEqual([])
    })

    it('should parse the special line', async () => {
      const patchName = 'test'
      const filepath = '/path/to/file.src'
      const parser = new Parser(patchName, filepath)

      jest.spyOn(parser as any, 'stripPath').mockReturnValue({ fullPath: '/path/to/file.src', relPath: 'file.src' })
      const parseSpecial = jest.spyOn(parser as any, 'parseSpecial').mockImplementation()

      fsExistsSyncMock.mockReturnValue(true)
      fsReadFileSyncMock.mockReturnValue('non-path\n')

      await parser['parseSrc'](filepath, true)

      expect(parseSpecial).toHaveBeenCalledWith('non-path')
    })

    it('should throw an error if source file contains wildcards', async () => {
      const patchName = 'test'
      const filepath = '/path/to/file.src'
      const parser = new Parser(patchName, filepath)

      fsExistsSyncMock.mockReturnValue(true)
      fsReadFileSyncMock.mockReturnValue('some/path/*\n')

      await expect(parser['parseSrc'](filepath, true)).rejects.toThrow('Wildcards are not supported')

      expect(fsReadFileSyncMock).toHaveBeenCalledWith(filepath, 'ascii')
      expect(fsReadFileSyncMock).toHaveReturnedWith('some/path/*\n')
    })

    it('should resolve wildcards when for excluded sources', async () => {
      const patchName = 'test'
      const filepath = 'path/to/file.src'
      const parser = new Parser(patchName, filepath)

      fsExistsSyncMock.mockReturnValue(true)
      fsReadFileSyncMock.mockReturnValue('some/path/*\n')
      jest.spyOn(posix, 'join')
      jest.spyOn(glob, 'create').mockResolvedValue({ glob: async () => ['some/path/glob.ext'] } as glob.Globber)

      await parser['parseSrc'](filepath, false, true)

      expect(posix.join).toHaveBeenCalledWith('path/to', 'some/path/*')
      expect(fsExistsSyncMock).toHaveBeenCalledWith(filepath)
      expect(fsReadFileSyncMock).toHaveBeenCalledWith(filepath, 'ascii')
      expect(glob.create).toHaveBeenCalledWith('path/to/some/path/*')
      expect(posix.join).toHaveBeenCalledWith('path/to', 'some/path/glob.ext')
      expect(parser.filelist).toEqual([])
      expect(parser.symbolTable).toEqual([])
      expect(parser.referenceTable).toEqual([])
    })
  })

  describe('parseD', () => {
    it('should parse the specified file and collect symbol tables', () => {
      const patchName = 'test'
      const filepath = '/path/to/file.d'
      const workingDir = '/path/'
      const relPath = 'to/file.d'
      const parser = new Parser(patchName, filepath, workingDir)

      const stripPath = jest.spyOn(parser as any, 'stripPath')
      fsExistsSyncMock.mockReturnValue(true)
      fsReadFileSyncMock.mockReturnValueOnce('const int Symbol1 = 0;')

      parser['parseD'](filepath, true)

      expect(stripPath).toHaveBeenCalledWith(filepath)
      expect(fsReadFileSyncMock).toHaveBeenCalledTimes(1)
      expect(fsReadFileSyncMock).toHaveBeenCalledWith('/path/to/file.d', 'ascii')
      expect(parser.filelist).toEqual([relPath])
      expect(parser.symbolTable).toEqual([{ name: 'SYMBOL1', file: '', line: 1 }])
      expect(parser.referenceTable).toEqual([])
    })

    it('should not parse the file if it has an invalid extension', () => {
      const patchName = 'test'
      const filepath = '/path/to/file.txt'
      const parser = new Parser(patchName, filepath)

      parser['parseD'](filepath)

      expect(fsReadFileSyncMock).not.toHaveBeenCalled()
      expect(parser.filelist).toEqual([])
      expect(parser.symbolTable).toEqual([])
      expect(parser.referenceTable).toEqual([])
    })

    it('should not parse the file if it does not exist', () => {
      const patchName = 'test'
      const filepath = '/path/to/nonexistent.d'
      const parser = new Parser(patchName, filepath)

      fsExistsSyncMock.mockReturnValue(false)

      parser['parseD'](filepath)

      expect(fsReadFileSyncMock).not.toHaveBeenCalled()
      expect(parser.filelist).toEqual([])
      expect(parser.symbolTable).toEqual([])
      expect(parser.referenceTable).toEqual([])
    })

    it('should not parse the file twice', () => {
      const patchName = 'test'
      const filepath = '/path/to/file.d'
      const relPath = 'path/to/file.d'
      const parser = new Parser(patchName, filepath)

      const stripPath = jest.spyOn(parser as any, 'stripPath')
      fsExistsSyncMock.mockReturnValue(true)
      ;(parser as any).filelist = [relPath]

      parser['parseD'](filepath)

      expect(stripPath).toHaveBeenCalledWith(filepath)
      expect(stripPath).toHaveReturnedWith({ fullPath: filepath, relPath: relPath })
      expect(fsReadFileSyncMock).not.toHaveBeenCalled()
      expect(parser.filelist).toEqual([relPath])
      expect(parser.symbolTable).toEqual([])
      expect(parser.referenceTable).toEqual([])
    })

    it('should parse a complete grammar to cover all cases', () => {
      const patchName = 'test'
      const filepath = '/path/to/file.d'
      const workingDir = '/path/to'
      const relPath = 'file.d'
      const parser = new Parser(patchName, filepath, workingDir)
      const content = `// Some example code covering all relevant grammar rules

const int Symbol1 = 0;
const int Symbol2[2] = {0, 0};
var int Symbol3;
var int Symbol4[2];
class Symbol5 {
  var int Symbol6;
  var string Symbol7;
};
prototype Symbol8(Symbol5) {
  Symbol6 = 0;
  Symbol7 = "test0";
};
instance Symbol9(Symbol5) {
  Symbol6 = 1;
  Symbol7 = "test1";
};
instance Symbol10(Symbol5);
func void Symbol11(var int Symbol12, var string Symbol13, var Symbol5 Symbol14) {
  var int Symbol15;
  var string Symbol16;
  const int Symbol17 = 0;
  const string Symbol18 = "test";
  const int Symbol19[2] = {0, 0};
  const string Symbol20[2] = { "", "" };
  const int Symbol1 = 0; // Scoped symbol
  Symbol1 = 1; // Scoped assignment
  Symbol3 = Symbol1 + Symbol3; // Assignment and expression
  Symbol4[0] = 0; // Assignment
  var Symbol5 Symbol21; // Indentifier declaration
  Symbol21.Symbol6 = 0; // Member assignment
};
`

      const stripPath = jest.spyOn(parser as any, 'stripPath')
      fsExistsSyncMock.mockReturnValueOnce(true)
      fsReadFileSyncMock.mockReturnValueOnce(content)

      parser['parseD'](filepath)

      expect(stripPath).toHaveBeenCalledWith(filepath)
      expect(fsReadFileSyncMock).toHaveBeenCalledWith('/path/to/file.d', 'ascii')
      expect(parser.filelist).toEqual([relPath])
      expect(parser.symbolTable).toEqual([
        { name: 'SYMBOL1', file: 'file.d', line: 3 },
        { name: 'SYMBOL2', file: 'file.d', line: 4 },
        { name: 'SYMBOL3', file: 'file.d', line: 5 },
        { name: 'SYMBOL4', file: 'file.d', line: 6 },
        { name: 'SYMBOL5', file: 'file.d', line: 7 },
        { name: 'SYMBOL5.SYMBOL6', file: 'file.d', line: 8 },
        { name: 'SYMBOL5.SYMBOL7', file: 'file.d', line: 9 },
        { name: 'SYMBOL8', file: 'file.d', line: 11 },
        { name: 'SYMBOL8.SYMBOL6', file: 'file.d', line: 11 },
        { name: 'SYMBOL8.SYMBOL7', file: 'file.d', line: 11 },
        { name: 'SYMBOL9', file: 'file.d', line: 15 },
        { name: 'SYMBOL9.SYMBOL6', file: 'file.d', line: 15 },
        { name: 'SYMBOL9.SYMBOL7', file: 'file.d', line: 15 },
        { name: 'SYMBOL10', file: 'file.d', line: 19 },
        { name: 'SYMBOL10.SYMBOL6', file: 'file.d', line: 19 },
        { name: 'SYMBOL10.SYMBOL7', file: 'file.d', line: 19 },
        { name: 'SYMBOL11', file: 'file.d', line: 20 },
        { name: 'SYMBOL11.SYMBOL12', file: 'file.d', line: 20 },
        { name: 'SYMBOL11.SYMBOL13', file: 'file.d', line: 20 },
        { name: 'SYMBOL11.SYMBOL14', file: 'file.d', line: 20 },
        { name: 'SYMBOL11.SYMBOL14.SYMBOL6', file: 'file.d', line: 20 },
        { name: 'SYMBOL11.SYMBOL14.SYMBOL7', file: 'file.d', line: 20 },
        { name: 'SYMBOL11.SYMBOL15', file: 'file.d', line: 21 },
        { name: 'SYMBOL11.SYMBOL16', file: 'file.d', line: 22 },
        { name: 'SYMBOL11.SYMBOL17', file: 'file.d', line: 23 },
        { name: 'SYMBOL11.SYMBOL18', file: 'file.d', line: 24 },
        { name: 'SYMBOL11.SYMBOL19', file: 'file.d', line: 25 },
        { name: 'SYMBOL11.SYMBOL20', file: 'file.d', line: 26 },
        { name: 'SYMBOL11.SYMBOL1', file: 'file.d', line: 27 },
        { name: 'SYMBOL11.SYMBOL21', file: 'file.d', line: 31 },
        { name: 'SYMBOL11.SYMBOL21.SYMBOL6', file: 'file.d', line: 31 },
        { name: 'SYMBOL11.SYMBOL21.SYMBOL7', file: 'file.d', line: 31 },
      ])
      expect(parser.referenceTable).toEqual([
        { name: 'SYMBOL8.SYMBOL6', file: 'file.d', line: 12 },
        { name: 'SYMBOL8.SYMBOL7', file: 'file.d', line: 13 },
        { name: 'SYMBOL9.SYMBOL6', file: 'file.d', line: 16 },
        { name: 'SYMBOL9.SYMBOL7', file: 'file.d', line: 17 },
        { name: 'SYMBOL11.SYMBOL1', file: 'file.d', line: 28 },
        { name: 'SYMBOL3', file: 'file.d', line: 29 },
        { name: 'SYMBOL11.SYMBOL1', file: 'file.d', line: 29 },
        { name: 'SYMBOL3', file: 'file.d', line: 29 },
        { name: 'SYMBOL4', file: 'file.d', line: 30 },
        { name: 'SYMBOL11.SYMBOL21.SYMBOL6', file: 'file.d', line: 32 },
      ])
    })
  })

  describe('parseRequired', () => {
    it('should parse content symbols if type is "CONTENT" and version = 112', () => {
      const patchName = 'test'
      const filepath = '/path/to/file.src'
      const parser = new Parser(patchName, filepath)
      const expected = [
        { name: 'C_NPC', file: '', line: 0 },
        { name: 'C_ITEM', file: '', line: 0 },
        { name: 'SELF', file: '', line: 0 },
        { name: 'OTHER', file: '', line: 0 },
        { name: 'VICTIM', file: '', line: 0 },
        { name: 'ITEM', file: '', line: 0 },
        { name: 'HERO', file: '', line: 0 },
        { name: 'NINJA_SYMBOLS_START', file: '', line: 0 },
        { name: 'NINJA_SYMBOLS_START_TEST', file: '', line: 0 },
        { name: 'NINJA_VERSION', file: '', line: 0 },
        { name: 'NINJA_PATCHES', file: '', line: 0 },
        { name: 'NINJA_ID_TEST', file: '', line: 0 },
        { name: 'NINJA_MODNAME', file: '', line: 0 },
      ]

      ;(parser as any)['type'] = 'CONTENT'
      ;(parser as any)['version'] = 112
      parser['parseRequired']()

      expect(parser.symbolTable).toEqual(expected)
      expect(parser.referenceTable).toEqual([])
    })

    it('should parse content symbols if type is "CONTENT" and version = 130', () => {
      const patchName = 'test'
      const filepath = '/path/to/file.src'
      const parser = new Parser(patchName, filepath)
      const expected = [
        { name: 'C_NPC', file: '', line: 0 },
        { name: 'C_ITEM', file: '', line: 0 },
        { name: 'SELF', file: '', line: 0 },
        { name: 'OTHER', file: '', line: 0 },
        { name: 'VICTIM', file: '', line: 0 },
        { name: 'ITEM', file: '', line: 0 },
        { name: 'HERO', file: '', line: 0 },
        { name: 'INIT_GLOBAL', file: '', line: 0 },
        { name: 'STARTUP_GLOBAL', file: '', line: 0 },
        { name: 'NINJA_SYMBOLS_START', file: '', line: 0 },
        { name: 'NINJA_SYMBOLS_START_TEST', file: '', line: 0 },
        { name: 'NINJA_VERSION', file: '', line: 0 },
        { name: 'NINJA_PATCHES', file: '', line: 0 },
        { name: 'NINJA_ID_TEST', file: '', line: 0 },
        { name: 'NINJA_MODNAME', file: '', line: 0 },
      ]

      ;(parser as any)['type'] = 'CONTENT'
      ;(parser as any)['version'] = 130
      parser['parseRequired']()

      expect(parser.symbolTable).toEqual(expected)
      expect(parser.referenceTable).toEqual([])
    })

    it('should parse menu symbols if type is "MENU"', () => {
      const patchName = 'test'
      const filepath = '/path/to/file.src'
      const parser = new Parser(patchName, filepath)
      const expected = [
        { name: 'MENU_MAIN', file: '', line: 0 },
        { name: 'NINJA_SYMBOLS_START', file: '', line: 0 },
        { name: 'NINJA_SYMBOLS_START_TEST', file: '', line: 0 },
        { name: 'NINJA_VERSION', file: '', line: 0 },
        { name: 'NINJA_PATCHES', file: '', line: 0 },
        { name: 'NINJA_ID_TEST', file: '', line: 0 },
        { name: 'NINJA_MODNAME', file: '', line: 0 },
      ]

      ;(parser as any)['type'] = 'MENU'
      parser['parseRequired']()

      expect(parser.symbolTable).toEqual(expected)
      expect(parser.referenceTable).toEqual([])
    })

    it('should parse menu symbols if type is "CAMERA"', () => {
      const patchName = 'test'
      const filepath = '/path/to/file.src'
      const parser = new Parser(patchName, filepath)
      const expected = [
        { name: 'CAMMODNORMAL', file: '', line: 0 },
        { name: 'NINJA_SYMBOLS_START', file: '', line: 0 },
        { name: 'NINJA_SYMBOLS_START_TEST', file: '', line: 0 },
        { name: 'NINJA_VERSION', file: '', line: 0 },
        { name: 'NINJA_PATCHES', file: '', line: 0 },
        { name: 'NINJA_ID_TEST', file: '', line: 0 },
        { name: 'NINJA_MODNAME', file: '', line: 0 },
      ]

      ;(parser as any)['type'] = 'CAMERA'
      parser['parseRequired']()

      expect(parser.symbolTable).toEqual(expected)
      expect(parser.referenceTable).toEqual([])
    })

    it('should only parse helper symbols if type is any other', () => {
      const patchName = 'test'
      const filepath = '/path/to/file.src'
      const parser = new Parser(patchName, filepath)
      const expected = [
        { name: 'NINJA_SYMBOLS_START', file: '', line: 0 },
        { name: 'NINJA_SYMBOLS_START_TEST', file: '', line: 0 },
        { name: 'NINJA_VERSION', file: '', line: 0 },
        { name: 'NINJA_PATCHES', file: '', line: 0 },
        { name: 'NINJA_ID_TEST', file: '', line: 0 },
        { name: 'NINJA_MODNAME', file: '', line: 0 },
      ]

      ;(parser as any)['type'] = 'OTHER'
      parser['parseRequired']()

      expect(parser.symbolTable).toEqual(expected)
      expect(parser.referenceTable).toEqual([])
    })
  })

  describe('parseExternals', () => {
    it('should not parse non-existent external', () => {
      const patchName = 'test'
      const filepath = '/path/to/filepath_G6.src'
      const parser = new Parser(patchName, filepath)

      parser['parseExternals']()

      expect(parser.symbolTable).toEqual([])
      expect(parser.referenceTable).toEqual([])
    })

    it('should parse G1 content external', () => {
      const patchName = 'test'
      const filepath = '/path/to/Content_G1.src'
      const parser = new Parser(patchName, filepath)

      parser['parseExternals']()

      expect(parser.type).toBe('CONTENT')
      expect(parser.version).toBe(1)
      expect(parser.symbolTable).toHaveLength(290 + 1)
      expect(parser.symbolTable).toContainEqual({ name: 'AI_LOOKFORITEM', file: '', line: 0 })
      expect(parser.referenceTable).toEqual([])
    })

    it('should parse G112 content external', () => {
      const patchName = 'test'
      const filepath = '/path/to/Content_G112.src'
      const parser = new Parser(patchName, filepath)

      parser['parseExternals']()

      expect(parser.type).toBe('CONTENT')
      expect(parser.version).toBe(112)
      expect(parser.symbolTable).toHaveLength(290 + 18)
      expect(parser.symbolTable).toContainEqual({ name: 'PRINTSCREENCOLORED', file: '', line: 0 })
      expect(parser.referenceTable).toEqual([])
    })

    it('should parse G130 content external', () => {
      const patchName = 'test'
      const filepath = '/path/to/Content_G130.src'
      const parser = new Parser(patchName, filepath)

      parser['parseExternals']()

      expect(parser.type).toBe('CONTENT')
      expect(parser.version).toBe(130)
      expect(parser.symbolTable).toHaveLength(290 + 20)
      expect(parser.symbolTable).toContainEqual({ name: 'EXITSESSION', file: '', line: 0 })
      expect(parser.referenceTable).toEqual([])
    })

    it('should parse G2 content external', () => {
      const patchName = 'test'
      const filepath = '/path/to/Content_G2.src'
      const parser = new Parser(patchName, filepath)

      parser['parseExternals']()

      expect(parser.type).toBe('CONTENT')
      expect(parser.version).toBe(2)
      expect(parser.symbolTable).toHaveLength(290 + 27)
      expect(parser.symbolTable).toContainEqual({ name: 'NPC_GETLASTHITSPELLID', file: '', line: 0 })
      expect(parser.referenceTable).toEqual([])
    })
  })

  describe('parseSpecial', () => {
    beforeEach(() => {
      ioMkdirPMock = jest.spyOn(io, 'mkdirP').mockResolvedValue()
      ioRmRFMock = jest.spyOn(io, 'rmRF').mockResolvedValue()
      tcDownloadToolMock = jest.spyOn(tc, 'downloadTool')
      tcExtractTarMock = jest.spyOn(tc, 'extractTar')

      // Fix path in environment variables
      if (!('PATH' in process.env) && 'Path' in process.env) {
        jest.replaceProperty(process, 'env', { ...process.env, PATH: process.env['Path'] })
      }
    })

    afterAll(() => {
      io.rmRF('.patch-validator-special')
      io.rmRF('.patch-validator-tmp')
    })

    it('should parse ikarus if type is "CONTENT"', async () => {
      const patchName = 'test'
      const filepath = '/path/to/file.src'
      const parser = new Parser(patchName, filepath)

      tcDownloadToolMock.mockResolvedValue('/path/to/ikarus.tar.gz')
      tcExtractTarMock.mockResolvedValue('/path/to/ikarus')
      const posixJoin = jest.spyOn(posix, 'join')
      const parseSrc = jest.spyOn(parser as any, 'parseSrc').mockImplementation()
      ;(parser as any)['type'] = 'CONTENT'
      ;(parser as any)['version'] = 1
      await parser['parseSpecial']('Ikarus')

      expect(posixJoin).toHaveBeenCalledWith('.patch-validator-special', 'Ikarus-gameversions', 'Ikarus_G1.src')
      expect(tcDownloadToolMock).toHaveBeenCalledWith('https://github.com/Lehona/Ikarus/archive/refs/heads/gameversions.tar.gz')
      expect(ioMkdirPMock).toHaveBeenCalledWith('.patch-validator-special')
      expect(tcExtractTarMock).toHaveBeenCalledWith('/path/to/ikarus.tar.gz', '.patch-validator-special')
      expect(ioRmRFMock).toHaveBeenCalledWith('/path/to/ikarus.tar.gz')
      expect(parseSrc).toHaveBeenCalledWith('.patch-validator-special/Ikarus-gameversions/Ikarus_G1.src', false, true)
      expect(ioRmRFMock).toHaveBeenCalledWith('.patch-validator-special')

      expect(parser.symbolTable).toEqual([
        { name: 'DAM_INDEX_MAX', file: '', line: 0 },
        { name: 'PROT_INDEX_MAX', file: '', line: 0 },
        { name: 'ITM_TEXT_MAX', file: '', line: 0 },
        { name: 'ATR_HITPOINTS', file: '', line: 0 },
        { name: 'ATR_HITPOINTS_MAX', file: '', line: 0 },
        { name: 'ATR_MANA', file: '', line: 0 },
        { name: 'ATR_MANA_MAX', file: '', line: 0 },
        { name: 'PERC_ASSESSDAMAGE', file: '', line: 0 },
        { name: 'ITEM_KAT_NF', file: '', line: 0 },
        { name: 'ITEM_KAT_FF', file: '', line: 0 },
        { name: 'TRUE', file: '', line: 0 },
        { name: 'FALSE', file: '', line: 0 },
        { name: 'LOOP_CONTINUE', file: '', line: 0 },
        { name: 'LOOP_END', file: '', line: 0 },
        { name: 'ATT_FRIENDLY', file: '', line: 0 },
        { name: 'ATT_NEUTRAL', file: '', line: 0 },
        { name: 'ATT_ANGRY', file: '', line: 0 },
        { name: 'ATT_HOSTILE', file: '', line: 0 },
      ])
      expect(parser.referenceTable).toEqual([])
    })

    it('should parse lego if type is "CONTENT"', async () => {
      const patchName = 'test'
      const filepath = '/path/to/file.src'
      const parser = new Parser(patchName, filepath)

      const posixJoin = jest.spyOn(posix, 'join')
      const parseSrc = jest.spyOn(parser as any, 'parseSrc').mockImplementation()
      tcDownloadToolMock.mockResolvedValue('/path/to/lego.tar.gz')
      tcExtractTarMock.mockResolvedValue('/path/to/lego')
      ;(parser as any)['type'] = 'CONTENT'
      ;(parser as any)['version'] = 2
      await parser['parseSpecial']('LeGo')

      expect(posixJoin).toHaveBeenCalledWith('.patch-validator-special', 'LeGo-gameversions', 'Header_G2.src')
      expect(tcDownloadToolMock).toHaveBeenCalledWith('https://github.com/Lehona/LeGo/archive/refs/heads/gameversions.tar.gz')
      expect(ioMkdirPMock).toHaveBeenCalledWith('.patch-validator-special')
      expect(tcExtractTarMock).toHaveBeenCalledWith('/path/to/lego.tar.gz', '.patch-validator-special')
      expect(ioRmRFMock).toHaveBeenCalledWith('/path/to/lego.tar.gz')
      expect(parseSrc).toHaveBeenCalledWith('.patch-validator-special/LeGo-gameversions/Header_G2.src', false, true)
      expect(ioRmRFMock).toHaveBeenCalledWith('.patch-validator-special')

      expect(parser.symbolTable).toEqual([
        { name: 'LEGO_MERGEFLAGS', file: '', line: 0 },
        { name: 'FOREACHPATCHHNDL', file: '', line: 0 },
      ])
      expect(parser.referenceTable).toEqual([])
    })

    it('should not parse anything if pattern is neither ikarus nor lego', async () => {
      const patchName = 'test'
      const filepath = '/path/to/file.src'
      const parser = new Parser(patchName, filepath)

      ;(parser as any)['type'] = 'CONTENT'
      await parser['parseSpecial']('something')

      expect(parser.symbolTable).toEqual([])
      expect(parser.referenceTable).toEqual([])
    })

    it('should not parse lego if type is not "CONTENT"', async () => {
      const patchName = 'test'
      const filepath = '/path/to/file.src'
      const parser = new Parser(patchName, filepath)

      ;(parser as any)['type'] = 'MENU'
      await parser['parseSpecial']('LeGo')

      expect(parser.symbolTable).toEqual([])
      expect(parser.referenceTable).toEqual([])
    })

    it('should download, extract and actually parse ikarus', async () => {
      const patchName = 'test'
      const filepath = '/path/to/Content_G130.src'
      const parser = new Parser(patchName, filepath)

      ioMkdirPMock.mockRestore()
      ioRmRFMock.mockRestore()
      tcDownloadToolMock.mockRestore()
      tcExtractTarMock.mockRestore()

      jest.replaceProperty(process, 'env', { ...process.env, RUNNER_TEMP: './.patch-validator-tmp/' })

      await parser['parseSpecial']('Ikarus')

      expect(parser.symbolTable.length).toBeGreaterThan(5000)
      expect(parser.symbolTable).toContainEqual({ name: 'LOOP_CONTINUE', file: '', line: 0 })
      expect(parser.symbolTable).toContainEqual(expect.objectContaining({ name: 'ZCTREE', file: '' }))
      expect(parser.symbolTable).toContainEqual(expect.objectContaining({ name: 'MEM_INITALL', file: '' }))
      expect(parser.referenceTable).toEqual([])
    }, 60000)

    it('should download, extract and actually parse lego', async () => {
      const patchName = 'test'
      const filepath = '/path/to/Content_G112.src'
      const parser = new Parser(patchName, filepath)

      ioMkdirPMock.mockRestore()
      ioRmRFMock.mockRestore()
      tcDownloadToolMock.mockRestore()
      tcExtractTarMock.mockRestore()

      jest.replaceProperty(process, 'env', { ...process.env, RUNNER_TEMP: './.patch-validator-tmp/' })

      await parser['parseSpecial']('LeGo')

      expect(parser.symbolTable.length).toBeGreaterThan(5000)
      expect(parser.symbolTable).toContainEqual({ name: 'LEGO_MERGEFLAGS', file: '', line: 0 })
      expect(parser.symbolTable).toContainEqual(expect.objectContaining({ name: '_LEGO_FLAGS', file: '' }))
      expect(parser.referenceTable).toEqual([])
    }, 60000)
  })

  describe('validateNames', () => {
    it('should validate the names of symbols in the symbol table', () => {
      const patchName = 'test'
      const filepath = '/path/to/file.src'
      const parser = new Parser(patchName, filepath)

      ;(parser as any).symbolTable = [
        { name: 'SYMBOL1', file: 'path/to/file.d', line: 1 }, // Violation
        { name: 'SYMBOL1.LOCAL', file: 'path/to/file.d', line: 1 }, // Non-global
        { name: 'SYMBOL2', file: 'path/to/file.d', line: 2 }, // Ignored
        { name: 'PREFIX_SYMBOL3', file: 'path/to/file.d', line: 3 }, // Prefixed
        { name: 'SYMBOL4', file: '', line: 3 }, // Not part of the patch
      ]

      parser.validateNames(['PREFIX_'], ['SYMBOL2'])

      expect(parser.namingViolations).toEqual([{ name: 'SYMBOL1', file: 'path/to/file.d', line: 1 }])
    })
  })

  describe('validateReferences', () => {
    it('should validate the references in the reference table against the symbol table', () => {
      const patchName = 'test'
      const filepath = '/path/to/file.src'
      const parser = new Parser(patchName, filepath)

      ;(parser as any).symbolTable = [
        { name: 'Symbol1', file: 'path/to/file1.d', line: 1 },
        { name: 'Symbol1.local', file: 'path/to/file1.d', line: 2 },
        { name: 'Symbol2', file: 'path/to/file1.d', line: 3 },
        { name: 'Symbol3', file: 'path/to/file1.d', line: 4 },
      ]
      ;(parser as any).referenceTable = [
        { name: 'Symbol1', file: 'path/to/file2.d', line: 3 },
        { name: 'Symbol1.local', file: 'path/to/file2.d', line: 10 },
        { name: 'Symbol3.local', file: 'path/to/file2.d', line: 15 },
        { name: 'Symbol4', file: 'path/to/file2.d', line: 22 },
        { name: 'Symbol4', file: '', line: 23 },
      ]

      parser.validateReferences()

      expect(parser.referenceViolations).toEqual([
        { name: 'Symbol3.local', file: 'path/to/file2.d', line: 15 },
        { name: 'Symbol4', file: 'path/to/file2.d', line: 22 },
      ])
    })
  })

  describe('validateOverwrites', () => {
    it('should filter symbol table for overwrite violations for type "CONTENT"', () => {
      const parser = new Parser('test', '/path/to/Content.src')
      ;(parser as any)['symbolTable'] = [
        { name: 'INITPERCEPTIONS', file: 'file1', line: 1 },
        { name: 'INIT_GLOBAL', file: '', line: 2 },
        { name: 'NINJA_MODNAME', file: 'file3', line: 3 },
        { name: 'SYMBOL4', file: 'file4', line: 4 },
      ]

      parser.validateOverwrites()

      expect(parser.overwriteViolations).toEqual([
        { name: 'INITPERCEPTIONS', file: 'file1', line: 1 },
        { name: 'NINJA_MODNAME', file: 'file3', line: 3 },
      ])
    })

    it('should not filter symbols for another type', () => {
      const parser = new Parser('test', '/path/to/Menu.src')
      ;(parser as any)['symbolTable'] = [
        { name: 'INITPERCEPTIONS', file: 'file1', line: 1 },
        { name: 'INIT_GLOBAL', file: '', line: 2 },
        { name: 'NINJA_MODNAME', file: 'file3', line: 3 },
        { name: 'SYMBOL4', file: 'file4', line: 4 },
      ]

      parser.validateOverwrites()

      expect(parser.overwriteViolations).toEqual([])
    })
  })
})
