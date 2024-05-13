import { Token } from 'antlr4ng'
import {
  ClassDefContext,
  PrototypeDefContext,
  InstanceDefContext,
  FunctionDefContext,
  ConstValueDefContext,
  ConstArrayDefContext,
  VarValueDeclContext,
  VarArrayDeclContext,
  InstanceDeclContext,
  ParameterDeclContext,
  ParentReferenceContext,
  ReferenceContext,
  FuncCallContext,
  VarDeclContext,
} from './generated/DaedalusParser.js'
import { DaedalusVisitor } from './generated/DaedalusVisitor.js'

export type Symb = {
  name: string
  file: string
  line: number
}
export type SymbolTable = Symb[]

export type Tables = { symbols: SymbolTable; references: SymbolTable }

export class SymbolVisitor extends DaedalusVisitor<Tables> {
  constructor(
    protected readonly file: string,
    protected readonly symbolTable: SymbolTable,
    protected readonly referenceTable: SymbolTable = [],
    protected scope: string = '',
    protected type: string = ''
  ) {
    super()
  }

  protected withScope<T>(action: () => T, scope: string): T {
    const outerScope = this.scope
    this.scope = scope.toUpperCase()
    try {
      return action()
    } finally {
      this.scope = outerScope
    }
  }

  protected withType<T>(action: () => T, type: string): T {
    const outerType = this.type
    this.type = type.toUpperCase()
    try {
      return action()
    } finally {
      this.type = outerType
    }
  }

  private getScope(): string {
    const scope = this.scope ? this.scope + '.' : ''
    return scope
  }

  private passTables(): Tables {
    return { symbols: this.symbolTable, references: this.referenceTable }
  }

  private addSymbol = (symbol: Token): void => {
    const name = (this.getScope() + symbol.text).toUpperCase()
    this.symbolTable.push({ name, file: this.file, line: symbol.line })
  }

  protected defaultResult(): Tables {
    return this.passTables()
  }

  public visitReference = (ctx: ReferenceContext): Tables => {
    let name = ctx
      .referenceAtom()
      .map((atom) => atom.nameNode().anyIdentifier().Identifier()?.getSymbol()?.text)
      .filter((n) => n !== undefined)
      .join('.')
      .toUpperCase()
    if (name) {
      name = this.getScope() + name
      // istanbul ignore next: Unnecessary to test empty line
      const line = ctx.start?.line ?? 0
      this.referenceTable.push({ name, file: this.file, line })
    }
    return this.visitChildren(ctx) as Tables
  }

  public visitFuncCall = (ctx: FuncCallContext): Tables => {
    const name = ctx.nameNode().anyIdentifier().Identifier()?.getSymbol()?.text?.toUpperCase()
    if (name) {
      // istanbul ignore next: Unnecessary to test empty line
      const line = ctx.start?.line ?? 0
      this.referenceTable.push({ name, file: this.file, line })
    }
    return this.visitChildren(ctx) as Tables
  }

  // Fill protottypes and instances with class symbols (extends SymbolTable)
  public visitParentReference = (ctx: ParentReferenceContext): Tables => {
    const symbol = ctx.Identifier().getSymbol()
    const refName = symbol.text?.toUpperCase()
    if (refName) {
      this.referenceTable.push({ name: refName, file: this.file, line: symbol.line })
      this.symbolTable
        .filter((s) => s.name.startsWith(refName + '.'))
        .forEach((s) => {
          this.addSymbol({ text: s.name.substring(refName.length + 1), line: symbol.line } as Token)
        })
    }
    return this.visitChildren(ctx) as Tables
  }

  private visitDecl = (
    ctx: ConstValueDefContext | ConstArrayDefContext | VarValueDeclContext | VarArrayDeclContext | ParameterDeclContext
  ): Tables => {
    const identifier = ctx.nameNode().anyIdentifier().Identifier()
    if (identifier) {
      const symbol = identifier.getSymbol()
      const symbolName = symbol.text?.toUpperCase()
      if (symbolName) {
        this.addSymbol(symbol)
        if (this.type) {
          this.symbolTable
            .filter((s) => s.name.startsWith(this.type + '.'))
            .forEach((s) => {
              const subName = s.name.substring(this.type.length + 1)
              this.addSymbol({ text: `${symbolName}.${subName}`, line: symbol.line } as Token)
            })
        }
      }
    }
    return this.visitChildren(ctx) as Tables
  }

  private visitDef = (
    ctx: ClassDefContext | PrototypeDefContext | InstanceDefContext | FunctionDefContext | InstanceDeclContext
  ): Tables => {
    const nodes = [ctx.nameNode()].flat()
    nodes.forEach((node) => {
      const identifier = node.anyIdentifier().Identifier()
      if (identifier) {
        const symbol = identifier.getSymbol()
        if (symbol.text) {
          this.addSymbol(symbol)
          return this.withScope(() => this.visitChildren(ctx), symbol.text) as Tables
        }
      }
      // istanbul ignore next: Unlikely to reach this line
      return this.visitChildren(ctx) as Tables
    })
    return this.passTables()
  }

  public visitClassDef = (ctx: ClassDefContext): Tables => {
    return this.visitDef(ctx)
  }

  public visitPrototypeDef = (ctx: PrototypeDefContext): Tables => {
    return this.visitDef(ctx)
  }
  public visitInstanceDef = (ctx: InstanceDefContext): Tables => {
    return this.visitDef(ctx)
  }

  public visitFunctionDef = (ctx: FunctionDefContext): Tables => {
    return this.visitDef(ctx)
  }

  public visitInstanceDecl = (ctx: InstanceDeclContext): Tables => {
    return this.visitDef(ctx)
  }

  public visitConstValueDef = (ctx: ConstValueDefContext): Tables => {
    return this.visitDecl(ctx)
  }

  public visitConstArrayDef = (ctx: ConstArrayDefContext): Tables => {
    return this.visitDecl(ctx)
  }

  public visitVarValueDecl = (ctx: VarValueDeclContext): Tables => {
    return this.visitDecl(ctx)
  }

  public visitVarArrayDecl = (ctx: VarArrayDeclContext): Tables => {
    return this.visitDecl(ctx)
  }

  public visitParameterDecl = (ctx: ParameterDeclContext): Tables => {
    const identifier = ctx.typeReference().Identifier()
    if (identifier) {
      const symbol = identifier.getSymbol()
      const refName = symbol.text?.toUpperCase()
      if (refName) return this.withType(() => this.visitDecl(ctx), refName) as Tables
    }
    return this.visitDecl(ctx)
  }

  public visitVarDecl = (ctx: VarDeclContext): Tables => {
    const identifier = ctx.typeReference().Identifier()
    if (identifier) {
      const symbol = identifier.getSymbol()
      const refName = symbol.text?.toUpperCase()
      if (refName) return this.withType(() => this.visitChildren(ctx), refName) as Tables
    }
    return this.visitChildren(ctx) as Tables
  }
}
