/**
 * Tokenizer for a simple Mojo subset. Yields tokens including INDENT/DEDENT for block structure.
 */

const Tok = require('./token-types.js');

const KEYWORDS = new Set([
  'var', 'fn', 'def', 'struct', 'if', 'else', 'while', 'for', 'in', 'return',
  'and', 'or', 'not', 'True', 'False', 'Self', 'None', 'Bool', 'Int', 'List',
  'Copyable', 'Movable', 'continue', 'pass', 'mut', 'out', 'inout', 'deinit',
  'comptime',
]);

/** Mojo/reserved keywords we do not support; tokenizer errors with line number if seen. */
const UNSUPPORTED_KEYWORDS = new Set([
  'async', 'await', 'raise', 'with', 'try', 'except', 'finally',
  'match', 'class', 'lambda', 'yield', 'global', 'nonlocal', 'del', 'assert',
]);

function isKeyword(id) {
  return KEYWORDS.has(id);
}

function isUnsupportedKeyword(id) {
  return UNSUPPORTED_KEYWORDS.has(id);
}

function isDigit(c) {
  return c >= '0' && c <= '9';
}

function isIdentStart(c) {
  return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_';
}

function isIdentPart(c) {
  return isIdentStart(c) || isDigit(c);
}

function isWhitespace(c) {
  return c === ' ' || c === '\t' || c === '\r';
}

/**
 * @param {string} source
 * @returns {{ type: string, value?: string | number, line?: number, col?: number }[]}
 */
function tokenize(source) {
  const tokens = [];
  let i = 0;
  let line = 1;
  let col = 1;
  const indentStack = [0];
  let atLineStart = true;

  function peek() {
    return source[i] ?? '';
  }

  function advance() {
    if (i >= source.length) return '';
    const c = source[i++];
    if (c === '\n') {
      line++;
      col = 1;
    } else {
      col++;
    }
    return c;
  }

  function push(tok) {
    tokens.push(tok);
  }

  function getLineCol() {
    return { line, col };
  }

  function readNumber() {
    const start = getLineCol();
    let s = '';
    while (i < source.length && isDigit(peek())) s += advance();
    if (peek() === '.' && isDigit(source[i + 1])) {
      s += advance();
      while (i < source.length && isDigit(peek())) s += advance();
    }
    if (peek() === 'e' || peek() === 'E') {
      s += advance();
      if (peek() === '+' || peek() === '-') s += advance();
      while (i < source.length && isDigit(peek())) s += advance();
    }
    const num = s.includes('.') || s.includes('e') || s.includes('E') ? parseFloat(s) : parseInt(s, 10);
    return { type: Tok.NUMBER, value: num, ...start };
  }

  function readIdentifier() {
    const start = getLineCol();
    let s = '';
    while (i < source.length && isIdentPart(peek())) s += advance();
    if (isUnsupportedKeyword(s)) {
      throw new Error(`Unknown keyword '${s}' at line ${start.line}`);
    }
    const type = isKeyword(s) ? Tok[s.toUpperCase()] : Tok.ID;
    return { type, value: s, ...start };
  }

  function readString(quote) {
    const start = getLineCol();
    advance(); // opening quote
    let s = '';
    while (i < source.length && peek() !== quote) {
      if (peek() === '\\') {
        advance();
        s += advance();
      } else {
        s += advance();
      }
    }
    if (peek() === quote) advance();
    return { type: Tok.STRING, value: s, ...start };
  }

  function readDocstring() {
    const start = getLineCol();
    advance();
    advance();
    advance();
    let s = '';
    while (i < source.length) {
      const a = source[i];
      const b = source[i + 1];
      const c = source[i + 2];
      if (a === '"' && b === '"' && c === '"') {
        i += 3;
        break;
      }
      s += advance();
    }
    return { type: Tok.DOCSTRING, value: s, ...start };
  }

  function handleIndent() {
    let spaces = 0;
    while (peek() === ' ' || peek() === '\t') {
      spaces += peek() === '\t' ? 4 : 1;
      advance();
    }
    if (peek() === '\n' || peek() === '#' || peek() === '') return spaces;
    const top = indentStack[indentStack.length - 1];
    if (spaces > top) {
      indentStack.push(spaces);
      push({ type: Tok.INDENT, ...getLineCol() });
    } else if (spaces < top) {
      while (indentStack.length > 1 && indentStack[indentStack.length - 1] > spaces) {
        indentStack.pop();
        push({ type: Tok.DEDENT, ...getLineCol() });
      }
      if (indentStack[indentStack.length - 1] !== spaces) {
        throw new Error(`Indent error at line ${line}`);
      }
    }
    return spaces;
  }

  while (i < source.length) {
    if (atLineStart && (peek() === ' ' || peek() === '\t')) {
      handleIndent();
      atLineStart = false;
      continue;
    }
    if (atLineStart && peek() !== '\n' && peek() !== '' && indentStack.length > 1) {
      const top = indentStack[indentStack.length - 1];
      if (top > 0) {
        while (indentStack.length > 1) {
          indentStack.pop();
          push({ type: Tok.DEDENT, ...getLineCol() });
        }
      }
    }
    atLineStart = false;

    if (peek() === '\n') {
      advance();
      push({ type: Tok.NEWLINE, ...getLineCol() });
      atLineStart = true;
      continue;
    }

    if (peek() === ' ' || peek() === '\t') {
      advance();
      continue;
    }

    if (peek() === '#') {
      while (i < source.length && peek() !== '\n') advance();
      continue;
    }

    if (peek() === '"' && source[i + 1] === '"' && source[i + 2] === '"') {
      readDocstring();
      continue;
    }

    if (peek() === '"' || peek() === "'") {
      push(readString(peek()));
      continue;
    }

    if (isDigit(peek())) {
      push(readNumber());
      continue;
    }

    if (isIdentStart(peek())) {
      push(readIdentifier());
      continue;
    }

    const start = getLineCol();
    const c = advance();

    if (c === '(') { push({ type: Tok.LPAREN, ...start }); continue; }
    if (c === ')') { push({ type: Tok.RPAREN, ...start }); continue; }
    if (c === '[') { push({ type: Tok.LBRACK, ...start }); continue; }
    if (c === ']') { push({ type: Tok.RBRACK, ...start }); continue; }
    if (c === ':') { push({ type: Tok.COLON, ...start }); continue; }
    if (c === ',') { push({ type: Tok.COMMA, ...start }); continue; }
    if (c === '.') { push({ type: Tok.DOT, ...start }); continue; }
    if (c === '^') { push({ type: Tok.HAT, ...start }); continue; }
    if (c === '*') {
      if (peek() === '*') { advance(); push({ type: Tok.STARSTAR, ...start }); }
      else push({ type: Tok.STAR, ...start });
      continue;
    }
    if (c === '=') {
      if (peek() === '=') { advance(); push({ type: Tok.EQ, ...start }); }
      else push({ type: Tok.ASSIGN, ...start });
      continue;
    }
    if (c === '!') {
      if (peek() === '=') { advance(); push({ type: Tok.NE, ...start }); }
      else push({ type: Tok.NOT, ...start });
      continue;
    }
    if (c === '<') {
      if (peek() === '=') { advance(); push({ type: Tok.LE, ...start }); }
      else push({ type: Tok.LT, ...start });
      continue;
    }
    if (c === '>') {
      if (peek() === '=') { advance(); push({ type: Tok.GE, ...start }); }
      else push({ type: Tok.GT, ...start });
      continue;
    }
    if (c === '+') {
      if (peek() === '=') { advance(); push({ type: Tok.PLUSASSIGN, ...start }); }
      else push({ type: Tok.PLUS, ...start });
      continue;
    }
    if (c === '-') {
      if (peek() === '>') { advance(); push({ type: Tok.RARROW, ...start }); }
      else push({ type: Tok.MINUS, ...start });
      continue;
    }
    if (c === '%') { push({ type: Tok.PERCENT, ...start }); continue; }
    if (c === '/') {
      if (peek() === '/') { advance(); push({ type: Tok.SLASHSLASH, ...start }); }
      else push({ type: Tok.SLASH, ...start });
      continue;
    }

    throw new Error(`Unexpected character '${c}' at ${line}:${col}`);
  }

  while (indentStack.length > 1) {
    indentStack.pop();
    push({ type: Tok.DEDENT, ...getLineCol() });
  }
  push({ type: Tok.NEWLINE, ...getLineCol() });

  return tokens;
}

module.exports = { tokenize, KEYWORDS };
