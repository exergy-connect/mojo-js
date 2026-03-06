/**
 * Browser entry: bundle parse + emit + runtime, expose runMojo(source, argv).
 * Used by esbuild to produce dist/mojo-js.min.js.
 */
const { parse } = require('../src/parser.js');
const { emitProgram } = require('../src/emit.js');
const runtime = require('../src/runtime.js');

function runMojo(source, argv = []) {
  const program = parse(source);
  const jsCode = emitProgram(program);
  const compiled = eval(jsCode);
  const mainFn = compiled(runtime);
  mainFn(argv);
}

function transpileMojo(source) {
  const program = parse(source);
  return emitProgram(program);
}

if (typeof window !== 'undefined') {
  window.runMojo = runMojo;
  window.transpileMojo = transpileMojo;
}
if (typeof globalThis !== 'undefined') {
  globalThis.runMojo = runMojo;
  globalThis.transpileMojo = transpileMojo;
}
