/**
 * Emit Risk AST nodes as acknowledgeRisk(mask) + body block.
 */

const T = require('../../ast-types.js');

/**
 * Emit a JS expression for the combined risk bitmask.
 * @param {object[]} clauses
 * @param {(e: object) => string} emitExpr
 * @returns {string}
 */
function emitRiskMaskExpr(clauses, emitExpr) {
  const parts = [];
  for (const c of clauses) {
    if (c.kind === 'mask') {
      parts.push(String(c.mask));
    } else if (c.kind === 'conditional') {
      const cond = emitExpr(c.condition);
      parts.push(`((${cond}) ? ${c.thenMask} : ${c.elseMask})`);
    }
  }
  if (parts.length === 0) return '0';
  if (parts.length === 1) return parts[0];
  return parts.join(' | ');
}

/**
 * @param {object} node — Risk AST node
 * @param {{ out: string[], indent: number, structNames: Set<string>, emitStatement: Function, emitExpr: Function }} ctx
 */
function emitRiskStatement(node, ctx) {
  const { out, indent, structNames, emitStatement, emitExpr } = ctx;
  const i = ' '.repeat(indent);
  const maskExpr = emitRiskMaskExpr(node.clauses, (e) => emitExpr(e, structNames));
  out.push(`${i}acknowledgeRisk(${maskExpr});`);
  out.push(`${i}{`);
  for (const s of node.body || []) {
    emitStatement(s, out, structNames, indent + 2);
  }
  out.push(`${i}}`);
}

module.exports = {
  emitRiskStatement,
  emitRiskMaskExpr,
};
