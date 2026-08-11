/**
 * Parse risk(...) forms for block statements and def/method annotations.
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
 * Parse risk(clause {| clause}).
 * @param {import('../../parser.js').Parser} parser
 * @returns {object[]} clauses
 */
function parseRiskClauses(parser) {
  parser.expect(Tok.RISK);
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
  return clauses;
}

/**
 * Parse risk(...) for function/method signatures.
 * @param {import('../../parser.js').Parser} parser
 * @returns {{ riskClauses: object[], riskMask: number }}
 */
function parseRiskMaskAnnotation(parser) {
  const riskClauses = parseRiskClauses(parser);
  let riskMask = 0;
  for (const c of riskClauses) {
    if (c.kind === 'mask') riskMask |= c.mask;
    else if (c.kind === 'conditional') riskMask |= c.thenMask | c.elseMask;
  }
  return { riskClauses, riskMask };
}

/**
 * @param {import('../../parser.js').Parser} parser
 * @returns {object|null}
 */
function parseRiskStatement(parser) {
  if (!parser.is(Tok.RISK)) return null;
  const clauses = parseRiskClauses(parser);
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

module.exports = {
  parseRiskStatement,
  parseRiskMaskAnnotation,
  parseRiskClauses,
  parseRiskName,
  parseRiskClause,
};
