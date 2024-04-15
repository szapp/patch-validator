import { CharStream, CommonTokenStream } from 'antlr4ng'
import { DaedalusLexer } from './generated/DaedalusLexer.js'
import { DaedalusParser } from './generated/DaedalusParser.js'
import { SymbolVisitor, SymbolTable } from './class.js'
import { normalizePath } from './utils.js'
import externals from './externals.js'
import fs from 'fs'
import { posix } from 'path'

const wildcards: RegExp = /\*|\?/g

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
  public parse(): void {
    // Fill the symbol table with the externals
    this.parseExternals()

    // Fill symbol table with basic symbols based on the parser
    this.parseRequired()

    // Parse the files
    this.parseSrc(this.filepath, true)
  }

  /**
   * Parses the basic symbols for content and menu parsers.
   */
  protected parseRequired(): void {
    let symbols: string[] = []
    switch (this.type) {
      case 'CONTENT':
        // Add content externs (per game version)
        // TODO: switch (this.version) ...
        symbols = []
        break
      case 'MENU':
        // Add menu externals
        symbols = []
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
  protected parseSpecial(pattern: string): void {
    if (this.type !== 'CONTENT') return
    switch (pattern.toLowerCase()) {
      case 'lego':
        // TODO: Parse LeGo
        // this.parseD(..., true)
        break
      case 'ikarus':
      // TODO: Parse Ikarus
      // this.parseD(..., true)
    }
  }

  /**
   * Parses the source file specified by the filepath.
   *
   * @param filepath - The path of the source file to parse.
   * @param root - Indicates whether the source file is the root file.
   * @throws An error if wildcards are used in the filepath.
   */
  protected parseSrc(filepath: string, root: boolean = false): void {
    const { fullPath } = this.stripPath(filepath)

    if (wildcards.test(filepath)) throw new Error('Wildcards are not supported')
    if (posix.extname(fullPath) !== '.src' || !fs.existsSync(fullPath)) return

    const input = fs.readFileSync(fullPath, 'ascii')
    const srcRootPath = posix.dirname(fullPath)
    const lines = input.split(/\r?\n/).filter((line) => line.trim() !== '')
    for (const line of lines) {
      const lineF = line.trim().toLowerCase()
      const subfile = normalizePath(lineF)
      const fullPath = posix.join(srcRootPath, subfile)
      const ext = posix.extname(subfile)
      switch (ext) {
        case '.d':
          this.parseD(fullPath)
          break
        case '.src':
          this.parseSrc(fullPath)
          break
        default:
          if (root) this.parseSpecial(lineF)
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

    if (wildcards.test(filepath)) throw new Error('Wildcards are not supported')
    if (posix.extname(fullPath) !== '.d' || !fs.existsSync(fullPath)) return

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
    this.referenceTable.push(...references)
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
      const isDefined = this.symbolTable.some((s) => s.name === symbol.name)
      return !isDefined
    })
  }
}
