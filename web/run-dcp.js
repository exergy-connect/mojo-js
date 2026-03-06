#!/usr/bin/env node
/**
 * Run a Mojo file with the DCP runtime (compute, progress, job).
 * Usage: node web/run-dcp.js web/dcp-example.mojo
 */
const path = require('path');
const fs = require('fs');
const { parse } = require('../src/parser.js');
const { emitProgram } = require('../src/emit.js');
const runtime = require('../src/runtime.js');
const { compute, progress } = require('./dcp-runtime.js');

const runtimeWithDcp = { ...runtime, compute, progress };

function main() {
  const mojoPath = process.argv[2] || path.join(__dirname, 'dcp-example.mojo');
  const source = fs.readFileSync(mojoPath, 'utf8');
  const program = parse(source);
  const jsCode = emitProgram(program);
  const compiled = eval(jsCode);
  const mainFn = compiled(runtimeWithDcp);
  mainFn([mojoPath]);
}

main();
