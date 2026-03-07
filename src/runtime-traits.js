/**
 * Runtime helpers for trait-like conformance checks.
 * Used when transpiled code needs to verify that a value implements required methods.
 * See https://docs.modular.com/mojo/manual/traits
 */

/**
 * @param {unknown} obj
 * @param {string} methodName
 * @returns {boolean}
 */
function hasMethod(obj, methodName) {
  return obj != null && typeof obj === 'object' && typeof obj[methodName] === 'function';
}

/**
 * Throws if obj does not have all of the given method names (trait conformance).
 * @param {unknown} obj
 * @param {string[]} methodNames
 * @returns {void}
 */
function requireTrait(obj, methodNames) {
  for (const name of methodNames) {
    if (!hasMethod(obj, name)) {
      throw new Error(`Trait conformance: missing required method '${name}'`);
    }
  }
}

module.exports = { hasMethod, requireTrait };
