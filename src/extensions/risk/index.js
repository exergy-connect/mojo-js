/**
 * Risk language-extension pack: block-level and signature risk(A|B).
 * Enable with parse(source, { features: ['risk'] }) or --feature risk.
 * Coverage is checked at compile time unless { acceptRisks: true } / --accept-risks.
 */

const Tok = require('../../token-types.js');
const T = require('../../ast-types.js');
const { parseRiskStatement } = require('./parse.js');
const { emitRiskStatement } = require('./emit.js');
const { checkRisks } = require('./check.js');
const { RISK_BITS } = require('./bits.js');

module.exports = {
  name: 'risk',
  keywords: [{ word: 'risk', tokenType: Tok.RISK }],
  statementHandlers: [parseRiskStatement],
  emitStatementHandlers: {
    [T.Risk]: emitRiskStatement,
  },
  checkRisks,
  RISK_BITS,
};
