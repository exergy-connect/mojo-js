/**
 * Tokenizer for a simple Mojo subset. Yields tokens including INDENT/DEDENT for block structure.
 */

const KEYWORDS = new Set([
  'var', 'fn', 'def', 'struct', 'if', 'else', 'while', 'for', 'in', 'return',
  'and', 'or', 'not', 'True', 'False', 'Self', 'None', 'Bool', 'Int', 'List',
  'Copyable', 'Movable', 'continue', 'pass', 'mut', 'out', 'inout', 'deinit',
]);

function isKeyword(id) {
  return KEYWORDS.has(id);
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
    return { type: 'NUMBER', value: parseInt(s, 10), ...start };
  }

  function readIdentifier() {
    const start = getLineCol();
    let s = '';
    while (i < source.length && isIdentPart(peek())) s += advance();
    const type = isKeyword(s) ? s.toUpperCase() : 'ID';
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
    return { type: 'STRING', value: s, ...start };
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
    return { type: 'DOCSTRING', value: s, ...start };
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
      push({ type: 'INDENT', ...getLineCol() });
    } else if (spaces < top) {
      while (indentStack.length > 1 && indentStack[indentStack.length - 1] > spaces) {
        indentStack.pop();
        push({ type: 'DEDENT', ...getLineCol() });
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
          push({ type: 'DEDENT', ...getLineCol() });
        }
      }
    }
    atLineStart = false;

    if (peek() === '\n') {
      advance();
      push({ type: 'NEWLINE', ...getLineCol() });
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

    if (c === '(') { push({ type: 'LPAREN', ...start }); continue; }
    if (c === ')') { push({ type: 'RPAREN', ...start }); continue; }
    if (c === '[') { push({ type: 'LBRACK', ...start }); continue; }
    if (c === ']') { push({ type: 'RBRACK', ...start }); continue; }
    if (c === ':') { push({ type: 'COLON', ...start }); continue; }
    if (c === ',') { push({ type: 'COMMA', ...start }); continue; }
    if (c === '.') { push({ type: 'DOT', ...start }); continue; }
    if (c === '^') { push({ type: 'HAT', ...start }); continue; }
    if (c === '*') {
      if (peek() === '*') { advance(); push({ type: 'STARSTAR', ...start }); }
      else push({ type: 'STAR', ...start });
      continue;
    }
    if (c === '=') {
      if (peek() === '=') { advance(); push({ type: 'EQ', ...start }); }
      else push({ type: 'ASSIGN', ...start });
      continue;
    }
    if (c === '!') {
      if (peek() === '=') { advance(); push({ type: 'NE', ...start }); }
      else push({ type: 'NOT', ...start });
      continue;
    }
    if (c === '<') {
      if (peek() === '=') { advance(); push({ type: 'LE', ...start }); }
      else push({ type: 'LT', ...start });
      continue;
    }
    if (c === '>') {
      if (peek() === '=') { advance(); push({ type: 'GE', ...start }); }
      else push({ type: 'GT', ...start });
      continue;
    }
    if (c === '+') {
      if (peek() === '=') { advance(); push({ type: 'PLUSASSIGN', ...start }); }
      else push({ type: 'PLUS', ...start });
      continue;
    }
    if (c === '-') {
      if (peek() === '>') { advance(); push({ type: 'RARROW', ...start }); }
      else push({ type: 'MINUS', ...start });
      continue;
    }
    if (c === '%') { push({ type: 'PERCENT', ...start }); continue; }
    if (c === '/') {
      if (peek() === '/') { advance(); push({ type: 'SLASHSLASH', ...start }); }
      else push({ type: 'SLASH', ...start });
      continue;
    }

    throw new Error(`Unexpected character '${c}' at ${line}:${col}`);
  }

  while (indentStack.length > 1) {
    indentStack.pop();
    push({ type: 'DEDENT', ...getLineCol() });
  }
  push({ type: 'NEWLINE', ...getLineCol() });

  return tokens;
}

module.exports = { tokenize, KEYWORDS };
