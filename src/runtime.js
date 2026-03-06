/**
 * Minimal runtime used by Mojo-transpiled code (argv, print, atol, range, len).
 */

/**
 * @param {string[]} argv - process.argv from Node (script path + args)
 * @returns {string[]} Mojo-style argv: [script_name, ...args]
 */
function argv(argvFromProcess) {
  return argvFromProcess || [];
}

/**
 * @param {string} s
 * @returns {number}
 */
function atol(s) {
  const n = Number(s);
  if (Number.isSafeInteger(n)) return n;
  return BigInt(s);
}

/**
 * @param  {...unknown} args
 */
function print(...args) {
  console.log(...args);
}

/**
 * @param {number} n
 * @returns {number[]}
 */
function range(n) {
  return Array.from({ length: n }, (_, i) => i);
}

/**
 * @param {number} start
 * @param {number} end
 * @returns {number[]}
 */
function rangeFromTo(start, end) {
  return Array.from({ length: end - start }, (_, i) => start + i);
}

/**
 * @param {ArrayLike<unknown>} x
 * @returns {number}
 */
function len(x) {
  return x.length;
}

module.exports = { argv, atol, print, range, rangeFromTo, len };
