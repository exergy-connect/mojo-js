#!/usr/bin/env node
/**
 * Unit tests for the runtime. Run: node test/runtime-test.js
 */

const assert = require('assert');
const runtime = require('../src/runtime.js');

const { argv, atol, print, range, rangeFromTo, len, b64encode, b64decode } = runtime;

function run(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    return true;
  } catch (e) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${e.message}`);
    return false;
  }
}

function main() {
  let passed = 0;
  let failed = 0;

  run('argv returns array', () => {
    const a = argv(['node', 'script.mojo', '1', '2']);
    assert(Array.isArray(a));
    assert.strictEqual(a.length, 4);
    assert.strictEqual(a[2], '1');
  }) ? passed++ : failed++;

  run('atol integer string', () => {
    assert.strictEqual(atol('42'), 42);
    assert.strictEqual(atol('0'), 0);
    assert.strictEqual(atol('-7'), -7);
  }) ? passed++ : failed++;

  run('atol bigint for safe integer', () => {
    const n = atol('9007199254740993');
    assert.strictEqual(typeof n, 'bigint');
    assert.strictEqual(n, 9007199254740993n);
  }) ? passed++ : failed++;

  run('print', () => {
    const logs = [];
    const orig = console.log;
    console.log = (...args) => logs.push(args.map(String).join(' '));
    try {
      print('a', 1, true);
      assert.strictEqual(logs.length, 1);
      assert.strictEqual(logs[0], 'a 1 true');
    } finally {
      console.log = orig;
    }
  }) ? passed++ : failed++;

  run('range(n)', () => {
    const r = range(3);
    assert.deepStrictEqual(r, [0, 1, 2]);
    assert.strictEqual(range(0).length, 0);
  }) ? passed++ : failed++;

  run('rangeFromTo(start, end)', () => {
    const r = rangeFromTo(2, 5);
    assert.deepStrictEqual(r, [2, 3, 4]);
    assert.strictEqual(rangeFromTo(0, 0).length, 0);
  }) ? passed++ : failed++;

  run('len', () => {
    assert.strictEqual(len([]), 0);
    assert.strictEqual(len([1, 2, 3]), 3);
    assert.strictEqual(len('abc'), 3);
  }) ? passed++ : failed++;

  run('b64encode / b64decode roundtrip', () => {
    const s = 'hello';
    const enc = b64encode(s);
    assert.strictEqual(typeof enc, 'string');
    assert.strictEqual(b64decode(enc), s);
  }) ? passed++ : failed++;

  run('b64encode empty', () => {
    const enc = b64encode('');
    assert.strictEqual(enc, '');
    assert.strictEqual(b64decode(''), '');
  }) ? passed++ : failed++;

  console.log('');
  console.log(`${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
