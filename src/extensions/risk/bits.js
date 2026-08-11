/**
 * Named risk → bitmask constants (NO_RISK = 0).
 * Identifiers only in source; these ints are an internal encoding.
 */

const NO_RISK = 0;
const OOB = 1 << 0; // 1 — out-of-bounds / buffer overflow
const UAF = 1 << 1; // 2 — use-after-free
const UNINIT = 1 << 2; // 4 — use of uninitialized memory

const RISK_BITS = Object.freeze({
  NO_RISK,
  OOB,
  UAF,
  UNINIT,
});

/**
 * @param {string} name
 * @param {number} [line]
 * @returns {number}
 */
function resolveRiskName(name, line) {
  if (!Object.prototype.hasOwnProperty.call(RISK_BITS, name)) {
    const where = line != null ? ` at line ${line}` : '';
    throw new Error(`Unknown risk identifier '${name}'${where}`);
  }
  return RISK_BITS[name];
}

/**
 * @param {number} mask
 * @returns {string}
 */
function formatRiskMask(mask) {
  if (!mask) return 'NO_RISK';
  const names = [];
  if (mask & OOB) names.push('OOB');
  if (mask & UAF) names.push('UAF');
  if (mask & UNINIT) names.push('UNINIT');
  return names.join('|');
}

module.exports = {
  NO_RISK,
  OOB,
  UAF,
  UNINIT,
  RISK_BITS,
  resolveRiskName,
  formatRiskMask,
};
