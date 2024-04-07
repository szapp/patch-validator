import * as parse from '../src/parse.ts'
import fs from 'fs'

let fsExistsSyncMock: jest.SpiedFunction<typeof fs.existsSync>
let fsReadFileSyncMock: jest.SpiedFunction<typeof fs.readFileSync>

describe('parseCandidates', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    fsExistsSyncMock = jest.spyOn(fs, 'existsSync')
    fsReadFileSyncMock = jest.spyOn(fs, 'readFileSync')
  })

  it('parses all candidate SRC files', async () => {
    const basePath = '/path/to/base'
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

    fsExistsSyncMock.mockReturnValue(false)
    fsReadFileSyncMock.mockReturnValue('')

    const result = await parse.parseCandidates(basePath)
    expect(fsExistsSyncMock).toHaveBeenCalledTimes(candidates.length)
    candidates.forEach((candidate) => {
      expect(fsExistsSyncMock).toHaveBeenCalledWith(candidate)
    })
    expect(fsReadFileSyncMock).not.toHaveBeenCalled()
    expect(result).toEqual([])
  })
})

describe('parse', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    fsExistsSyncMock = jest.spyOn(fs, 'existsSync')
    fsReadFileSyncMock = jest.spyOn(fs, 'readFileSync')
  })

  it('returns symbol table without duplicates', async () => {
    const filepath = '/path/to/base/file.src'
    const srcContents = 'example.d\nexample.d\n'
    const dContents = `const int Symbol1 = 0;
const int Symbol2 = 0;
const int Symbol3 = 0;
`
    fsExistsSyncMock.mockReturnValue(true)
    fsReadFileSyncMock.mockImplementation((path: unknown): string => {
      switch (path) {
        case '/path/to/base/file.src':
          return srcContents
        case '/path/to/base/example.d':
          return dContents
        default:
          return ''
      }
    })

    const result = await parse.parse(filepath)
    expect(fsExistsSyncMock).toHaveBeenCalledTimes(3)
    expect(fsExistsSyncMock).toHaveBeenCalledWith(filepath)
    expect(fsExistsSyncMock).toHaveBeenCalledWith('/path/to/base/example.d')
    expect(fsReadFileSyncMock).toHaveBeenCalledTimes(3)
    expect(result).toEqual([
      { name: 'Symbol1', file: 'path/to/base/example.d', line: 1 },
      { name: 'Symbol2', file: 'path/to/base/example.d', line: 2 },
      { name: 'Symbol3', file: 'path/to/base/example.d', line: 3 },
    ])
  })

  it('returns sorted symbol table for multiple SRC files', async () => {
    const filepath = ['/path/to/base/file2.src', '/path/to/base/file1.src', '/path/to/base/file3.src']
    const srcContents1 = 'example1.d\n'
    const srcContents2 = 'example2.d\n'
    const srcContents3 = 'example3.d\n'
    const dContents1 = `const int Symbol1 = 0;
const int Symbol2 = 0;
const int Symbol3 = 0;
`
    const dContents2 = `const int Symbol4 = 0;
const int Symbol5 = 0;
const int Symbol6 = 0;
`
    const dContents3 = `const int Symbol7 = 0;
const int Symbol8 = 0;
const int Symbol9 = 0;
`
    fsExistsSyncMock.mockReturnValue(true)
    fsReadFileSyncMock.mockImplementation((path: unknown): string => {
      switch (path) {
        case '/path/to/base/file1.src':
          return srcContents1
        case '/path/to/base/file2.src':
          return srcContents2
        case '/path/to/base/file3.src':
          return srcContents3
        case '/path/to/base/example1.d':
          return dContents1
        case '/path/to/base/example2.d':
          return dContents2
        case '/path/to/base/example3.d':
          return dContents3
        default:
          return ''
      }
    })

    const result = await parse.parse(filepath)
    expect(fsExistsSyncMock).toHaveBeenCalledTimes(6)
    expect(fsExistsSyncMock).toHaveBeenCalledWith(filepath[0])
    expect(fsExistsSyncMock).toHaveBeenCalledWith(filepath[1])
    expect(fsExistsSyncMock).toHaveBeenCalledWith(filepath[2])
    expect(fsExistsSyncMock).toHaveBeenCalledWith('/path/to/base/example1.d')
    expect(fsExistsSyncMock).toHaveBeenCalledWith('/path/to/base/example2.d')
    expect(fsExistsSyncMock).toHaveBeenCalledWith('/path/to/base/example3.d')
    expect(fsReadFileSyncMock).toHaveBeenCalledTimes(6)
    expect(result).toEqual([
      { name: 'Symbol1', file: 'path/to/base/example1.d', line: 1 },
      { name: 'Symbol2', file: 'path/to/base/example1.d', line: 2 },
      { name: 'Symbol3', file: 'path/to/base/example1.d', line: 3 },
      { name: 'Symbol4', file: 'path/to/base/example2.d', line: 1 },
      { name: 'Symbol5', file: 'path/to/base/example2.d', line: 2 },
      { name: 'Symbol6', file: 'path/to/base/example2.d', line: 3 },
      { name: 'Symbol7', file: 'path/to/base/example3.d', line: 1 },
      { name: 'Symbol8', file: 'path/to/base/example3.d', line: 2 },
      { name: 'Symbol9', file: 'path/to/base/example3.d', line: 3 },
    ])
  })
})

describe('parseSrc', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    fsExistsSyncMock = jest.spyOn(fs, 'existsSync')
    fsReadFileSyncMock = jest.spyOn(fs, 'readFileSync')
  })

  it('returns empty symbol table for empty files', async () => {
    const filepath = '/path/to/base/file1.src'
    const srcContents1 = 'sub\\file2.src\n'
    const srcContents2 = 'some.txt\n'
    fsExistsSyncMock.mockReturnValue(true)
    fsReadFileSyncMock.mockImplementation((path: unknown): string => {
      switch (path) {
        case filepath:
          return srcContents1
        case '/path/to/base/sub/file2.src':
          return srcContents2
        default:
          return ''
      }
    })

    const result = await parse.parseSrc(filepath)
    expect(fsExistsSyncMock).toHaveBeenCalledTimes(2)
    expect(fsExistsSyncMock).toHaveBeenCalledWith(filepath)
    expect(fsExistsSyncMock).toHaveBeenCalledWith('/path/to/base/sub/file2.src')
    expect(fsReadFileSyncMock).toHaveBeenCalledTimes(2)
    expect(result).toEqual([])
  })

  it('returns empty symbol table for invalid extension', async () => {
    const filepath = '/path/to/base/file.ext'
    fsExistsSyncMock.mockReturnValue(true)
    const result = await parse.parseSrc(filepath)
    expect(fsExistsSyncMock).not.toHaveBeenCalled()
    expect(fsReadFileSyncMock).not.toHaveBeenCalled()
    expect(result).toEqual([])
  })

  it('throws error on wildcard use', async () => {
    const filepath = '/path/to/base/*.src'
    await expect(parse.parseSrc(filepath)).rejects.toThrow('Wildcards are not supported')
  })
})

describe('parseD', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    fsExistsSyncMock = jest.spyOn(fs, 'existsSync')
    fsReadFileSyncMock = jest.spyOn(fs, 'readFileSync')
  })

  it('returns empty symbol table for invalid extension', async () => {
    const filepath = '/path/to/workspace/file.ext'
    fsExistsSyncMock.mockReturnValue(true)
    const result = await parse.parseD(filepath)
    expect(fsExistsSyncMock).not.toHaveBeenCalled()
    expect(fsReadFileSyncMock).not.toHaveBeenCalled()
    expect(result).toEqual([])
  })

  it('returns empty symbol table non-existing file', async () => {
    const filepath = '/path/to/base/file.d'
    fsExistsSyncMock.mockReturnValue(false)
    const result = await parse.parseD(filepath)
    expect(fsExistsSyncMock).toHaveBeenCalledTimes(1)
    expect(fsReadFileSyncMock).not.toHaveBeenCalled()
    expect(result).toEqual([])
  })

  it('throws error on wildcard use', async () => {
    const filepath = '/path/to/base/*.d'
    await expect(parse.parseD(filepath)).rejects.toThrow('Wildcards are not supported')
  })

  it('returns empty symbol table for empty file', async () => {
    jest.replaceProperty(process, 'env', { GITHUB_WORKSPACE: undefined })
    const filepath = '/path/to/base/file.d'
    fsExistsSyncMock.mockReturnValue(true)
    fsReadFileSyncMock.mockReturnValue('')
    const result = await parse.parseD(filepath)
    expect(fsExistsSyncMock).toHaveBeenCalledTimes(1)
    expect(fsReadFileSyncMock).toHaveBeenCalledTimes(1)
    expect(result).toEqual([])
  })

  it('parses complete grammar', async () => {
    jest.replaceProperty(process, 'env', { GITHUB_WORKSPACE: '/path/to/workspace' })
    const filepath = 'file.d'
    const content = `// Some example code covering all relevant grammar rules

const int Symbol1 = 0;
const int Symbol2[2] = {0, 0};
var int Symbol3;
var int Symbol4[2];
class Symbol5 {};
prototype Symbol6(Symbol5) {};
instance Symbol7(Symbol5) {};
instance Symbol8(Symbol5);
func void Symbol9() {};
`
    fsExistsSyncMock.mockReturnValue(true)
    fsReadFileSyncMock.mockReturnValue(content)
    const result = await parse.parseD(filepath)
    expect(fsExistsSyncMock).toHaveBeenCalledWith(filepath)
    expect(result).toEqual([
      { name: 'Symbol1', file: 'file.d', line: 3 },
      { name: 'Symbol2', file: 'file.d', line: 4 },
      { name: 'Symbol3', file: 'file.d', line: 5 },
      { name: 'Symbol4', file: 'file.d', line: 6 },
      { name: 'Symbol5', file: 'file.d', line: 7 },
      { name: 'Symbol6', file: 'file.d', line: 8 },
      { name: 'Symbol7', file: 'file.d', line: 9 },
      { name: 'Symbol8', file: 'file.d', line: 10 },
      { name: 'Symbol9', file: 'file.d', line: 11 },
    ])
  })
})
