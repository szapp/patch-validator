import { CharStream, CommonTokenStream } from 'antlr4ng'
import { DaedalusLexer } from './generated/DaedalusLexer.js'
import { DaedalusParser } from './generated/DaedalusParser.js'
import { SymbolVisitor, SymbolTable } from './class.js'
import { normalizePath } from './utils.js'
import externals from './externals.js'
import symbols from './symbols.js'
import * as io from '@actions/io'
import * as tc from '@actions/tool-cache'
import * as glob from '@actions/glob'
import fs from 'fs'
import path, { posix } from 'path'

const wildcards: RegExp = /\*|\?/

/**
 * Parse source files and generate symbol tables.
 */
export class Parser {
  public readonly patchName: string
  public readonly filepath: string
  public readonly exists: boolean
  public readonly filename: string
  public readonly type: string
  public readonly version: number
  public readonly workingDir: string
  public readonly symbolTable: SymbolTable
  public readonly referenceTable: SymbolTable
  public namingViolations: SymbolTable
  public referenceViolations: SymbolTable
  public overwriteViolations: SymbolTable
  public readonly filelist: string[]
  public duration: number
  public numSymbols: number

  /**
   * Represents a Parser object.
   * @constructor
   * @param {string} patchName - The name of the patch.
   * @param {string} filepath - The file path.
   * @param {string} [workingDir=''] - The working directory.
   */
  constructor(patchName: string, filepath: string, workingDir: string = '') {
    this.patchName = patchName.toUpperCase()
    this.filepath = normalizePath(filepath)
    this.workingDir = normalizePath(workingDir)
    this.exists = fs.existsSync(this.filepath)
    this.filename = posix.basename(this.filepath)
    const baseName = posix.basename(this.filepath, posix.extname(this.filepath)).toUpperCase()
    this.type = baseName.replace(/(?:_G\d+)?$/, '')
    this.version = parseInt(baseName.match(/_G(\d+)/)?.[1] ?? '-1')
    this.symbolTable = []
    this.referenceTable = []
    this.namingViolations = []
    this.referenceViolations = []
    this.overwriteViolations = []
    this.filelist = []
    this.duration = 0
    this.numSymbols = 0
  }

  /**
   * Creates an array of Parser instances based on the provided base path and working directory.
   *
   * @param patchName - The name of the patch.
   * @param basePath - The base path for the Parser instances.
   * @param workingDir - The working directory for the Parser instances.
   * @returns An array of Parser instances.
   */
  public static async from(patchName: string, basePath: string, workingDir: string): Promise<Parser[]> {
    const candidateNames = ['Content', 'Menu', 'PFX', 'SFX', 'VFX', 'Music', 'Camera', 'Fight']
    const suffixes = ['_G1', '_G112', '_G130', '_G2']
    const candidates = candidateNames
      .map((name) => {
        const suffix = name !== 'Content' ? suffixes.concat(['']) : suffixes
        return suffix.map((s) => posix.join(basePath, name + s + '.src'))
      })
      .flat()
    const parsers = candidates.map((candidate) => new Parser(patchName, candidate, workingDir)).filter((parser) => parser.exists)
    await Promise.all(parsers.map((parser) => parser.parse()))
    return parsers
  }

  /**
   * Strips the path from a given file path and returns the full path and relative path.
   *
   * @param filepath - The file path to strip.
   * @returns An object containing the full path and relative path.
   */
  private stripPath(filepath: string): { fullPath: string; relPath: string } {
    const fullPath = normalizePath(filepath)
    const relPath = fullPath.replace(this.workingDir, '').replace(/^\//, '')
    return { fullPath, relPath }
  }

  /**
   * Parses the file and fills the symbol table with basic symbols based on the parser type.
   */
  public async parse(): Promise<void> {
    const startTime = performance.now()

    // Fill the symbol table with the externals
    this.parseExternals()

    // Fill symbol table with basic symbols based on the parser
    this.parseRequired()

    // Parse the files
    await this.parseSrc(this.filepath, true)

    // Record statistics
    this.duration = performance.now() - startTime
    this.numSymbols = this.symbolTable.filter((s) => s.file !== '').length
  }

  /**
   * Parses the basic symbols for content and menu parsers.
   */
  protected parseRequired(): void {
    let basicSymbols: string[] = []

    // Add minimal symbols for all parser types
    const requiredSymbols = symbols?.[`G${this.version}`]?.[this.type]
    if (requiredSymbols) basicSymbols = requiredSymbols

    // Add Ninja helper symbols (to all parser types)
    basicSymbols = basicSymbols.concat([
      'NINJA_VERSION',
      'NINJA_PATCHES',
      'NINJA_MODNAME',
      `NINJA_ID_${this.patchName}`,
      'NINJA_SYMBOLS_START',
      `NINJA_SYMBOLS_START_${this.patchName}`,
    ])

    // Add symbols to the symbol table(helperSymbols)
    if (basicSymbols.length > 0) {
      basicSymbols.forEach((symbol) => {
        this.symbolTable.push({ name: symbol.toUpperCase(), file: '', line: 0 })
      })
    }
  }

  /**
   * Parses the externals for the current instance.
   */
  protected parseExternals(): void {
    const extern = externals?.[`G${this.version}`]?.[this.type]
    if (extern) {
      extern.forEach((symbol) => {
        this.symbolTable.push({ name: symbol.toUpperCase(), file: '', line: 0 })
      })
    }
  }

  /**
   * Parses a special line in a SRC file.
   * Only parses if the type is 'CONTENT'.
   *
   * @param pattern - The pattern to handle.
   */
  protected async parseSpecial(pattern: string): Promise<void> {
    if (this.type !== 'CONTENT') return

    let symbols: string[] = []
    let repoUrl: string = ''
    let srcPath: string = ''
    const tmpPath = posix.join(process.env['RUNNER_TEMP'] ?? '', '.patch-validator-special')

    switch (pattern.toLowerCase()) {
      case 'ikarus':
        // Download Ikarus from the official repository (caution: not the compatibility version)
        repoUrl = 'https://github.com/Lehona/Ikarus/archive/refs/heads/gameversions.tar.gz'
        srcPath = posix.join(tmpPath, 'Ikarus-gameversions', `Ikarus_G${this.version}.src`)

        // Provisionally add Ninja-specific compatibility symbols
        symbols = [
          'DAM_INDEX_MAX',
          'PROT_INDEX_MAX',
          'ITM_TEXT_MAX',
          'ATR_HITPOINTS',
          'ATR_HITPOINTS_MAX',
          'ATR_MANA',
          'ATR_MANA_MAX',
          'PERC_ASSESSDAMAGE',
          'ITEM_KAT_NF',
          'ITEM_KAT_FF',
          'TRUE',
          'FALSE',
          'LOOP_CONTINUE',
          'LOOP_END',
          'ATT_FRIENDLY',
          'ATT_NEUTRAL',
          'ATT_ANGRY',
          'ATT_HOSTILE',
        ]
        break
      case 'lego':
        // Download LeGo from the official repository (caution: not the compatibility version)
        repoUrl = 'https://github.com/Lehona/LeGo/archive/refs/heads/gameversions.tar.gz'
        srcPath = posix.join(tmpPath, 'LeGo-gameversions', `Header_G${this.version}.src`)

        // Provisionally add Ninja-specific compatibility symbols
        symbols = ['LEGO_MERGEFLAGS', 'FOREACHPATCHHNDL']
        break
      default:
        return
    }

    // Download the repository
    if (!fs.existsSync(srcPath)) {
      const archivePath = await tc.downloadTool(repoUrl)
      await io.mkdirP(tmpPath)
      await tc.extractTar(archivePath, tmpPath)
      await io.rmRF(archivePath)
    }

    // Parse the files
    await this.parseSrc(srcPath, false, true)

    // Completement the symbol table
    if (symbols.length > 0) {
      symbols.forEach((symbol) => {
        this.symbolTable.push({ name: symbol.toUpperCase(), file: '', line: 0 })
      })
    }
  }

  /**
   * Parses the source file specified by the filepath.
   *
   * @param filepath - The path of the source file to parse.
   * @param root - Indicates whether the source file is the root file.
   * @param exclude - Indicates whether the source file is not part of the patch.
   * @throws An error if wildcards are used in the filepath.
   */
  protected async parseSrc(filepath: string, root: boolean = false, exclude: boolean = false): Promise<void> {
    let { fullPath } = this.stripPath(filepath)

    // Check if file exists and correct case
    try {
      fullPath = normalizePath(fs.realpathSync.native(fullPath))
    } catch {
      return
    }

    const srcRootPath = posix.dirname(fullPath)
    const input = fs.readFileSync(fullPath, 'ascii')
    let lines = input.split(/\r?\n/).filter((line) => line.trim() !== '')

    // Iterate over the lines in the file
    while (lines.length > 0) {
      const line = lines.shift()!.trim()
      const subfile = normalizePath(line)
      const fullPath = posix.join(srcRootPath, subfile)

      if (wildcards.test(line)) {
        if (!exclude) throw new Error('Wildcards are not supported')
        const nativeSrcRootPath = path.resolve(srcRootPath) + path.sep
        const resolved = await glob.create(fullPath).then((g) => g.glob().then((f) => f.map((h) => h.replace(nativeSrcRootPath, ''))))
        lines = resolved.concat(lines)
        continue
      }

      const ext = posix.extname(subfile).toLowerCase()
      switch (ext) {
        case '.d':
          this.parseD(fullPath, exclude)
          break
        case '.src':
          await this.parseSrc(fullPath, false, exclude)
          break
        default:
          if (root) await this.parseSpecial(line.toLowerCase())
      }
    }
  }

  /**
   * Parses the specified file and collects symbol tables.
   *
   * @param filepath - The path of the file to parse.
   * @param exclude - Indicates whether the file is not part of the patch.
   */
  protected parseD(filepath: string, exclude: boolean = false): void {
    const { fullPath: _fullPath, relPath } = this.stripPath(filepath)

    // Check if file exists and correct case
    let fullPath: string
    try {
      fullPath = normalizePath(fs.realpathSync.native(_fullPath))
    } catch {
      return
    }

    if (this.filelist.includes(relPath)) return
    this.filelist.push(relPath)

    const input = fs.readFileSync(fullPath, 'ascii')
    this.parseStr(input, exclude ? '' : relPath)
  }

  /**
   * Parses a string input and collects symbol tables.
   *
   * @param input - The string input to parse.
   * @param filename - The name of the file being parsed (blank for non-patch parsing).
   */
  protected parseStr(input: string, filename: string = ''): void {
    const inputStream = CharStream.fromString(input)
    const lexer = new DaedalusLexer(inputStream)
    const tokenStream = new CommonTokenStream(lexer)
    const parser = new DaedalusParser(tokenStream)
    const tree = parser.daedalusFile()

    // Collect symbol tables
    const visitor = new SymbolVisitor(filename, this.symbolTable, filename ? this.referenceTable : undefined)
    visitor.visit(tree)
  }

  /**
   * Clears the temporary directory.
   */
  public static async clearTmpDir(): Promise<void> {
    // istanbul ignore next
    const tmpPath = posix.join(process.env['RUNNER_TEMP'] ?? '', '.patch-validator-special')
    await io.rmRF(tmpPath)
  }

  /**
   * Validates the names of symbols in the symbol table.
   *
   * @param prefix - An array of prefixes to check for in the symbol names.
   * @param ignore - An array of symbol names to ignore during validation.
   */
  public validateNames(prefix: string[], ignore: string[]): void {
    this.namingViolations = this.symbolTable.filter((symbol) => {
      const fromPatch = symbol.file !== ''
      const isGlobal = symbol.name.indexOf('.') === -1
      const hasPrefix = prefix.some((p) => symbol.name.includes(p))
      const isIgnored = ignore.includes(symbol.name)
      return fromPatch && isGlobal && !hasPrefix && !isIgnored
    })
  }

  /**
   * Validates the references in the reference table against the symbol table.
   * This function also corrects the unscoped names in the reference table.
   */
  public validateReferences(): void {
    this.referenceViolations.length = 0
    this.referenceTable.forEach((symbol, idx) => {
      // Skip base symbols
      if (symbol.file === '') return

      // Check if the symbol is defined
      let isDefined = this.symbolTable.some((s) => s.name === symbol.name)

      // Check if symbol is defined without scope
      const scope = symbol.name.indexOf('.')
      if (!isDefined && scope !== -1) {
        const unscopedName = symbol.name.substring(scope + 1)
        isDefined = this.symbolTable.some((s) => s.name === unscopedName)
        this.referenceTable[idx].name = unscopedName // Fix name
      }

      // Add violation
      if (!isDefined) this.referenceViolations.push(symbol)
    })
  }

  /**
   * Validates the symbol tables for illegal overwrites.
   */
  public validateOverwrites(): void {
    if (this.type !== 'CONTENT') return
    // See: https://ninja.szapp.de/s/src/data/symbols.asm
    const illegal = [
      'INIT_GLOBAL',
      'INITPERCEPTIONS',
      'REPEAT',
      'WHILE',
      'MEM_LABEL',
      'MEM_GOTO',
      'ALLOWSAVING',
      'ONALLOWSAVING',
      'ONDISALLOWSAVING',
      'FOCUSNAMES_COLOR_FRIENDLY',
      'FOCUSNAMES_COLOR_NEUTRAL',
      'FOCUSNAMES_COLOR_ANGRY',
      'FOCUSNAMES_COLOR_HOSTILE',
      '_FOCUSNAMES',
      'BW_SAVEGAME',
      'BR_SAVEGAME',
      'CURSOR_TEXTURE',
      'PF_FONT',
      'PRINT_LINESEPERATOR',
      'DIAG_PREFIX',
      'DIAG_SUFFIX',
      'BLOODSPLAT_NUM',
      'BLOODSPLAT_TEX',
      'BLOODSPLAT_DAM',
      'BUFFS_DISPLAYFORHERO',
      'BUFF_FADEOUT',
      'PF_PRINTX',
      'PF_PRINTY',
      'PF_TEXTHEIGHT',
      'PF_FADEINTIME',
      'PF_FADEOUTTIME',
      'PF_MOVEYTIME',
      'PF_WAITTIME',
      'AIV_TALENT_INDEX',
      'AIV_TALENT',
      'NINJA_SYMBOLS_START',
      'NINJA_SYMBOLS_END',
      'NINJA_VERSION',
      'NINJA_PATCHES',
      'NINJA_MODNAME',
      `NINJA_SYMBOLS_START_${this.patchName}`,
      `NINJA_SYMBOLS_END_${this.patchName}`,
    ]
    this.overwriteViolations = this.symbolTable.filter((symbol) => {
      const fromPatch = symbol.file !== ''
      const isIllegal = illegal.some((p) => symbol.name === p)
      return fromPatch && isIllegal
    })
  }
}
