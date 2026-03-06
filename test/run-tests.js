#!/usr/bin/env node
/**
 * Test runner: runs each tests/constructs/*.mojo file through parse → emit → run,
 * captures stdout, and asserts the output contains "OK: <construct_name>".
 * Usage: node test/run-tests.js
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { parse } = require('../src/parser.js');
const { emitProgram } = require('../src/emit.js');
const runtime = require('../src/runtime.js');

const TESTS_DIR = path.join(__dirname, 'constructs');
const argvBase = [path.join(TESTS_DIR, 'dummy.mojo')];

function runOne(mojoPath, argv = argvBase) {
  const source = fs.readFileSync(mojoPath, 'utf8');
  const program = parse(source);
  const jsCode = emitProgram(program);
  const logs = [];
  const origLog = console.log;
  console.log = (...args) => logs.push(args.map(String).join(' '));
  try {
    const compiled = eval(jsCode);
    const mainFn = compiled(runtime);
    mainFn(argv.length ? argv : [path.join(TESTS_DIR, path.basename(mojoPath))]);
  } finally {
    console.log = origLog;
  }
  return logs.join('\n');
}

function main() {
  const files = fs.readdirSync(TESTS_DIR).filter((f) => f.endsWith('.mojo')).sort();
  let passed = 0;
  let failed = 0;
  for (const file of files) {
    const name = path.basename(file, '.mojo');
    const mojoPath = path.join(TESTS_DIR, file);
    const expected = `OK: ${name}`;
    try {
      const out = runOne(mojoPath);
      assert(out.includes(expected), `Expected output to contain "${expected}", got:\n${out}`);
      passed++;
      console.log(`  ✓ ${name}`);
    } catch (e) {
      failed++;
      console.error(`  ✗ ${name}`);
      console.error(`    ${e.message}`);
    }
  }
  console.log('');
  console.log(`${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
