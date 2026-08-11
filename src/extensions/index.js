/**
 * Named language-extension registry for experimental Mojo syntax POCs.
 */

const risk = require('./risk/index.js');

const EXTENSIONS = Object.freeze({
  risk,
});

/**
 * @param {string} name
 * @returns {object}
 */
function getExtension(name) {
  const ext = EXTENSIONS[name];
  if (!ext) {
    throw new Error(`Unknown language feature '${name}'. Available: ${Object.keys(EXTENSIONS).join(', ') || '(none)'}`);
  }
  return ext;
}

/**
 * @param {string[]} names
 * @returns {object[]}
 */
function resolveExtensions(names) {
  const seen = new Set();
  const out = [];
  for (const name of names || []) {
    if (seen.has(name)) continue;
    seen.add(name);
    out.push(getExtension(name));
  }
  return out;
}

/**
 * Merge keyword maps from resolved extensions.
 * @param {object[]} extensions
 * @returns {Record<string, string>}
 */
function collectExtraKeywords(extensions) {
  const extra = {};
  for (const ext of extensions) {
    for (const kw of ext.keywords || []) {
      extra[kw.word] = kw.tokenType;
    }
  }
  return extra;
}

/**
 * Flatten statement handlers from resolved extensions.
 * @param {object[]} extensions
 * @returns {Function[]}
 */
function collectStatementHandlers(extensions) {
  const handlers = [];
  for (const ext of extensions) {
    for (const h of ext.statementHandlers || []) handlers.push(h);
  }
  return handlers;
}

/**
 * Merge emit statement handlers keyed by AST type tag.
 * @param {object[]} extensions
 * @returns {Record<string, Function>}
 */
function collectEmitStatementHandlers(extensions) {
  const handlers = {};
  for (const ext of extensions) {
    Object.assign(handlers, ext.emitStatementHandlers || {});
  }
  return handlers;
}

module.exports = {
  EXTENSIONS,
  getExtension,
  resolveExtensions,
  collectExtraKeywords,
  collectStatementHandlers,
  collectEmitStatementHandlers,
};
