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
  const allFiles = fs.readdirSync(TESTS_DIR).filter((f) => f.endsWith('.mojo')).sort();
  const expectErrorPrefix = 'expect_error_';
  const okFiles = allFiles.filter((f) => !path.basename(f, '.mojo').startsWith(expectErrorPrefix));
  const errorFiles = allFiles.filter((f) => path.basename(f, '.mojo').startsWith(expectErrorPrefix));
  let passed = 0;
  let failed = 0;
  /** Extra checks for block-structure tests: output must contain these in order and must not contain forbidden. */
  const blockStructureChecks = {
    if_else_nested: {
      containsInOrder: ['outer-then', 'inner-else', 'after-inner', 'after-outer'],
      mustNotContain: ['inner-then', 'outer-else'],
    },
  };
  for (const file of okFiles) {
    const name = path.basename(file, '.mojo');
    const mojoPath = path.join(TESTS_DIR, file);
    const expected = `OK: ${name}`;
    try {
      const out = runOne(mojoPath);
      assert(out.includes(expected), `Expected output to contain "${expected}", got:\n${out}`);
      const checks = blockStructureChecks[name];
      if (checks) {
        let lastIdx = -1;
        for (const s of checks.containsInOrder) {
          const idx = out.indexOf(s);
          assert(idx !== -1, `Expected output to contain "${s}", got:\n${out}`);
          assert(idx > lastIdx, `Expected "${s}" after previous markers, got:\n${out}`);
          lastIdx = idx;
        }
        for (const s of checks.mustNotContain) {
          assert(!out.includes(s), `Output must not contain "${s}" (wrong block), got:\n${out}`);
        }
      }
      passed++;
      console.log(`  ✓ ${name}`);
    } catch (e) {
      failed++;
      console.error(`  ✗ ${name}`);
      console.error(`    ${e.message}`);
    }
  }
  for (const file of errorFiles) {
    const name = path.basename(file, '.mojo');
    const mojoPath = path.join(TESTS_DIR, file);
    try {
      const source = fs.readFileSync(mojoPath, 'utf8');
      parse(source);
      failed++;
      console.error(`  ✗ ${name} (expected parse/tokenize error, none thrown)`);
    } catch (e) {
      const hasLine = e.message.includes('line');
      const hasKeywordError = e.message.includes('Unknown keyword') || e.message.includes("Expected 'struct'");
      assert(hasLine && hasKeywordError, `Expected error with line and keyword message, got: ${e.message}`);
      passed++;
      console.log(`  ✓ ${name}`);
    }
  }
  console.log('');
  console.log(`${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
