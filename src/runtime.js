/**
 * Minimal runtime used by Mojo-transpiled code (argv, print, atol, range, len).
 * Trait-related helpers are in runtime-traits.js and merged here.
 */
const traitRuntime = require('./runtime-traits.js');

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

/**
 * Base64-encode a string (UTF-8). Compatible with Mojo std.base64.b64encode.
 * @param {string} s
 * @returns {string}
 */
function b64encode(s) {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(String(s), 'utf8').toString('base64');
  }
  const bytes = new TextEncoder().encode(String(s));
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

/**
 * Base64-decode a string to UTF-8. Compatible with Mojo std.base64.b64decode.
 * @param {string} s
 * @returns {string}
 */
function b64decode(s) {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(String(s), 'base64').toString('utf8');
  }
  const binary = atob(String(s));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder('utf-8').decode(bytes);
}

module.exports = {
  argv,
  atol,
  print,
  range,
  rangeFromTo,
  len,
  b64encode,
  b64decode,
  ...traitRuntime,
};
