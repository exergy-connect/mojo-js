#!/usr/bin/env node
/**
 * Test runner: runs construct and extension fixtures through parse → emit → run,
 * captures stdout, and asserts the output contains "OK: <construct_name>".
 * Usage: node test/run-tests.js
 *
 * - test/constructs/*.mojo — core language (no features)
 * - test/extensions/<feature>/*.mojo — experimental packs; feature name = directory
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { parse } = require('../src/parser.js');
const { emitProgram } = require('../src/emit.js');
const runtime = require('../src/runtime.js');

const CONSTRUCTS_DIR = path.join(__dirname, 'constructs');
const EXTENSIONS_DIR = path.join(__dirname, 'extensions');
const argvBase = [path.join(CONSTRUCTS_DIR, 'dummy.mojo')];

function listMojo(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.mojo')).sort();
}

function runOne(mojoPath, argv = argvBase, features = []) {
  const source = fs.readFileSync(mojoPath, 'utf8');
  const options = { features };
  const program = parse(source, options);
  const jsCode = emitProgram(program, '__runtime', options);
  const logs = [];
  const origLog = console.log;
  console.log = (...args) => logs.push(args.map(String).join(' '));
  try {
    const compiled = eval(jsCode);
    const mainFn = compiled(runtime);
    mainFn(argv.length ? argv : [mojoPath]);
  } finally {
    console.log = origLog;
  }
  return logs.join('\n');
}

/** @returns {{ name: string, path: string, features: string[] }[]} */
function collectOkFixtures() {
  const fixtures = [];
  for (const file of listMojo(CONSTRUCTS_DIR)) {
    const name = path.basename(file, '.mojo');
    if (name.startsWith('expect_error_')) continue;
    fixtures.push({ name, path: path.join(CONSTRUCTS_DIR, file), features: [] });
  }
  if (fs.existsSync(EXTENSIONS_DIR)) {
    for (const feature of fs.readdirSync(EXTENSIONS_DIR).sort()) {
      const dir = path.join(EXTENSIONS_DIR, feature);
      if (!fs.statSync(dir).isDirectory()) continue;
      for (const file of listMojo(dir)) {
        const name = path.basename(file, '.mojo');
        if (name.startsWith('expect_error_')) continue;
        fixtures.push({ name, path: path.join(dir, file), features: [feature] });
      }
    }
  }
  return fixtures;
}

/** @returns {{ name: string, path: string, features: string[] }[]} */
function collectErrorFixtures() {
  const fixtures = [];
  for (const file of listMojo(CONSTRUCTS_DIR)) {
    const name = path.basename(file, '.mojo');
    if (!name.startsWith('expect_error_')) continue;
    fixtures.push({ name, path: path.join(CONSTRUCTS_DIR, file), features: [] });
  }
  if (fs.existsSync(EXTENSIONS_DIR)) {
    for (const feature of fs.readdirSync(EXTENSIONS_DIR).sort()) {
      const dir = path.join(EXTENSIONS_DIR, feature);
      if (!fs.statSync(dir).isDirectory()) continue;
      for (const file of listMojo(dir)) {
        const name = path.basename(file, '.mojo');
        if (!name.startsWith('expect_error_')) continue;
        fixtures.push({ name, path: path.join(dir, file), features: [feature] });
      }
    }
  }
  return fixtures;
}

function main() {
  let passed = 0;
  let failed = 0;
  /** Extra checks for block-structure tests: output must contain these in order and must not contain forbidden. */
  const blockStructureChecks = {
    if_else_nested: {
      containsInOrder: ['outer-then', 'inner-else', 'after-inner', 'after-outer'],
      mustNotContain: ['inner-then', 'outer-else'],
    },
  };

  for (const fixture of collectOkFixtures()) {
    const { name, path: mojoPath, features } = fixture;
    const expected = `OK: ${name}`;
    try {
      const out = runOne(mojoPath, argvBase, features);
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

  for (const fixture of collectErrorFixtures()) {
    const { name, path: mojoPath, features } = fixture;
    try {
      const source = fs.readFileSync(mojoPath, 'utf8');
      parse(source, { features });
      failed++;
      console.error(`  ✗ ${name} (expected parse/tokenize error, none thrown)`);
    } catch (e) {
      try {
        const hasLine = e.message.includes('line');
        if (features.length > 0) {
          const ok =
            e.message.includes('requires risk') ||
            e.message.includes('Conditional risk') ||
            (hasLine &&
              (e.message.includes('Expected risk identifier') ||
                e.message.includes('got number') ||
                e.message.includes('Unknown risk')));
          assert(ok, `Expected feature parse/check error, got: ${e.message}`);
        } else {
          const hasKeywordError =
            e.message.includes('Unknown keyword') || e.message.includes("Expected 'struct'");
          assert(hasLine && hasKeywordError, `Expected error with line and keyword message, got: ${e.message}`);
        }
        passed++;
        console.log(`  ✓ ${name}`);
      } catch (assertErr) {
        failed++;
        console.error(`  ✗ ${name}`);
        console.error(`    ${assertErr.message}`);
      }
    }
  }

  console.log('');
  console.log(`${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
