/**
 * Risk language-extension pack: block-level risk(...): acknowledgment.
 * Enable with parse(source, { features: ['risk'] }) or --feature risk.
 */

const Tok = require('../../token-types.js');
const T = require('../../ast-types.js');
const { parseRiskStatement } = require('./parse.js');
const { emitRiskStatement } = require('./emit.js');
const { RISK_BITS } = require('./bits.js');

module.exports = {
  name: 'risk',
  keywords: [{ word: 'risk', tokenType: Tok.RISK }],
  statementHandlers: [parseRiskStatement],
  emitStatementHandlers: {
    [T.Risk]: emitRiskStatement,
  },
  RISK_BITS,
};
