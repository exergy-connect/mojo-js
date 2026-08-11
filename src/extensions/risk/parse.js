/**
 * Parse risk(...): block statements and risk(A|B) signature annotations.
 */

const Tok = require('../../token-types.js');
const T = require('../../ast-types.js');
const { resolveRiskName } = require('./bits.js');

/**
 * Parse a single risk name identifier (not a number).
 * @param {import('../../parser.js').Parser} parser
 * @returns {number} bitmask
 */
function parseRiskName(parser) {
  const t = parser.peek();
  if (t.type === Tok.NUMBER) {
    throw new Error(`Expected risk identifier, got number at line ${t.line || 1}`);
  }
  if (t.type !== Tok.ID) {
    throw new Error(`Expected risk identifier, got ${t.type} ${t.value} at line ${t.line || 1}`);
  }
  parser.advance();
  return resolveRiskName(t.value, t.line);
}

/**
 * Parse one risk clause: Name | Name if expr else Name
 * @param {import('../../parser.js').Parser} parser
 */
function parseRiskClause(parser) {
  const thenMask = parseRiskName(parser);
  parser.skipNewlines();
  if (parser.is(Tok.IF)) {
    parser.advance();
    parser.skipNewlines();
    const condition = parser.parseExpression();
    parser.skipNewlines();
    parser.expect(Tok.ELSE);
    parser.skipNewlines();
    const elseMask = parseRiskName(parser);
    return { kind: 'conditional', thenMask, condition, elseMask };
  }
  return { kind: 'mask', mask: thenMask };
}

/**
 * Parse risk(A|B|...) for function/method signatures (no conditionals).
 * Caller has not yet consumed the RISK token.
 * @param {import('../../parser.js').Parser} parser
 * @returns {number}
 */
function parseRiskMaskAnnotation(parser) {
  const start = parser.peek();
  parser.expect(Tok.RISK);
  parser.skipNewlines();
  parser.expect(Tok.LPAREN);
  parser.skipNewlines();
  let mask = 0;
  mask |= parseRiskName(parser);
  parser.skipNewlines();
  if (parser.is(Tok.IF)) {
    throw new Error(
      `Conditional risk clauses are not allowed on function signatures at line ${start.line || 1}`
    );
  }
  while (parser.is(Tok.PIPE)) {
    parser.advance();
    parser.skipNewlines();
    mask |= parseRiskName(parser);
    parser.skipNewlines();
    if (parser.is(Tok.IF)) {
      throw new Error(
        `Conditional risk clauses are not allowed on function signatures at line ${start.line || 1}`
      );
    }
  }
  parser.expect(Tok.RPAREN);
  return mask;
}

/**
 * @param {import('../../parser.js').Parser} parser
 * @returns {object|null}
 */
function parseRiskStatement(parser) {
  if (!parser.is(Tok.RISK)) return null;
  parser.advance();
  parser.skipNewlines();
  parser.expect(Tok.LPAREN);
  parser.skipNewlines();

  const clauses = [];
  clauses.push(parseRiskClause(parser));
  parser.skipNewlines();
  while (parser.is(Tok.PIPE)) {
    parser.advance();
    parser.skipNewlines();
    clauses.push(parseRiskClause(parser));
    parser.skipNewlines();
  }
  parser.expect(Tok.RPAREN);
  parser.skipNewlines();
  if (parser.is(Tok.INDENT)) parser.advance();
  parser.expect(Tok.COLON);
  parser.skipNewlines();

  let body;
  if (parser.is(Tok.INDENT)) {
    parser.advance();
    body = parser.parseBlock();
    if (parser.is(Tok.DEDENT)) parser.advance();
  } else {
    body = [parser.parseStatement()].filter(Boolean);
  }

  return { type: T.Risk, clauses, body };
}

module.exports = { parseRiskStatement, parseRiskMaskAnnotation, parseRiskName, parseRiskClause };
