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
} from './generated/DaedalusParser.js'
import { DaedalusVisitor } from './generated/DaedalusVisitor.js'

export type Symb = {
  name: string
  file: string
  line: number
}
export type SymbolTable = Symb[]

export class UnscopedVisitor extends DaedalusVisitor<SymbolTable> {
  constructor(protected readonly symbolTable: SymbolTable = []) {
    super()
  }

  protected defaultResult(): SymbolTable {
    return this.symbolTable
  }

  private visitDef = (
    ctx:
      | ClassDefContext
      | PrototypeDefContext
      | InstanceDefContext
      | FunctionDefContext
      | ConstValueDefContext
      | ConstArrayDefContext
      | VarValueDeclContext
      | VarArrayDeclContext
  ): SymbolTable => {
    const identifier = ctx.nameNode().Identifier()
    if (identifier) {
      const symbol = identifier.getSymbol()
      if (symbol.text) this.symbolTable.push({ name: symbol.text, file: '', line: symbol.line })
    }
    return this.symbolTable
  }

  public visitClassDef = (ctx: ClassDefContext): SymbolTable => {
    return this.visitDef(ctx)
  }

  public visitPrototypeDef = (ctx: PrototypeDefContext): SymbolTable => {
    return this.visitDef(ctx)
  }
  public visitInstanceDef = (ctx: InstanceDefContext): SymbolTable => {
    return this.visitDef(ctx)
  }

  public visitFunctionDef = (ctx: FunctionDefContext): SymbolTable => {
    return this.visitDef(ctx)
  }

  public visitConstValueDef = (ctx: ConstValueDefContext): SymbolTable => {
    return this.visitDef(ctx)
  }

  public visitConstArrayDef = (ctx: ConstArrayDefContext): SymbolTable => {
    return this.visitDef(ctx)
  }

  public visitVarValueDecl = (ctx: VarValueDeclContext): SymbolTable => {
    return this.visitDef(ctx)
  }

  public visitVarArrayDecl = (ctx: VarArrayDeclContext): SymbolTable => {
    return this.visitDef(ctx)
  }

  public visitInstanceDecl = (ctx: InstanceDeclContext): SymbolTable => {
    ctx.nameNode().forEach((node) => {
      const identifier = node.Identifier()
      if (identifier) {
        const symbol = identifier.getSymbol()
        if (symbol.text) this.symbolTable.push({ name: symbol.text, file: '', line: symbol.line })
      }
    })
    return this.symbolTable
  }
}
