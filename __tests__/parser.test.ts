import { Parser } from '../src/parser.ts'
import fs from 'fs'

jest.mock('fs')

let fsExistsSyncMock: jest.SpiedFunction<typeof fs.existsSync>
let fsReadFileSyncMock: jest.SpiedFunction<typeof fs.readFileSync>

describe('Parser', () => {
  beforeEach(() => {
    fsExistsSyncMock = jest.spyOn(fs, 'existsSync')
    fsReadFileSyncMock = jest.spyOn(fs, 'readFileSync')
  })

  describe('constructor', () => {
    it('should initialize the Parser object with version and working directory', () => {
      const filepath = '/path/to/conTENT_g1.src'
      const workingDir = '/path/to/workingDir'
      fsExistsSyncMock.mockReturnValue(false)

      const parser = new Parser(filepath, workingDir)

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
      const filepath = '/path/to/file.src'
      const workingDir = ''
      fsExistsSyncMock.mockReturnValue(false)

      const parser = new Parser(filepath)

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
    it('parses all candidate SRC files', async () => {
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
        symbolTable: [],
        type: 'CONTENT',
        version: 1,
        workingDir: '',
      } as unknown as Parser

      fsExistsSyncMock.mockReturnValue(false).mockReturnValueOnce(true)
      fsReadFileSyncMock.mockReturnValue('').mockReturnValueOnce('test.d\n')

      const result = Parser.from(basePath, workingDir)
      expect(result).toEqual([oneParser])
      expect(fsExistsSyncMock).toHaveBeenCalledTimes(candidates.length + 1)
      candidates.forEach((candidate) => {
        expect(fsExistsSyncMock).toHaveBeenCalledWith(candidate)
      })
      expect(fsReadFileSyncMock).not.toHaveBeenCalled()
    })
  })

  describe('stripPath', () => {
    it('should strip the path from the file path', () => {
      const filepath = '/path/to/file.src'
      const workingDir = '/path'
      const parser = new Parser(filepath, workingDir)

      const result = parser['stripPath'](filepath)

      expect(result).toEqual({ fullPath: filepath, relPath: 'to/file.src' })
    })
  })

  describe('parse', () => {
    it('should parse the file and fill the symbol table', () => {
      const filepath = '/path/to/file.src'

      const parser = new Parser(filepath)

      parser['parseExternals'] = jest.fn()
      parser['parseRequired'] = jest.fn()
      parser['parseSrc'] = jest.fn()

      parser.parse()

      expect(parser['parseExternals']).toHaveBeenCalled()
      expect(parser['parseRequired']).toHaveBeenCalled()
      expect(parser['parseSrc']).toHaveBeenCalledWith(filepath, true)
    })
  })

  describe('parseSrc', () => {
    it('should parse the source file and call parseD or parseSrc recursively', () => {
      const filepath = '/path/to/file.src'
      const parser = new Parser(filepath)

      parser['stripPath'] = jest.fn().mockReturnValue({ fullPath: '/path/to/file.src', relPath: 'file.src' })
      parser['parseD'] = jest.fn()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parseSrc = jest.spyOn(parser as any, 'parseSrc')

      fsExistsSyncMock.mockReturnValue(false).mockReturnValueOnce(true)
      fsReadFileSyncMock.mockReturnValue('sub\\file.d\nrecurse.src\n')

      parser['parseSrc'](filepath, true)

      expect(parser['stripPath']).toHaveBeenCalledWith(filepath)
      expect(parser['parseD']).toHaveBeenCalledWith('/path/to/sub/file.d')
      expect(parseSrc).toHaveBeenCalledWith('/path/to/recurse.src')
    })

    it('should not parse the source file if it has an invalid extension', () => {
      const filepath = '/path/to/file.src'
      const parser = new Parser(filepath)

      parser['parseD'] = jest.fn()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parseSrc = jest.spyOn(parser as any, 'parseSrc')

      fsExistsSyncMock.mockReturnValue(true)
      fsReadFileSyncMock.mockReturnValue('sub\\file.txt\n')

      parser['parseSrc'](filepath, true)

      expect(parser['parseD']).not.toHaveBeenCalled()
      expect(parseSrc).toHaveBeenCalledTimes(1)
    })

    it('should parse the special line', () => {
      const filepath = '/path/to/file.src'
      const parser = new Parser(filepath)

      parser['stripPath'] = jest.fn().mockReturnValue({ fullPath: '/path/to/file.src', relPath: 'file.src' })
      parser['parseSpecial'] = jest.fn()

      fsExistsSyncMock.mockReturnValue(true)
      fsReadFileSyncMock.mockReturnValue('non-path\n')

      parser['parseSrc'](filepath, true)

      expect(parser['parseSpecial']).toHaveBeenCalledWith('non-path')
    })

    it('should throw an error if wildcards are used in the filepath', () => {
      const filepath = '/path/to/*.src'
      const parser = new Parser(filepath)

      expect(() => parser['parseSrc'](filepath, true)).toThrow('Wildcards are not supported')
    })
  })

  describe('parseD', () => {
    it('should parse the specified file and collect symbol tables', () => {
      const filepath = '/path/to/file.d'
      const workingDir = '/path/'
      const relPath = 'to/file.d'
      const parser = new Parser(filepath, workingDir)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const stripPath = jest.spyOn(parser as any, 'stripPath')
      fsExistsSyncMock.mockReturnValue(true)
      fsReadFileSyncMock.mockReturnValueOnce('const int Symbol1 = 0;')

      parser['parseD'](filepath)

      expect(stripPath).toHaveBeenCalledWith(filepath)
      expect(fsReadFileSyncMock).toHaveBeenCalledTimes(1)
      expect(fsReadFileSyncMock).toHaveBeenCalledWith('/path/to/file.d', 'ascii')
      expect(parser.filelist).toEqual([relPath])
      expect(parser.symbolTable).toEqual([{ name: 'Symbol1', file: relPath, line: 1 }])
      expect(parser.referenceTable).toEqual([])
    })

    it('should not parse the file if it has an invalid extension', () => {
      const filepath = '/path/to/file.txt'
      const parser = new Parser(filepath)

      parser['parseD'](filepath)

      expect(fsReadFileSyncMock).not.toHaveBeenCalled()
      expect(parser.filelist).toEqual([])
      expect(parser.symbolTable).toEqual([])
      expect(parser.referenceTable).toEqual([])
    })

    it('should not parse the file if it does not exist', () => {
      const filepath = '/path/to/nonexistent.d'
      const parser = new Parser(filepath)

      fsExistsSyncMock.mockReturnValue(false)

      parser['parseD'](filepath)

      expect(fsReadFileSyncMock).not.toHaveBeenCalled()
      expect(parser.filelist).toEqual([])
      expect(parser.symbolTable).toEqual([])
      expect(parser.referenceTable).toEqual([])
    })

    it('should not parse the file twice', () => {
      const filepath = '/path/to/file.d'
      const relPath = 'path/to/file.d'
      const parser = new Parser(filepath)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const stripPath = jest.spyOn(parser as any, 'stripPath')
      fsExistsSyncMock.mockReturnValue(true)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(parser as any).filelist = [relPath]

      parser['parseD'](filepath)

      expect(stripPath).toHaveBeenCalledWith(filepath)
      expect(stripPath).toHaveReturnedWith({ fullPath: filepath, relPath: relPath })
      expect(fsReadFileSyncMock).not.toHaveBeenCalled()
      expect(parser.filelist).toEqual([relPath])
      expect(parser.symbolTable).toEqual([])
      expect(parser.referenceTable).toEqual([])
    })

    it('should throw an error if wildcards are used in the filepath', () => {
      const filepath = '/path/to/*.d'
      const parser = new Parser(filepath)

      expect(() => parser['parseD'](filepath)).toThrow('Wildcards are not supported')
    })

    it('should parse a complete grammar to cover all cases', () => {
      const filepath = '/path/to/file.d'
      const workingDir = '/path/to'
      const relPath = 'file.d'
      const parser = new Parser(filepath, workingDir)
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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const stripPath = jest.spyOn(parser as any, 'stripPath')
      fsExistsSyncMock.mockReturnValueOnce(true)
      fsReadFileSyncMock.mockReturnValueOnce(content)

      parser['parseD'](filepath)

      expect(stripPath).toHaveBeenCalledWith(filepath)
      expect(fsReadFileSyncMock).toHaveBeenCalledWith('/path/to/file.d', 'ascii')
      expect(parser.filelist).toEqual([relPath])
      expect(parser.symbolTable).toEqual([
        { name: 'Symbol1', file: 'file.d', line: 3 },
        { name: 'Symbol2', file: 'file.d', line: 4 },
        { name: 'Symbol3', file: 'file.d', line: 5 },
        { name: 'Symbol4', file: 'file.d', line: 6 },
        { name: 'Symbol5', file: 'file.d', line: 7 },
        { name: 'Symbol5.Symbol6', file: 'file.d', line: 8 },
        { name: 'Symbol5.Symbol7', file: 'file.d', line: 9 },
        { name: 'Symbol8', file: 'file.d', line: 11 },
        { name: 'Symbol8.Symbol6', file: 'file.d', line: 11 },
        { name: 'Symbol8.Symbol7', file: 'file.d', line: 11 },
        { name: 'Symbol9', file: 'file.d', line: 15 },
        { name: 'Symbol9.Symbol6', file: 'file.d', line: 15 },
        { name: 'Symbol9.Symbol7', file: 'file.d', line: 15 },
        { name: 'Symbol10', file: 'file.d', line: 19 },
        { name: 'Symbol10.Symbol6', file: 'file.d', line: 19 },
        { name: 'Symbol10.Symbol7', file: 'file.d', line: 19 },
        { name: 'Symbol11', file: 'file.d', line: 20 },
        { name: 'Symbol11.Symbol12', file: 'file.d', line: 20 },
        { name: 'Symbol11.Symbol13', file: 'file.d', line: 20 },
        { name: 'Symbol11.Symbol14', file: 'file.d', line: 20 },
        { name: 'Symbol11.Symbol14.Symbol6', file: 'file.d', line: 20 },
        { name: 'Symbol11.Symbol14.Symbol7', file: 'file.d', line: 20 },
        { name: 'Symbol11.Symbol15', file: 'file.d', line: 21 },
        { name: 'Symbol11.Symbol16', file: 'file.d', line: 22 },
        { name: 'Symbol11.Symbol17', file: 'file.d', line: 23 },
        { name: 'Symbol11.Symbol18', file: 'file.d', line: 24 },
        { name: 'Symbol11.Symbol19', file: 'file.d', line: 25 },
        { name: 'Symbol11.Symbol20', file: 'file.d', line: 26 },
        { name: 'Symbol11.Symbol1', file: 'file.d', line: 27 },
        { name: 'Symbol11.Symbol21', file: 'file.d', line: 31 },
        { name: 'Symbol11.Symbol21.Symbol6', file: 'file.d', line: 31 },
        { name: 'Symbol11.Symbol21.Symbol7', file: 'file.d', line: 31 },
      ])
      expect(parser.referenceTable).toEqual([
        { name: 'Symbol8.Symbol6', file: 'file.d', line: 12 },
        { name: 'Symbol8.Symbol7', file: 'file.d', line: 13 },
        { name: 'Symbol9.Symbol6', file: 'file.d', line: 16 },
        { name: 'Symbol9.Symbol7', file: 'file.d', line: 17 },
        { name: 'Symbol11.Symbol1', file: 'file.d', line: 28 },
        { name: 'Symbol3', file: 'file.d', line: 29 },
        { name: 'Symbol11.Symbol1', file: 'file.d', line: 29 },
        { name: 'Symbol3', file: 'file.d', line: 29 },
        { name: 'Symbol4', file: 'file.d', line: 30 },
        { name: 'Symbol11.Symbol21.Symbol6', file: 'file.d', line: 32 },
      ])
    })
  })

  describe('parseRequired', () => {
    it('should parse content symbols if type is "CONTENT"', () => {
      const filepath = '/path/to/file.src'
      const parser = new Parser(filepath)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(parser as any)['type'] = 'CONTENT'
      parser['parseRequired']()

      // TODO:
      expect(parser.symbolTable).toEqual([])
      expect(parser.referenceTable).toEqual([])
    })

    it('should parse menu symbols if type is "MENU"', () => {
      const filepath = '/path/to/file.src'
      const parser = new Parser(filepath)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(parser as any)['type'] = 'MENU'
      parser['parseRequired']()

      // TODO:
      expect(parser.symbolTable).toEqual([])
      expect(parser.referenceTable).toEqual([])
    })

    it('should not parse any symbols if type is neither "CONTENT" nor "MENU"', () => {
      const filepath = '/path/to/file.src'
      const parser = new Parser(filepath)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(parser as any)['type'] = 'OTHER'
      parser['parseRequired']()

      // TODO:
      expect(parser.symbolTable).toEqual([])
      expect(parser.referenceTable).toEqual([])
    })
  })

  describe('parseExternals', () => {
    it('should return normally', () => {
      const filepath = '/path/to/file.src'
      const parser = new Parser(filepath)

      parser['parseExternals']()

      // TODO:
      expect(parser.symbolTable).toEqual([])
      expect(parser.referenceTable).toEqual([])
    })
  })

  describe('parseSpecial', () => {
    it('should parse ikarus if type is "CONTENT"', () => {
      const filepath = '/path/to/file.src'
      const parser = new Parser(filepath)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(parser as any)['type'] = 'CONTENT'
      parser['parseSpecial']('Ikarus')

      // TODO:
      expect(parser.symbolTable).toEqual([])
      expect(parser.referenceTable).toEqual([])
    })

    it('should parse lego if type is "CONTENT"', () => {
      const filepath = '/path/to/file.src'
      const parser = new Parser(filepath)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(parser as any)['type'] = 'CONTENT'
      parser['parseSpecial']('LeGo')

      // TODO:
      expect(parser.symbolTable).toEqual([])
      expect(parser.referenceTable).toEqual([])
    })

    it('should not parse lego if type is not "CONTENT"', () => {
      const filepath = '/path/to/file.src'
      const parser = new Parser(filepath)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(parser as any)['type'] = 'MENU'
      parser['parseSpecial']('LeGo')

      // TODO:
      expect(parser.symbolTable).toEqual([])
      expect(parser.referenceTable).toEqual([])
    })
  })

  describe('validateNames', () => {
    it('should validate the names of symbols in the symbol table', () => {
      const filepath = '/path/to/file.src'
      const parser = new Parser(filepath)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(parser as any).symbolTable = [
        { name: 'Symbol1', file: 'path/to/file.d', line: 1 }, // Violation
        { name: 'Symbol1.local', file: 'path/to/file.d', line: 1 }, // Non-global
        { name: 'Symbol2', file: 'path/to/file.d', line: 2 }, // Ignored
        { name: 'Prefix_Symbol3', file: 'path/to/file.d', line: 3 }, // Prefixed
        { name: 'Symbol4', file: '', line: 3 }, // Not part of the patch
      ]

      parser.validateNames(['PREFIX_'], ['SYMBOL2'])

      expect(parser.namingViolations).toEqual([{ name: 'Symbol1', file: 'path/to/file.d', line: 1 }])
    })
  })

  describe('validateReferences', () => {
    it('should validate the references in the reference table against the symbol table', () => {
      const filepath = '/path/to/file.src'
      const parser = new Parser(filepath)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(parser as any).symbolTable = [
        { name: 'Symbol1', file: 'path/to/file1.d', line: 1 },
        { name: 'Symbol1.local', file: 'path/to/file1.d', line: 2 },
        { name: 'Symbol2', file: 'path/to/file1.d', line: 3 },
        { name: 'Symbol3', file: 'path/to/file1.d', line: 4 },
      ]

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(parser as any).referenceTable = [
        { name: 'Symbol1', file: 'path/to/file2.d', line: 3 },
        { name: 'Symbol1.local', file: 'path/to/file2.d', line: 10 },
        { name: 'Symbol3.local', file: 'path/to/file2.d', line: 15 },
        { name: 'Symbol4', file: 'path/to/file2.d', line: 22 },
      ]

      parser.validateReferences()

      expect(parser.referenceViolations).toEqual([
        { name: 'Symbol3.local', file: 'path/to/file2.d', line: 15 },
        { name: 'Symbol4', file: 'path/to/file2.d', line: 22 },
      ])
    })
  })
})
