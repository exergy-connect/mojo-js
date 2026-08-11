/**
 * Browser entry: bundle parse + emit + runtime, expose runMojo(source, argv[, options]).
 * Used by esbuild to produce dist/mojo-js.min.js.
 */
const { parse } = require('../src/parser.js');
const { emitProgram } = require('../src/emit.js');
const runtime = require('../src/runtime.js');

function runMojo(source, argv = [], options = {}) {
  const program = parse(source, options);
  const jsCode = emitProgram(program, '__runtime', options);
  const compiled = eval(jsCode);
  const mainFn = compiled(runtime);
  mainFn(argv);
}

function transpileMojo(source, options = {}) {
  const program = parse(source, options);
  return emitProgram(program, '__runtime', options);
}

if (typeof window !== 'undefined') {
  window.runMojo = runMojo;
  window.transpileMojo = transpileMojo;
}
if (typeof globalThis !== 'undefined') {
  globalThis.runMojo = runMojo;
  globalThis.transpileMojo = transpileMojo;
}
