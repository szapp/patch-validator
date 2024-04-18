import { CharStream, CommonTokenStream } from 'antlr4ng'
import { DaedalusLexer } from './generated/DaedalusLexer.js'
import { DaedalusParser } from './generated/DaedalusParser.js'
import { SymbolVisitor, SymbolTable } from './class.js'
import { normalizePath } from './utils.js'
import externals from './externals.js'
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
  public readonly packageDir: string
  public readonly symbolTable: SymbolTable
  public readonly referenceTable: SymbolTable
  public namingViolations: SymbolTable
  public referenceViolations: SymbolTable
  public overwriteViolations: SymbolTable
  public readonly filelist: string[]

  /**
   * Represents a Parser object.
   * @constructor
   * @param {string} filepath - The file path.
   * @param {string} [workingDir=''] - The working directory.
   */
  constructor(patchName: string, filepath: string, workingDir: string = '', packageDir: string = '') {
    this.patchName = patchName.toUpperCase()
    this.filepath = normalizePath(filepath)
    this.workingDir = normalizePath(workingDir)
    this.packageDir = normalizePath(packageDir)
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
  }

  /**
   * Creates an array of Parser instances based on the provided base path and working directory.
   *
   * @param basePath - The base path for the Parser instances.
   * @param workingDir - The working directory for the Parser instances.
   * @returns An array of Parser instances.
   */
  public static from(patchName: string, basePath: string, workingDir: string): Parser[] {
    const candidateNames = ['Content', 'Menu', 'PFX', 'SFX', 'VFX', 'Music', 'Camera', 'Fight']
    const suffixes = ['_G1', '_G112', '_G130', '_G2']
    const candidates = candidateNames
      .map((name) => {
        const suffix = name !== 'Content' ? suffixes.concat(['']) : suffixes
        return suffix.map((s) => posix.join(basePath, name + s + '.src'))
      })
      .flat()
    const parsers = candidates.map((candidate) => new Parser(patchName, candidate, workingDir)).filter((parser) => parser.exists)
    parsers.forEach((parser) => parser.parse())
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
    // Fill the symbol table with the externals
    this.parseExternals()

    // Fill symbol table with basic symbols based on the parser
    this.parseRequired()

    // Parse the files
    await this.parseSrc(this.filepath, true)
  }

  /**
   * Parses the basic symbols for content and menu parsers.
   */
  protected parseRequired(): void {
    let symbols: string[] = []
    switch (this.type) {
      case 'CONTENT':
        symbols = ['C_NPC', 'C_ITEM', 'SELF', 'OTHER', 'VICTIM', 'ITEM', 'HERO']
        switch (this.version) {
          case 130:
          case 2:
            symbols.push('INIT_GLOBAL')
          // eslint-disable-next-line no-fallthrough
          case 1:
            symbols.push('STARTUP_GLOBAL')
        }
        break
      case 'MENU':
        symbols = ['MENU_MAIN']
        break
      case 'CAMERA':
        symbols = ['CAMMODNORMAL']
        break
    }

    // Add Ninja helper symbols (to all parser types)
    symbols = symbols.concat([
      'NINJA_SYMBOLS_START',
      `NINJA_SYMBOLS_START_${this.patchName}`,
      'NINJA_VERSION',
      'NINJA_PATCHES',
      `NINJA_ID_${this.patchName}`,
      'NINJA_MODNAME',
    ])

    // Add symbols to the symbol table
    if (symbols.length > 0) {
      symbols.forEach((symbol) => {
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
    const tmpPath = '.patch-validator-special'

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

    // Download the repository and parse its files
    const archivePath = await tc.downloadTool(repoUrl)
    await io.mkdirP(tmpPath)
    await tc.extractTar(archivePath, tmpPath)
    await io.rmRF(archivePath)
    await this.parseSrc(srcPath, false, true)
    await io.rmRF(tmpPath)

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
    const { fullPath } = this.stripPath(filepath)
    if (!fs.existsSync(fullPath)) return

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
   * @param filepath - The path of the file to parse.
   * @throws Error if wildcards are used in the filepath.
   */
  protected parseD(filepath: string, exclude: boolean = false): void {
    const { fullPath, relPath } = this.stripPath(filepath)
    if (!fs.existsSync(fullPath)) return

    if (this.filelist.includes(relPath)) return
    this.filelist.push(relPath)

    // Parse file
    const input = fs.readFileSync(fullPath, 'ascii')
    const inputStream = CharStream.fromString(input)
    const lexer = new DaedalusLexer(inputStream)
    const tokenStream = new CommonTokenStream(lexer)
    const parser = new DaedalusParser(tokenStream)
    const tree = parser.daedalusFile()

    // Collect symbol tables
    const visitor = new SymbolVisitor(exclude ? '' : relPath)
    const { symbols, references } = visitor.visit(tree) as { symbols: SymbolTable; references: SymbolTable }
    this.symbolTable.push(...symbols)
    if (!exclude) this.referenceTable.push(...references)
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
   */
  public validateReferences(): void {
    this.referenceViolations = this.referenceTable.filter((symbol) => {
      const fromPatch = symbol.file !== ''
      const isDefined = this.symbolTable.some((s) => s.name === symbol.name)
      return fromPatch && !isDefined
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
