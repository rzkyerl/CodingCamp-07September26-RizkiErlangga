/* ============================================================
   Todo Life Dashboard — js/app.test.js
   Property-based tests using fast-check.
   Run with: node js/app.test.js
   ============================================================ */

'use strict';

const assert = require('assert');
const fc = require('fast-check');

// ---------------------------------------------------------------------------
// Import pure helpers from app.js.
// The Node.js export guard at the bottom of app.js makes this safe.
// ---------------------------------------------------------------------------
const {
  Storage,
  KEYS,
  serializeTasks,
  deserializeTasks,
  serializeLinks,
  deserializeLinks,
} = require('./app.js');

// ---------------------------------------------------------------------------
// Mock localStorage
// Provides an in-memory replacement that satisfies the Storage module's
// localStorage calls when running under Node.js (which has no native
// localStorage). We reset it before each Storage-dependent test so tests
// are fully isolated.
// ---------------------------------------------------------------------------
function createMockLocalStorage() {
  const store = {};
  return {
    getItem(key)         { return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null; },
    setItem(key, value)  { store[key] = String(value); },
    removeItem(key)      { delete store[key]; },
    clear()              { Object.keys(store).forEach(k => delete store[k]); },
  };
}

function installMockLocalStorage() {
  const mock = createMockLocalStorage();
  global.localStorage = mock;
  return mock;
}

// ---------------------------------------------------------------------------
// Small test harness — collects pass/fail, prints a summary, exits non-zero
// if any test failed.
// ---------------------------------------------------------------------------
const results = [];

async function test(name, fn) {
  try {
    await fn();
    results.push({ name, passed: true });
    process.stdout.write(`  ✓  ${name}\n`);
  } catch (err) {
    results.push({ name, passed: false, error: err });
    process.stdout.write(`  ✗  ${name}\n     ${err.message || err}\n`);
  }
}

// ---------------------------------------------------------------------------
// Arbitraries (smart generators)
// ---------------------------------------------------------------------------

// Valid custom name: 1–50 chars with at least one non-whitespace character.
// We build it as: a non-whitespace printable char + up to 49 printable chars.
const printableCharArb = fc.string({ minLength: 1, maxLength: 1 }).filter(c => /\S/.test(c));
const validNameArb = fc.tuple(
  printableCharArb,                                              // at least one non-ws char
  fc.string({ minLength: 0, maxLength: 49 })                   // optional tail (any string)
).map(([head, tail]) => (head + tail).slice(0, 50));            // cap at 50 chars

// Valid Pomodoro duration: integer in [1, 120].
const validDurationArb = fc.integer({ min: 1, max: 120 });

// Valid sort options.
const validSortArb = fc.constantFrom('default', 'az', 'za');

// Valid theme values.
const validThemeArb = fc.constantFrom('light', 'dark');

// Valid Task object (shape matches data model in design.md).
// Map through Object.assign to ensure plain Object prototype (fc.record in v4
// creates null-prototype objects, which would cause deepStrictEqual to fail
// against JSON.parse output that always returns plain objects).
const validTaskArb = fc.record({
  id:        fc.uuid(),
  title:     fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0),
  completed: fc.boolean(),
  createdAt: fc.integer({ min: 0, max: Number.MAX_SAFE_INTEGER }),
}).map(t => Object.assign({}, t));

// Array of up to 100 valid Tasks (no duplicate ids guaranteed by fast-check's
// uniqueArray when using the id extractor).
const validTasksArb = fc.uniqueArray(validTaskArb, { maxLength: 100, selector: t => t.id });

// Valid Link object (shape matches data model in design.md).
// Map through Object.assign to ensure plain Object prototype (same reason as tasks).
const validLinkArb = fc.record({
  id:   fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
  url:  fc.webUrl({ validSchemes: ['http', 'https'] }).filter(u => u.length <= 2048),
}).map(l => Object.assign({}, l));

// Array of up to 20 valid Links (unique ids).
const validLinksArb = fc.uniqueArray(validLinkArb, { maxLength: 20, selector: l => l.id });

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

(async () => {
  process.stdout.write('\nTodo Life Dashboard — Property-Based Tests\n');
  process.stdout.write('===========================================\n\n');

  // -------------------------------------------------------------------------
  // Property 5: Custom name localStorage round-trip
  // Feature: todo-life-dashboard, Property 5: Custom name localStorage round-trip
  // -------------------------------------------------------------------------
  await test('Property 5 — Custom name localStorage round-trip (Req 2.3)', () => {
    installMockLocalStorage();
    fc.assert(
      fc.property(validNameArb, (name) => {
        const trimmed = name.trim();
        // Only proceed if trimmed name is non-empty (the arbitrary guarantees this,
        // but guard defensively).
        if (trimmed.length === 0) return true;

        Storage.set(KEYS.NAME, trimmed);
        const loaded = Storage.get(KEYS.NAME);
        assert.strictEqual(
          loaded,
          trimmed,
          `Expected "${trimmed}" but got "${loaded}"`
        );
        return true;
      }),
      { numRuns: 100 }
    );
  });

  // -------------------------------------------------------------------------
  // Property 8: Pomodoro duration localStorage round-trip
  // Feature: todo-life-dashboard, Property 8: Pomodoro duration localStorage round-trip
  // -------------------------------------------------------------------------
  await test('Property 8 — Pomodoro duration localStorage round-trip (Req 4.3)', () => {
    installMockLocalStorage();
    fc.assert(
      fc.property(validDurationArb, (d) => {
        Storage.set(KEYS.DURATION, String(d));
        const loaded = Storage.get(KEYS.DURATION);
        assert.strictEqual(
          loaded,
          String(d),
          `Expected "${String(d)}" but got "${loaded}"`
        );
        return true;
      }),
      { numRuns: 100 }
    );
  });

  // -------------------------------------------------------------------------
  // Property 14: Task collection localStorage round-trip
  // Feature: todo-life-dashboard, Property 14: Task collection localStorage round-trip
  // Tests serialize/deserialize as pure functions — no localStorage needed.
  // -------------------------------------------------------------------------
  await test('Property 14 — Task collection serialize/deserialize round-trip (Req 6.1, 6.2)', () => {
    fc.assert(
      fc.property(validTasksArb, (tasks) => {
        const serialised = serializeTasks(tasks);
        const restored   = deserializeTasks(serialised);

        assert.deepStrictEqual(
          restored,
          tasks,
          `Round-trip failed for ${tasks.length} tasks`
        );
        return true;
      }),
      { numRuns: 100 }
    );
  });

  // -------------------------------------------------------------------------
  // Property 17: Sort preference localStorage round-trip
  // Feature: todo-life-dashboard, Property 17: Sort preference localStorage round-trip
  // -------------------------------------------------------------------------
  await test('Property 17 — Sort preference localStorage round-trip (Req 8.5, 8.6)', () => {
    installMockLocalStorage();
    fc.assert(
      fc.property(validSortArb, (option) => {
        Storage.set(KEYS.SORT, option);
        const loaded = Storage.get(KEYS.SORT);
        assert.strictEqual(
          loaded,
          option,
          `Expected "${option}" but got "${loaded}"`
        );
        return true;
      }),
      { numRuns: 100 }
    );
  });

  // -------------------------------------------------------------------------
  // Property 21: Link collection localStorage round-trip
  // Feature: todo-life-dashboard, Property 21: Link collection localStorage round-trip
  // Tests serialize/deserialize as pure functions — no localStorage needed.
  // -------------------------------------------------------------------------
  await test('Property 21 — Link collection serialize/deserialize round-trip (Req 9.6, 9.7)', () => {
    fc.assert(
      fc.property(validLinksArb, (links) => {
        const serialised = serializeLinks(links);
        const restored   = deserializeLinks(serialised);

        assert.deepStrictEqual(
          restored,
          links,
          `Round-trip failed for ${links.length} links`
        );
        return true;
      }),
      { numRuns: 100 }
    );
  });

  // -------------------------------------------------------------------------
  // Property 22: Theme persistence round-trip
  // Feature: todo-life-dashboard, Property 22: Theme persistence round-trip
  // -------------------------------------------------------------------------
  await test('Property 22 — Theme persistence localStorage round-trip (Req 10.3)', () => {
    installMockLocalStorage();
    fc.assert(
      fc.property(validThemeArb, (theme) => {
        Storage.set(KEYS.THEME, theme);
        const loaded = Storage.get(KEYS.THEME);
        assert.strictEqual(
          loaded,
          theme,
          `Expected "${theme}" but got "${loaded}"`
        );
        return true;
      }),
      { numRuns: 100 }
    );
  });

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total  = results.length;

  process.stdout.write('\n-------------------------------------------\n');
  process.stdout.write(`Results: ${passed}/${total} passed`);
  if (failed > 0) {
    process.stdout.write(`, ${failed} failed`);
  }
  process.stdout.write('\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.stdout.write('All property-based tests passed.\n\n');
    process.exit(0);
  }
})();
