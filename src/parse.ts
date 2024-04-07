import * as core from '@actions/core'
import { CharStream, CommonTokenStream } from 'antlr4ng'
import { DaedalusLexer } from './generated/DaedalusLexer.js'
import { DaedalusParser } from './generated/DaedalusParser.js'
import { UnscopedVisitor, SymbolTable } from './class.js'
import fs from 'fs'
import path from 'path'

const lineD: RegExp = /^.*\.d(?=\n)/gim
const lineSrc: RegExp = /^.*\.src(?=\n)/gim
const wildcards: RegExp = /\*|\?/g

export async function parseCandidates(basePath: string): Promise<SymbolTable> {
  const candidateNames = ['Content', 'Menu', 'PFX', 'SFX', 'VFX', 'Music', 'Camera', 'Fight']
  const suffixes = ['_G1', '_G112', '_G130', '_G2']
  const candidates = candidateNames
    .map((name) => {
      const suffix = name !== 'Content' ? suffixes.concat(['']) : suffixes
      return suffix.map((s) => path.join(basePath, name + s + '.src'))
    })
    .flat()
  return parse(candidates)
}

export async function parse(filepath: string | string[]): Promise<SymbolTable> {
  const filepaths = Array.isArray(filepath) ? filepath : [filepath]
  const symbolTables = await Promise.all(filepaths.map(parseSrc))
  const symbolTable = symbolTables.flat()

  // Sort by file and line
  const symbols = symbolTable.sort((a, b) => {
    if (a.file < b.file) return -1
    if (a.file > b.file) return 1
    if (a.line < b.line) return -1
    if (a.line > b.line) return 1
    return 0
  })

  // Remove duplicates
  for (let i = 0; i < symbols.length - 1; i++) {
    if (JSON.stringify(symbols[i]) === JSON.stringify(symbols[i + 1])) {
      symbols.splice(i, 1)
      i--
    }
  }

  return symbols
}

export async function parseSrc(filepath: string): Promise<SymbolTable> {
  filepath = core.toPosixPath(filepath)
  if (wildcards.test(filepath)) throw new Error('Wildcards are not supported')
  if (path.extname(filepath) !== '.src' || !fs.existsSync(filepath)) return []
  const input = fs.readFileSync(filepath, 'ascii')
  const relPath = path.dirname(filepath)
  const d = input.match(lineD)
  const src = input.match(lineSrc)
  const dList = d ? d.map((file) => parseD(path.join(relPath, file))) : []
  const srcList = src ? src.map((file) => parseSrc(path.join(relPath, file))) : []
  const symbolLists = await Promise.all([...dList, ...srcList])
  return symbolLists.flat()
}

export async function parseD(filepath: string): Promise<SymbolTable> {
  filepath = core.toPosixPath(filepath)
  if (wildcards.test(filepath)) throw new Error('Wildcards are not supported')
  if (path.extname(filepath) !== '.d' || !fs.existsSync(filepath)) return []
  const input = fs.readFileSync(filepath, 'ascii')
  const wd = core.toPosixPath(process.env['GITHUB_WORKSPACE'] ?? '')
  const file = filepath.replace(wd, '').replace(/^\//, '')
  const inputStream = CharStream.fromString(input)
  const lexer = new DaedalusLexer(inputStream)
  const tokenStream = new CommonTokenStream(lexer)
  const parser = new DaedalusParser(tokenStream)
  const tree = parser.daedalusFile()
  const visitor = new UnscopedVisitor()
  const symbolTable = visitor.visit(tree)?.map((s) => ({ ...s, file }))
  // istanbul ignore next
  return symbolTable ?? []
}
