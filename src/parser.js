/**
 * Parser for a simple Mojo subset. Builds AST from token stream.
 */

const { tokenize } = require('./tokenizer.js');
const T = require('./ast-types.js');
const Tok = require('./token-types.js');
const { OP_FROM_TYPE } = require('./token-types.js');

class Parser {
  constructor(source) {
    this.tokens = tokenize(source);
    this.i = 0;
  }

  peek() {
    return this.tokens[this.i] ?? { type: Tok.EOF };
  }

  advance() {
    const t = this.tokens[this.i];
    if (this.i < this.tokens.length) this.i++;
    return t;
  }

  is(type, value) {
    const t = this.peek();
    if (value !== undefined) return t.type === type && t.value === value;
    return t.type === type;
  }

  expect(type, value) {
    const t = this.advance();
    if (t.type !== type || (value !== undefined && t.value !== value)) {
      throw new Error(`Expected ${type}${value ? ` ${value}` : ''}, got ${t.type} ${t.value}`);
    }
    return t;
  }

  skipNewlines() {
    while (this.is(Tok.NEWLINE)) this.advance();
  }

  /** Skip NEWLINE and DEDENT (e.g. after a statement where we want to skip past a block end). */
  skipNewlinesAndDedents() {
    while (this.is(Tok.NEWLINE) || this.is(Tok.DEDENT)) this.advance();
  }

  parseProgram() {
    const program = { type: T.Program, structs: [], functions: [], main: null };
    this.skipNewlines();
    while (this.i < this.tokens.length && this.peek().type !== Tok.EOF) {
      if (this.is(Tok.DEDENT)) {
        this.advance();
        continue;
      }
      if (this.is(Tok.ID, 'from') || this.is(Tok.DOCSTRING)) {
        this.skipImportOrDocstring();
        continue;
      }
      if (this.is(Tok.STRUCT)) {
        program.structs.push(this.parseStruct());
        continue;
      }
      if (this.is(Tok.FN) || this.is(Tok.DEF)) {
        const fn = this.parseFunction();
        if (fn.name === 'main') program.main = fn;
        else program.functions.push(fn);
        continue;
      }
      if (this.is(Tok.ID)) {
        const t = this.peek();
        throw new Error(`Expected 'struct', 'fn', or 'def' at line ${t.line || 1}, got '${t.value}'`);
      }
      this.advance();
    }
    return program;
  }

  skipImportOrDocstring() {
    if (this.is(Tok.DOCSTRING)) {
      this.advance();
      return;
    }
    if (this.is(Tok.ID, 'from')) {
      while (!this.is(Tok.NEWLINE)) this.advance();
      this.advance();
    }
  }

  parseStruct() {
    this.expect(Tok.STRUCT);
    const name = this.expect(Tok.ID).value;
    let traits = [];
    if (this.is(Tok.LPAREN)) {
      this.advance();
      const t = this.advance();
      traits.push(t.value);
      while (this.is(Tok.COMMA)) {
        this.advance();
        traits.push(this.advance().value);
      }
      this.expect(Tok.RPAREN);
    }
    this.expect(Tok.COLON);
    this.skipNewlines();
    if (this.is(Tok.INDENT)) this.advance();
    const struct = { type: T.Struct, name, traits, fields: [], methods: [] };
    while (!this.is(Tok.DEDENT) && !this.is(Tok.EOF)) {
      this.skipNewlines();
      if (this.is(Tok.STRUCT)) break;
      if (this.is(Tok.VAR)) {
        this.advance();
        this.skipNewlines();
        const fieldName = this.advance().value;
        let type = null;
        if (this.is(Tok.COLON)) {
          this.advance();
          type = this.parseType();
        } else if (this.is(Tok.ASSIGN)) {
          this.advance();
          this.parseExpression();
        }
        struct.fields.push({ name: fieldName, type });
        this.skipNewlines();
        continue;
      }
      if (this.is(Tok.FN)) {
        struct.methods.push(this.parseMethod());
        continue;
      }
      break;
    }
    if (this.is(Tok.DEDENT)) this.advance();
    return struct;
  }

  parseType() {
    if (this.is(Tok.LIST)) {
      this.advance();
      this.expect(Tok.LBRACK);
      const inner = this.parseType();
      this.expect(Tok.RBRACK);
      return { kind: T.List, inner };
    }
    if (this.is(Tok.INT) || this.is(Tok.BOOL) || this.is(Tok.ID) || this.is(Tok.SELF)) {
      const t = this.advance();
      return { kind: T.Id, name: t.value };
    }
    if (this.is(Tok.NONE)) {
      this.advance();
      return { kind: T.None };
    }
    throw new Error('Expected type');
  }

  parseMethod() {
    this.expect(Tok.FN);
    const name = this.expect(Tok.ID).value;
    this.expect(Tok.LPAREN);
    const params = [];
    while (!this.is(Tok.RPAREN)) {
      if (this.is(Tok.STAR)) {
        this.advance();
        if (this.is(Tok.COMMA)) this.advance();
        continue;
      }
      if (this.is(Tok.DEINIT)) {
        this.advance();
        const paramName = this.expect(Tok.ID).value;
        this.expect(Tok.COLON);
        params.push({ name: paramName, type: this.parseType() });
        if (!this.is(Tok.RPAREN)) this.expect(Tok.COMMA);
        continue;
      }
      if (this.is(Tok.OUT) || this.is(Tok.INOUT) || this.is(Tok.MUT)) {
        this.advance();
        this.skipNewlines();
        if (this.is(Tok.ID) && this.peek().value === 'self') {
          this.advance();
          if (this.is(Tok.COLON)) {
            this.advance();
            this.parseType();
          }
          params.push({ name: 'self', type: null });
          if (!this.is(Tok.RPAREN)) this.expect(Tok.COMMA);
          continue;
        }
      }
      this.skipNewlines();
      if (this.is(Tok.INDENT)) this.advance();
      if (!this.is(Tok.ID)) break;
      const paramName = this.advance().value;
      if (paramName === 'self') {
        if (this.is(Tok.COLON)) {
          this.advance();
          this.parseType();
        }
        params.push({ name: 'self', type: null });
        if (!this.is(Tok.RPAREN)) this.expect(Tok.COMMA);
        continue;
      }
      this.skipNewlines();
      if (this.is(Tok.INDENT)) this.advance();
      let type = null;
      if (this.is(Tok.COLON)) {
        this.advance();
        type = this.parseType();
      }
      params.push({ name: paramName, type });
      this.skipNewlines();
      if (!this.is(Tok.RPAREN)) this.expect(Tok.COMMA);
    }
    this.skipNewlines();
    if (this.is(Tok.DEDENT)) this.advance();
    this.expect(Tok.RPAREN);
    let returnType = null;
    if (this.is(Tok.RARROW)) {
      this.advance();
      returnType = this.parseType();
    }
    this.skipNewlines();
    if (this.is(Tok.INDENT)) this.advance();
    if (this.is(Tok.COLON)) this.advance();
    this.skipNewlines();
    let body;
    if (this.is(Tok.INDENT)) {
      this.advance();
      body = this.parseBlock();
      if (this.is(Tok.DEDENT)) this.advance();
    } else {
      body = this.parseBlock();
    }
    return { type: T.Method, name, params, returnType, body };
  }

  parseFunction() {
    const isDef = this.is(Tok.DEF);
    this.advance();
    const name = this.expect(Tok.ID).value;
    let typeParams = [];
    if (this.is(Tok.LBRACK)) {
      this.advance();
      this.skipNewlines();
      while (!this.is(Tok.RBRACK)) {
        const paramName = this.expect(Tok.ID).value;
        this.expect(Tok.COLON);
        const paramType = this.parseType();
        typeParams.push({ name: paramName, type: paramType });
        this.skipNewlines();
        if (!this.is(Tok.RBRACK)) this.expect(Tok.COMMA);
      }
      this.expect(Tok.RBRACK);
    }
    this.expect(Tok.LPAREN);
    const params = [];
    while (!this.is(Tok.RPAREN)) {
      if (this.is(Tok.OUT) || this.is(Tok.INOUT) || this.is(Tok.MUT)) {
        this.advance();
        this.skipNewlines();
        if (this.is(Tok.ID) && this.peek().value === 'self') {
          params.push({ name: 'self', type: null });
          this.advance();
          if (!this.is(Tok.RPAREN)) this.expect(Tok.COMMA);
          continue;
        }
      }
      if (this.is(Tok.STAR)) {
        this.advance();
        if (this.is(Tok.COMMA)) this.advance();
        continue;
      }
      this.skipNewlines();
      if (this.is(Tok.INDENT)) this.advance();
      if (!this.is(Tok.ID)) break;
      const paramName = this.advance().value;
      if (this.is(Tok.COLON)) {
        this.advance();
        const type = this.parseType();
        params.push({ name: paramName, type });
      } else {
        params.push({ name: paramName, type: null });
      }
      this.skipNewlines();
      if (!this.is(Tok.RPAREN)) this.expect(Tok.COMMA);
    }
    this.skipNewlines();
    if (this.is(Tok.DEDENT)) this.advance();
    this.expect(Tok.RPAREN);
    let returnType = null;
    if (this.is(Tok.RARROW)) {
      this.advance();
      returnType = this.parseType();
    }
    this.skipNewlines();
    if (this.is(Tok.INDENT)) this.advance();
    if (this.is(Tok.COLON)) this.advance();
    this.skipNewlines();
    let body;
    if (this.is(Tok.INDENT)) {
      this.advance();
      body = this.parseBlock();
      if (this.is(Tok.DEDENT)) this.advance();
    } else {
      body = this.parseBlock();
    }
    return { type: T.Function, name, params, returnType, body, isDef, typeParams };
  }

  parseBlock() {
    const statements = [];
    while (!this.is(Tok.DEDENT) && !this.is(Tok.EOF)) {
      this.skipNewlines();
      if (this.is(Tok.DEDENT)) break;
      if (this.is(Tok.FN) || this.is(Tok.DEF) || this.is(Tok.STRUCT)) break;
      const stmt = this.parseStatement();
      if (stmt) statements.push(stmt);
    }
    return statements;
  }

  parseStatement() {
    if (this.is(Tok.NEWLINE) || this.is(Tok.DEDENT)) return null;
    this.skipNewlines();
    if (this.is(Tok.INDENT)) this.advance();
    if (this.is(Tok.RETURN)) {
      this.advance();
      this.skipNewlines();
      if (this.is(Tok.INDENT)) this.advance();
      let expr = null;
      if (!this.is(Tok.VAR) && !this.is(Tok.IF) && !this.is(Tok.WHILE) && !this.is(Tok.FOR) && !this.is(Tok.DEF) && !this.is(Tok.FN) && !this.is(Tok.RETURN) && !this.is(Tok.ELSE) && !this.is(Tok.NEWLINE) && !this.is(Tok.DEDENT)) {
        expr = this.parseExpression();
        if (this.is(Tok.HAT)) this.advance();
      }
      this.skipNewlines();
      return { type: T.Return, value: expr };
    }
    if (this.is(Tok.VAR)) {
      this.advance();
      const name = this.advance().value;
      let type = null;
      this.skipNewlines();
      if (this.is(Tok.INDENT)) this.advance();
      if (this.is(Tok.COLON)) {
        this.advance();
        type = this.parseType();
      }
      this.skipNewlines();
      if (this.is(Tok.INDENT)) this.advance();
      let value = null;
      if (this.is(Tok.ASSIGN)) {
        this.advance();
        this.skipNewlines();
        if (this.is(Tok.INDENT)) this.advance();
        value = this.parseExpression();
      }
      this.skipNewlines();
      return { type: T.VarDecl, name, valueType: type, value };
    }
    if (this.is(Tok.IF)) {
      this.advance();
      this.skipNewlines();
      if (this.is(Tok.INDENT)) this.advance();
      const cond = this.parseExpression();
      this.skipNewlines();
      if (this.is(Tok.INDENT)) this.advance();
      this.expect(Tok.COLON);
      this.skipNewlines();
      let thenBlock;
      if (this.is(Tok.INDENT)) {
        this.advance();
        thenBlock = this.parseBlock();
        if (this.is(Tok.DEDENT)) this.advance();
      } else {
        thenBlock = [this.parseStatement()].filter(Boolean);
      }
      let elseBlock = [];
      for (;;) {
        this.skipNewlines();
        if (!this.is(Tok.ELSE)) break;
        this.advance();
        if (this.is(Tok.COLON)) this.advance();
        else this.skipNewlines();
        if (this.is(Tok.INDENT)) this.advance();
        this.skipNewlines();
        if (this.is(Tok.INDENT)) {
          this.advance();
          elseBlock = this.parseBlock();
          if (this.is(Tok.DEDENT)) this.advance();
        } else {
          elseBlock = this.parseBlock();
        }
      }
      return { type: T.If, cond, then: thenBlock, else: elseBlock };
    }
    if (this.is(Tok.WHILE)) {
      this.advance();
      this.skipNewlines();
      if (this.is(Tok.INDENT)) this.advance();
      const cond = this.parseExpression();
      this.skipNewlines();
      if (this.is(Tok.INDENT)) this.advance();
      this.expect(Tok.COLON);
      this.skipNewlines();
      let body;
      if (this.is(Tok.INDENT)) {
        this.advance();
        body = this.parseBlock();
        if (this.is(Tok.DEDENT)) this.advance();
      } else {
        body = [this.parseStatement()].filter(Boolean);
      }
      return { type: T.While, cond, body };
    }
    let comptimeFor = false;
    if (this.is(Tok.COMPTIME)) {
      this.advance();
      this.skipNewlines();
      comptimeFor = true;
    }
    if (this.is(Tok.FOR)) {
      this.advance();
      this.skipNewlines();
      const loopVar = this.advance().value;
      this.skipNewlines();
      this.expect(Tok.IN);
      this.skipNewlines();
      if (this.is(Tok.INDENT)) this.advance();
      const iterable = this.parseExpression();
      this.skipNewlines();
      if (this.is(Tok.INDENT)) this.advance();
      this.expect(Tok.COLON);
      this.skipNewlines();
      let body;
      if (this.is(Tok.INDENT)) {
        this.advance();
        body = this.parseBlock();
        if (this.is(Tok.DEDENT)) this.advance();
      } else {
        body = [this.parseStatement()].filter(Boolean);
      }
      return { type: T.For, loopVar, iterable, body, comptime: comptimeFor };
    }
    if (this.is(Tok.CONTINUE)) {
      this.advance();
      this.skipNewlines();
      return { type: T.Continue };
    }
    if (this.is(Tok.PASS)) {
      this.advance();
      this.skipNewlines();
      return { type: T.Pass };
    }
    this.skipNewlines();
    if (this.is(Tok.INDENT)) this.advance();
    if (this.is(Tok.IF) || this.is(Tok.WHILE) || this.is(Tok.FOR) || this.is(Tok.RETURN) || this.is(Tok.VAR) || this.is(Tok.ELSE)) return null;
    const expr = this.parseExpression();
    if (this.is(Tok.PLUSASSIGN)) {
      this.advance();
      this.skipNewlines();
      if (this.is(Tok.INDENT)) this.advance();
      const value = this.parseExpression();
      this.skipNewlines();
      return { type: T.Assign, target: expr, value, compoundOp: '+=' };
    }
    if (this.is(Tok.ASSIGN)) {
      this.advance();
      this.skipNewlines();
      if (this.is(Tok.INDENT)) this.advance();
      const value = this.parseExpression();
      this.skipNewlines();
      return { type: T.Assign, target: expr, value };
    }
    this.skipNewlines();
    return { type: T.ExprStatement, expr };
  }

  parseExpression() {
    this.skipNewlines();
    if (this.is(Tok.INDENT)) this.advance();
    return this.parseOr();
  }

  parseOr() {
    let left = this.parseAnd();
    while (this.is(Tok.OR)) {
      this.advance();
      left = { type: T.Binary, op: 'or', left, right: this.parseAnd() };
    }
    return left;
  }

  parseAnd() {
    let left = this.parseCompare();
    while (this.is(Tok.AND)) {
      this.advance();
      left = { type: T.Binary, op: 'and', left, right: this.parseCompare() };
    }
    return left;
  }

  parseCompare() {
    let left = this.parseAdd();
    const cmpOps = [Tok.EQ, Tok.NE, Tok.LT, Tok.LE, Tok.GT, Tok.GE];
    while (cmpOps.includes(this.peek().type)) {
      const op = OP_FROM_TYPE[this.advance().type];
      left = { type: T.Binary, op, left, right: this.parseAdd() };
    }
    return left;
  }

  parseAdd() {
    let left = this.parseMul();
    while (this.is(Tok.PLUS) || this.is(Tok.MINUS)) {
      if (this.is(Tok.RARROW)) break;
      const op = OP_FROM_TYPE[this.advance().type];
      left = { type: T.Binary, op, left, right: this.parseMul() };
    }
    return left;
  }

  parseMul() {
    let left = this.parseUnary();
    while (this.is(Tok.STAR) || this.is(Tok.SLASHSLASH) || this.is(Tok.PERCENT)) {
      const op = OP_FROM_TYPE[this.advance().type];
      left = { type: T.Binary, op, left, right: this.parseUnary() };
    }
    return left;
  }

  parseUnary() {
    if (this.is(Tok.NOT)) {
      this.advance();
      return { type: T.Unary, op: 'not', arg: this.parseUnary() };
    }
    if (this.is(Tok.MINUS)) {
      this.advance();
      return { type: T.Unary, op: '-', arg: this.parseUnary() };
    }
    return this.parsePostfix();
  }

  parsePostfix() {
    let e = this.parsePrimary();
    for (;;) {
      if (this.is(Tok.DOT)) {
        this.advance();
        const member = this.expect(Tok.ID).value;
        e = { type: T.Member, object: e, member };
      } else if (this.is(Tok.LPAREN)) {
        this.advance();
        const args = [];
        while (!this.is(Tok.RPAREN)) {
          this.skipNewlines();
          if (this.is(Tok.DEDENT)) this.advance();
          if (this.is(Tok.RPAREN)) break;
          args.push(this.parseExpression());
          this.skipNewlines();
          if (this.is(Tok.INDENT)) this.advance();
          if (!this.is(Tok.RPAREN)) this.expect(Tok.COMMA);
        }
        this.skipNewlines();
        if (this.is(Tok.DEDENT)) this.advance();
        this.expect(Tok.RPAREN);
        e = { type: T.Call, callee: e, args };
      } else if (this.is(Tok.LBRACK)) {
        this.advance();
        const typeArgs = [];
        while (!this.is(Tok.RBRACK)) {
          this.skipNewlines();
          if (this.is(Tok.DEDENT)) this.advance();
          if (this.is(Tok.RBRACK)) break;
          typeArgs.push(this.parseExpression());
          this.skipNewlines();
          if (this.is(Tok.INDENT)) this.advance();
          if (!this.is(Tok.RBRACK)) this.expect(Tok.COMMA);
        }
        this.expect(Tok.RBRACK);
        if (this.is(Tok.LPAREN) && typeArgs.length > 0) {
          this.advance();
          const args = [];
          while (!this.is(Tok.RPAREN)) {
            this.skipNewlines();
            if (this.is(Tok.DEDENT)) this.advance();
            if (this.is(Tok.RPAREN)) break;
            args.push(this.parseExpression());
            this.skipNewlines();
            if (this.is(Tok.INDENT)) this.advance();
            if (!this.is(Tok.RPAREN)) this.expect(Tok.COMMA);
          }
          this.skipNewlines();
          if (this.is(Tok.DEDENT)) this.advance();
          this.expect(Tok.RPAREN);
          e = { type: T.Call, callee: e, typeArgs, args };
        } else if (typeArgs.length === 1) {
          e = { type: T.Index, object: e, index: typeArgs[0] };
        } else {
          throw new Error('Expected ] or single index expression');
        }
      } else if (this.is(Tok.HAT)) {
        this.advance();
      } else break;
    }
    return e;
  }

  parsePrimary() {
    if (this.is(Tok.RPAREN)) return { type: T.None };
    if (this.is(Tok.COMMA)) {
      this.advance();
      this.skipNewlines();
      if (this.is(Tok.INDENT)) this.advance();
      return this.parsePrimary();
    }
    if (this.is(Tok.COLON) || this.is(Tok.ASSIGN)) {
      this.advance();
      this.skipNewlines();
      if (this.is(Tok.INDENT)) this.advance();
      return this.parsePrimary();
    }
    if (this.is(Tok.NUMBER)) {
      return { type: T.Number, value: this.advance().value };
    }
    if (this.is(Tok.STRING)) {
      return { type: T.String, value: this.advance().value };
    }
    if (this.is(Tok.TRUE)) {
      this.advance();
      return { type: T.Bool, value: true };
    }
    if (this.is(Tok.FALSE)) {
      this.advance();
      return { type: T.Bool, value: false };
    }
    if (this.is(Tok.NONE)) {
      this.advance();
      return { type: T.None };
    }
    if (this.is(Tok.ID) || this.is(Tok.VAR) || this.is(Tok.OUT) || this.is(Tok.IF) ||
        this.is(Tok.FOR) || this.is(Tok.IN) || this.is(Tok.ELSE)) {
      const t = this.advance();
      return { type: T.Id, name: t.value };
    }
    if (this.is(Tok.LIST)) {
      this.advance();
      this.expect(Tok.LBRACK);
      const inner = this.parseType();
      this.expect(Tok.RBRACK);
      this.expect(Tok.LPAREN);
      let arg = null;
      this.skipNewlines();
      if (this.is(Tok.INDENT)) this.advance();
      if (!this.is(Tok.RPAREN)) {
        arg = this.parseExpression();
      }
      this.skipNewlines();
      if (this.is(Tok.DEDENT)) this.advance();
      this.expect(Tok.RPAREN);
      return { type: T.ListConstructor, inner, arg };
    }
    if (this.is(Tok.LPAREN)) {
      this.advance();
      this.skipNewlines();
      if (this.is(Tok.INDENT)) this.advance();
      if (this.is(Tok.RPAREN)) {
        this.advance();
        return { type: T.None };
      }
      const e = this.parseExpression();
      this.skipNewlines();
      if (this.is(Tok.DEDENT)) this.advance();
      this.expect(Tok.RPAREN);
      return e;
    }
    throw new Error(`Unexpected token ${this.peek().type} ${this.peek().value}`);
  }
}

function parse(source) {
  const p = new Parser(source);
  return p.parseProgram();
}

module.exports = { parse, Parser };
