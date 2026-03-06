/**
 * Parser for a simple Mojo subset. Builds AST from token stream.
 */

const { tokenize } = require('./tokenizer.js');

class Parser {
  constructor(source) {
    this.tokens = tokenize(source);
    this.i = 0;
  }

  peek() {
    return this.tokens[this.i] ?? { type: 'EOF' };
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
    while (this.is('NEWLINE')) this.advance();
  }

  /** Skip NEWLINE and DEDENT (e.g. after a statement where we want to skip past a block end). */
  skipNewlinesAndDedents() {
    while (this.is('NEWLINE') || this.is('DEDENT')) this.advance();
  }

  parseProgram() {
    const program = { type: 'Program', structs: [], functions: [], main: null };
    this.skipNewlines();
    while (this.i < this.tokens.length && this.peek().type !== 'EOF') {
      if (this.is('DEDENT')) {
        this.advance();
        continue;
      }
      if (this.is('ID', 'from') || this.is('DOCSTRING')) {
        this.skipImportOrDocstring();
        continue;
      }
      if (this.is('STRUCT')) {
        program.structs.push(this.parseStruct());
        continue;
      }
      if (this.is('FN') || this.is('DEF')) {
        const fn = this.parseFunction();
        if (fn.name === 'main') program.main = fn;
        else program.functions.push(fn);
        continue;
      }
      this.advance();
    }
    return program;
  }

  skipImportOrDocstring() {
    if (this.is('DOCSTRING')) {
      this.advance();
      return;
    }
    if (this.is('ID', 'from')) {
      while (!this.is('NEWLINE')) this.advance();
      this.advance();
    }
  }

  parseStruct() {
    this.expect('STRUCT');
    const name = this.expect('ID').value;
    let traits = [];
    if (this.is('LPAREN')) {
      this.advance();
      const t = this.advance();
      traits.push(t.value);
      while (this.is('COMMA')) {
        this.advance();
        traits.push(this.advance().value);
      }
      this.expect('RPAREN');
    }
    this.expect('COLON');
    this.skipNewlines();
    if (this.is('INDENT')) this.advance();
    const struct = { type: 'Struct', name, traits, fields: [], methods: [] };
    while (!this.is('DEDENT') && !this.is('EOF')) {
      this.skipNewlines();
      if (this.is('STRUCT')) break;
      if (this.is('VAR')) {
        this.advance();
        this.skipNewlines();
        const fieldName = this.advance().value;
        let type = null;
        if (this.is('COLON')) {
          this.advance();
          type = this.parseType();
        } else if (this.is('ASSIGN')) {
          this.advance();
          this.parseExpression();
        }
        struct.fields.push({ name: fieldName, type });
        this.skipNewlines();
        continue;
      }
      if (this.is('FN')) {
        struct.methods.push(this.parseMethod());
        continue;
      }
      break;
    }
    if (this.is('DEDENT')) this.advance();
    return struct;
  }

  parseType() {
    if (this.is('LIST')) {
      this.advance();
      this.expect('LBRACK');
      const inner = this.parseType();
      this.expect('RBRACK');
      return { kind: 'List', inner };
    }
    if (this.is('INT') || this.is('BOOL') || this.is('ID') || this.is('SELF')) {
      const t = this.advance();
      return { kind: 'Id', name: t.value };
    }
    if (this.is('NONE')) {
      this.advance();
      return { kind: 'None' };
    }
    throw new Error('Expected type');
  }

  parseMethod() {
    this.expect('FN');
    const name = this.expect('ID').value;
    this.expect('LPAREN');
    const params = [];
    while (!this.is('RPAREN')) {
      if (this.is('STAR')) {
        this.advance();
        if (this.is('COMMA')) this.advance();
        continue;
      }
      if (this.is('DEINIT')) {
        this.advance();
        const paramName = this.expect('ID').value;
        this.expect('COLON');
        params.push({ name: paramName, type: this.parseType() });
        if (!this.is('RPAREN')) this.expect('COMMA');
        continue;
      }
      if (this.is('OUT') || this.is('INOUT') || this.is('MUT')) {
        this.advance();
        this.skipNewlines();
        if (this.is('ID') && this.peek().value === 'self') {
          params.push({ name: 'self', type: null });
          this.advance();
          if (!this.is('RPAREN')) this.expect('COMMA');
          continue;
        }
      }
      this.skipNewlines();
      if (this.is('INDENT')) this.advance();
      if (!this.is('ID')) break;
      const paramName = this.advance().value;
      if (paramName === 'self') {
        params.push({ name: 'self', type: null });
        if (this.is('COMMA')) this.advance();
        continue;
      }
      this.skipNewlines();
      if (this.is('INDENT')) this.advance();
      let type = null;
      if (this.is('COLON')) {
        this.advance();
        type = this.parseType();
      }
      params.push({ name: paramName, type });
      this.skipNewlines();
      if (!this.is('RPAREN')) this.expect('COMMA');
    }
    this.skipNewlines();
    if (this.is('DEDENT')) this.advance();
    this.expect('RPAREN');
    let returnType = null;
    if (this.is('RARROW')) {
      this.advance();
      returnType = this.parseType();
    }
    this.skipNewlines();
    if (this.is('INDENT')) this.advance();
    if (this.is('COLON')) this.advance();
    this.skipNewlines();
    let body;
    if (this.is('INDENT')) {
      this.advance();
      body = this.parseBlock();
      if (this.is('DEDENT')) this.advance();
    } else {
      body = this.parseBlock();
    }
    return { type: 'Method', name, params, returnType, body };
  }

  parseFunction() {
    const isDef = this.is('DEF');
    this.advance();
    const name = this.expect('ID').value;
    this.expect('LPAREN');
    const params = [];
    while (!this.is('RPAREN')) {
      if (this.is('OUT') || this.is('INOUT') || this.is('MUT')) {
        this.advance();
        this.skipNewlines();
        if (this.is('ID') && this.peek().value === 'self') {
          params.push({ name: 'self', type: null });
          this.advance();
          if (!this.is('RPAREN')) this.expect('COMMA');
          continue;
        }
      }
      if (this.is('STAR')) {
        this.advance();
        if (this.is('COMMA')) this.advance();
        continue;
      }
      this.skipNewlines();
      if (this.is('INDENT')) this.advance();
      if (!this.is('ID')) break;
      const paramName = this.advance().value;
      if (this.is('COLON')) {
        this.advance();
        const type = this.parseType();
        params.push({ name: paramName, type });
      } else {
        params.push({ name: paramName, type: null });
      }
      this.skipNewlines();
      if (!this.is('RPAREN')) this.expect('COMMA');
    }
    this.skipNewlines();
    if (this.is('DEDENT')) this.advance();
    this.expect('RPAREN');
    let returnType = null;
    if (this.is('RARROW')) {
      this.advance();
      returnType = this.parseType();
    }
    this.skipNewlines();
    if (this.is('INDENT')) this.advance();
    if (this.is('COLON')) this.advance();
    this.skipNewlines();
    let body;
    if (this.is('INDENT')) {
      this.advance();
      body = this.parseBlock();
      if (this.is('DEDENT')) this.advance();
    } else {
      body = this.parseBlock();
    }
    return { type: 'Function', name, params, returnType, body, isDef };
  }

  parseBlock() {
    const statements = [];
    while (!this.is('DEDENT') && !this.is('EOF')) {
      this.skipNewlines();
      if (this.is('DEDENT')) break;
      if (this.is('FN') || this.is('DEF') || this.is('STRUCT')) break;
      const stmt = this.parseStatement();
      if (stmt) statements.push(stmt);
    }
    return statements;
  }

  parseStatement() {
    if (this.is('NEWLINE') || this.is('DEDENT')) return null;
    this.skipNewlines();
    if (this.is('INDENT')) this.advance();
    if (this.is('RETURN')) {
      this.advance();
      this.skipNewlines();
      if (this.is('INDENT')) this.advance();
      let expr = null;
      if (!this.is('VAR') && !this.is('IF') && !this.is('WHILE') && !this.is('FOR') && !this.is('DEF') && !this.is('FN') && !this.is('RETURN') && !this.is('ELSE') && !this.is('NEWLINE') && !this.is('DEDENT')) {
        expr = this.parseExpression();
        if (this.is('HAT')) this.advance();
      }
      this.skipNewlines();
      return { type: 'Return', value: expr };
    }
    if (this.is('VAR')) {
      this.advance();
      const name = this.advance().value;
      let type = null;
      this.skipNewlines();
      if (this.is('INDENT')) this.advance();
      if (this.is('COLON')) {
        this.advance();
        type = this.parseType();
      }
      this.skipNewlines();
      if (this.is('INDENT')) this.advance();
      let value = null;
      if (this.is('ASSIGN')) {
        this.advance();
        this.skipNewlines();
        if (this.is('INDENT')) this.advance();
        value = this.parseExpression();
      }
      this.skipNewlines();
      return { type: 'VarDecl', name, valueType: type, value };
    }
    if (this.is('IF')) {
      this.advance();
      this.skipNewlines();
      if (this.is('INDENT')) this.advance();
      const cond = this.parseExpression();
      this.skipNewlines();
      if (this.is('INDENT')) this.advance();
      this.expect('COLON');
      this.skipNewlines();
      let thenBlock;
      if (this.is('INDENT')) {
        this.advance();
        thenBlock = this.parseBlock();
        if (this.is('DEDENT')) this.advance();
      } else {
        thenBlock = [this.parseStatement()].filter(Boolean);
      }
      let elseBlock = [];
      for (;;) {
        this.skipNewlines();
        if (!this.is('ELSE')) break;
        this.advance();
        if (this.is('COLON')) this.advance();
        else this.skipNewlines();
        if (this.is('INDENT')) this.advance();
        this.skipNewlines();
        if (this.is('INDENT')) {
          this.advance();
          elseBlock = this.parseBlock();
          if (this.is('DEDENT')) this.advance();
        } else {
          elseBlock = this.parseBlock();
        }
      }
      return { type: 'If', cond, then: thenBlock, else: elseBlock };
    }
    if (this.is('WHILE')) {
      this.advance();
      this.skipNewlines();
      if (this.is('INDENT')) this.advance();
      const cond = this.parseExpression();
      this.skipNewlines();
      if (this.is('INDENT')) this.advance();
      this.expect('COLON');
      this.skipNewlines();
      let body;
      if (this.is('INDENT')) {
        this.advance();
        body = this.parseBlock();
        if (this.is('DEDENT')) this.advance();
      } else {
        body = [this.parseStatement()].filter(Boolean);
      }
      return { type: 'While', cond, body };
    }
    if (this.is('FOR')) {
      this.advance();
      this.skipNewlines();
      const loopVar = this.advance().value;
      this.skipNewlines();
      this.expect('IN');
      this.skipNewlines();
      if (this.is('INDENT')) this.advance();
      const iterable = this.parseExpression();
      this.skipNewlines();
      if (this.is('INDENT')) this.advance();
      this.expect('COLON');
      this.skipNewlines();
      let body;
      if (this.is('INDENT')) {
        this.advance();
        body = this.parseBlock();
        if (this.is('DEDENT')) this.advance();
      } else {
        body = [this.parseStatement()].filter(Boolean);
      }
      return { type: 'For', loopVar, iterable, body };
    }
    if (this.is('CONTINUE')) {
      this.advance();
      this.skipNewlines();
      return { type: 'Continue' };
    }
    if (this.is('PASS')) {
      this.advance();
      this.skipNewlines();
      return { type: 'Pass' };
    }
    this.skipNewlines();
    if (this.is('INDENT')) this.advance();
    if (this.is('IF') || this.is('WHILE') || this.is('FOR') || this.is('RETURN') || this.is('VAR') || this.is('ELSE')) return null;
    const expr = this.parseExpression();
    if (this.is('PLUSASSIGN')) {
      this.advance();
      this.skipNewlines();
      if (this.is('INDENT')) this.advance();
      const value = this.parseExpression();
      this.skipNewlines();
      return { type: 'Assign', target: expr, value, compoundOp: '+=' };
    }
    if (this.is('ASSIGN')) {
      this.advance();
      this.skipNewlines();
      if (this.is('INDENT')) this.advance();
      const value = this.parseExpression();
      this.skipNewlines();
      return { type: 'Assign', target: expr, value };
    }
    this.skipNewlines();
    return { type: 'ExprStatement', expr };
  }

  parseExpression() {
    this.skipNewlines();
    if (this.is('INDENT')) this.advance();
    return this.parseOr();
  }

  parseOr() {
    let left = this.parseAnd();
    while (this.is('OR')) {
      this.advance();
      left = { type: 'Binary', op: 'or', left, right: this.parseAnd() };
    }
    return left;
  }

  parseAnd() {
    let left = this.parseCompare();
    while (this.is('AND')) {
      this.advance();
      left = { type: 'Binary', op: 'and', left, right: this.parseCompare() };
    }
    return left;
  }

  parseCompare() {
    let left = this.parseAdd();
    const ops = ['EQ', 'NE', 'LT', 'LE', 'GT', 'GE'];
    while (ops.includes(this.peek().type)) {
      const op = this.advance().type.toLowerCase();
      left = { type: 'Binary', op, left, right: this.parseAdd() };
    }
    return left;
  }

  parseAdd() {
    let left = this.parseMul();
    while (this.is('PLUS') || this.is('MINUS')) {
      if (this.is('RARROW')) break;
      const t = this.advance();
      const op = t.type === 'PLUS' ? '+' : '-';
      left = { type: 'Binary', op, left, right: this.parseMul() };
    }
    return left;
  }

  parseMul() {
    let left = this.parseUnary();
    while (this.is('STAR') || this.is('SLASHSLASH') || this.is('PERCENT')) {
      const t = this.advance();
      const op = t.type === 'STAR' ? '*' : t.type === 'SLASHSLASH' ? '//' : '%';
      left = { type: 'Binary', op, left, right: this.parseUnary() };
    }
    return left;
  }

  parseUnary() {
    if (this.is('NOT')) {
      this.advance();
      return { type: 'Unary', op: 'not', arg: this.parseUnary() };
    }
    if (this.is('MINUS')) {
      this.advance();
      return { type: 'Unary', op: '-', arg: this.parseUnary() };
    }
    return this.parsePostfix();
  }

  parsePostfix() {
    let e = this.parsePrimary();
    for (;;) {
      if (this.is('DOT')) {
        this.advance();
        const member = this.expect('ID').value;
        e = { type: 'Member', object: e, member };
      } else if (this.is('LPAREN')) {
        this.advance();
        const args = [];
        while (!this.is('RPAREN')) {
          this.skipNewlines();
          if (this.is('DEDENT')) this.advance();
          if (this.is('RPAREN')) break;
          args.push(this.parseExpression());
          this.skipNewlines();
          if (this.is('INDENT')) this.advance();
          if (!this.is('RPAREN')) this.expect('COMMA');
        }
        this.skipNewlines();
        if (this.is('DEDENT')) this.advance();
        this.expect('RPAREN');
        e = { type: 'Call', callee: e, args };
      } else if (this.is('LBRACK')) {
        this.advance();
        const index = this.parseExpression();
        this.expect('RBRACK');
        e = { type: 'Index', object: e, index };
      } else if (this.is('HAT')) {
        this.advance();
      } else break;
    }
    return e;
  }

  parsePrimary() {
    if (this.is('RPAREN')) return { type: 'None' };
    if (this.is('COMMA')) {
      this.advance();
      this.skipNewlines();
      if (this.is('INDENT')) this.advance();
      return this.parsePrimary();
    }
    if (this.is('COLON') || this.is('ASSIGN')) {
      this.advance();
      this.skipNewlines();
      if (this.is('INDENT')) this.advance();
      return this.parsePrimary();
    }
    if (this.is('NUMBER')) {
      return { type: 'Number', value: this.advance().value };
    }
    if (this.is('STRING')) {
      return { type: 'String', value: this.advance().value };
    }
    if (this.is('TRUE')) {
      this.advance();
      return { type: 'Bool', value: true };
    }
    if (this.is('FALSE')) {
      this.advance();
      return { type: 'Bool', value: false };
    }
    if (this.is('NONE')) {
      this.advance();
      return { type: 'None' };
    }
    if (this.is('ID') || this.is('VAR') || this.is('OUT') || this.is('IF') ||
        this.is('FOR') || this.is('IN') || this.is('ELSE')) {
      const t = this.advance();
      return { type: 'Id', name: t.value };
    }
    if (this.is('LIST')) {
      this.advance();
      this.expect('LBRACK');
      const inner = this.parseType();
      this.expect('RBRACK');
      this.expect('LPAREN');
      let arg = null;
      this.skipNewlines();
      if (this.is('INDENT')) this.advance();
      if (!this.is('RPAREN')) {
        arg = this.parseExpression();
      }
      this.skipNewlines();
      if (this.is('DEDENT')) this.advance();
      this.expect('RPAREN');
      return { type: 'ListConstructor', inner, arg };
    }
    if (this.is('LPAREN')) {
      this.advance();
      this.skipNewlines();
      if (this.is('INDENT')) this.advance();
      if (this.is('RPAREN')) {
        this.advance();
        return { type: 'None' };
      }
      const e = this.parseExpression();
      this.skipNewlines();
      if (this.is('DEDENT')) this.advance();
      this.expect('RPAREN');
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
