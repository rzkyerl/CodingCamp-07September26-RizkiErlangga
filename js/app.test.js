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
  resolveTheme,
  formatTime,
  formatDate,
  getGreeting,
  buildGreetingMessage,
  formatTimer,
  validateDuration,
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

  // -------------------------------------------------------------------------
  // Property 22 (extended): resolveTheme returns the exact theme for valid values
  // Feature: todo-life-dashboard, Property 22: Theme persistence round-trip
  // -------------------------------------------------------------------------
  await test('Property 22 — resolveTheme returns identity for valid themes (Req 10.3)', () => {
    fc.assert(
      fc.property(validThemeArb, (theme) => {
        const resolved = resolveTheme(theme);
        assert.strictEqual(
          resolved,
          theme,
          `Expected resolveTheme("${theme}") to return "${theme}" but got "${resolved}"`
        );
        return true;
      }),
      { numRuns: 100 }
    );
  });

  // -------------------------------------------------------------------------
  // Property 22 (extended): Full Storage → resolveTheme round-trip
  // Feature: todo-life-dashboard, Property 22: Theme persistence round-trip
  // -------------------------------------------------------------------------
  await test('Property 22 — Full Storage + resolveTheme round-trip (Req 10.3)', () => {
    installMockLocalStorage();
    fc.assert(
      fc.property(validThemeArb, (theme) => {
        Storage.set(KEYS.THEME, theme);
        const loaded   = Storage.get(KEYS.THEME);
        const resolved = resolveTheme(loaded);
        assert.strictEqual(
          resolved,
          theme,
          `Expected full round-trip to return "${theme}" but resolveTheme("${loaded}") gave "${resolved}"`
        );
        return true;
      }),
      { numRuns: 100 }
    );
  });

  // -------------------------------------------------------------------------
  // Property 1: Time format is always HH:MM
  // Feature: todo-life-dashboard, Property 1: Time format is always HH:MM
  // -------------------------------------------------------------------------
  await test('Property 1 — formatTime always produces HH:MM format (Req 1.1)', () => {
    // Generate arbitrary timestamps covering the full 32-bit Unix range so
    // we exercise all 24 hours and all 60 minutes.
    const timestampArb = fc.integer({ min: 0, max: 2_147_483_647_000 });
    fc.assert(
      fc.property(timestampArb, (ts) => {
        const date   = new Date(ts);
        const result = formatTime(date);

        // Overall pattern: exactly "HH:MM"
        assert.match(
          result,
          /^\d{2}:\d{2}$/,
          `formatTime returned "${result}" — does not match \\d{2}:\\d{2}`
        );

        // Hour component must be in [0, 23]
        const hour = parseInt(result.slice(0, 2), 10);
        assert.ok(
          hour >= 0 && hour <= 23,
          `Hour component ${hour} is outside [0, 23]`
        );

        // Minute component must be in [0, 59]
        const minute = parseInt(result.slice(3, 5), 10);
        assert.ok(
          minute >= 0 && minute <= 59,
          `Minute component ${minute} is outside [0, 59]`
        );

        // Values must exactly match what the Date reports
        assert.strictEqual(
          result,
          String(date.getHours()).padStart(2, '0') + ':' + String(date.getMinutes()).padStart(2, '0'),
          `formatTime("${date.toISOString()}") = "${result}" but expected clock values`
        );

        return true;
      }),
      { numRuns: 100 }
    );
  });

  // -------------------------------------------------------------------------
  // Property 2: Date format matches "Weekday, DD MonthName YYYY"
  // Feature: todo-life-dashboard, Property 2: Date format matches "Weekday, DD MonthName YYYY"
  // -------------------------------------------------------------------------
  await test('Property 2 — formatDate always matches "Weekday, DD MonthName YYYY" (Req 1.2)', () => {
    const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const MONTHS   = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];
    const weekdayPattern = WEEKDAYS.join('|');
    const fullPattern    = new RegExp(
      `^(${weekdayPattern}), \\d{2} \\w+ \\d{4}$`
    );

    const timestampArb = fc.integer({ min: 0, max: 2_147_483_647_000 });
    fc.assert(
      fc.property(timestampArb, (ts) => {
        const date   = new Date(ts);
        const result = formatDate(date);

        // Overall pattern
        assert.match(
          result,
          fullPattern,
          `formatDate returned "${result}" — does not match expected pattern`
        );

        // Weekday must be the correct day
        const expectedWeekday = WEEKDAYS[date.getDay()];
        assert.ok(
          result.startsWith(expectedWeekday + ','),
          `Expected weekday "${expectedWeekday}" but got "${result.split(',')[0]}"`
        );

        // Month name must be correct
        const expectedMonth = MONTHS[date.getMonth()];
        assert.ok(
          result.includes(' ' + expectedMonth + ' '),
          `Expected month "${expectedMonth}" in "${result}"`
        );

        // Year must be correct (4-digit, at the end)
        const expectedYear = String(date.getFullYear());
        assert.ok(
          result.endsWith(expectedYear),
          `Expected year "${expectedYear}" at end of "${result}"`
        );

        return true;
      }),
      { numRuns: 100 }
    );
  });

  // -------------------------------------------------------------------------
  // Property 3: Greeting covers all hours exhaustively and without overlap
  // Feature: todo-life-dashboard, Property 3: Greeting covers all hours exhaustively and without overlap
  // -------------------------------------------------------------------------
  await test('Property 3 — getGreeting maps every hour to exactly one valid greeting (Req 1.3–1.6)', () => {
    const VALID_GREETINGS = new Set([
      'Good morning', 'Good afternoon', 'Good evening', 'Good night',
    ]);

    const hourArb = fc.integer({ min: 0, max: 23 });
    fc.assert(
      fc.property(hourArb, (hour) => {
        const result = getGreeting(hour);

        // Must be one of the four valid greetings
        assert.ok(
          VALID_GREETINGS.has(result),
          `getGreeting(${hour}) returned "${result}" which is not a valid greeting`
        );

        // Must match the exact time-range specification
        if (hour >= 5 && hour <= 11) {
          assert.strictEqual(result, 'Good morning',
            `Hour ${hour} (05–11) should be "Good morning" but got "${result}"`);
        } else if (hour >= 12 && hour <= 17) {
          assert.strictEqual(result, 'Good afternoon',
            `Hour ${hour} (12–17) should be "Good afternoon" but got "${result}"`);
        } else if (hour >= 18 && hour <= 20) {
          assert.strictEqual(result, 'Good evening',
            `Hour ${hour} (18–20) should be "Good evening" but got "${result}"`);
        } else {
          // 21–23 and 0–4
          assert.strictEqual(result, 'Good night',
            `Hour ${hour} (21–23 / 0–4) should be "Good night" but got "${result}"`);
        }

        return true;
      }),
      { numRuns: 100 }
    );
  });

  // -------------------------------------------------------------------------
  // Property 4: Greeting message includes name when name is non-empty
  // Feature: todo-life-dashboard, Property 4: Greeting message includes name when name is non-empty
  // -------------------------------------------------------------------------
  await test('Property 4 — buildGreetingMessage returns "greeting, name" for non-empty names (Req 2.2)', () => {
    // Non-empty trimmed name (1–50 chars with at least one non-whitespace char)
    const nonEmptyNameArb = fc.string({ minLength: 1, maxLength: 50 })
      .filter(s => s.trim().length > 0);
    // Arbitrary greeting string (any non-empty string)
    const greetingArb = fc.string({ minLength: 1, maxLength: 50 });

    fc.assert(
      fc.property(greetingArb, nonEmptyNameArb, (greeting, name) => {
        const trimmedName = name.trim();
        const result      = buildGreetingMessage(greeting, name);
        const expected    = greeting + ', ' + trimmedName;

        assert.strictEqual(
          result,
          expected,
          `buildGreetingMessage("${greeting}", "${name}") = "${result}" but expected "${expected}"`
        );

        return true;
      }),
      { numRuns: 100 }
    );
  });

  // -------------------------------------------------------------------------
  // Property 6: Timer format is always MM:SS
  // Feature: todo-life-dashboard, Property 6: Timer format is always MM:SS
  // -------------------------------------------------------------------------
  await test('Property 6 — formatTimer always produces MM:SS format (Req 3.1)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 7200 }), (seconds) => {
        const result = formatTimer(seconds);

        // Overall pattern: at least 2 digits for minutes, exactly 2 for seconds.
        // Minutes can exceed 2 digits for values >= 6000 s (100+ minutes) since
        // padStart(2) only pads when the value is shorter than 2 chars.
        assert.match(
          result,
          /^\d{2,}:\d{2}$/,
          `formatTimer(${seconds}) returned "${result}" — does not match \\d{2,}:\\d{2}`
        );

        // Minutes component must equal Math.floor(seconds / 60), zero-padded to min 2 digits
        const expectedMins = String(Math.floor(seconds / 60)).padStart(2, '0');
        // The minutes part is everything before the colon
        const colonIdx   = result.indexOf(':');
        const actualMins = result.slice(0, colonIdx);
        assert.strictEqual(
          actualMins,
          expectedMins,
          `formatTimer(${seconds}) minutes component "${actualMins}" !== expected "${expectedMins}"`
        );

        // Seconds component must equal seconds % 60, zero-padded
        const expectedSecs = String(seconds % 60).padStart(2, '0');
        const actualSecs   = result.slice(colonIdx + 1);
        assert.strictEqual(
          actualSecs,
          expectedSecs,
          `formatTimer(${seconds}) seconds component "${actualSecs}" !== expected "${expectedSecs}"`
        );

        return true;
      }),
      { numRuns: 100 }
    );
  });

  // -------------------------------------------------------------------------
  // Property 7: Duration validation accepts exactly the valid range
  // Feature: todo-life-dashboard, Property 7: Duration validation accepts exactly the valid range
  // -------------------------------------------------------------------------

  // Property 7a: valid integers in [1, 120] must return true
  await test('Property 7a — validateDuration returns true for all integers in [1, 120] (Req 3.9, 4.1, 4.4)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 120 }), (d) => {
        assert.strictEqual(
          validateDuration(d),
          true,
          `validateDuration(${d}) should be true but returned false`
        );
        return true;
      }),
      { numRuns: 100 }
    );
  });

  // Property 7b: out-of-range integers must return false
  await test('Property 7b — validateDuration returns false for out-of-range integers (Req 3.9, 4.1, 4.4)', () => {
    const outOfRangeArb = fc.integer().filter(d => d < 1 || d > 120);
    fc.assert(
      fc.property(outOfRangeArb, (d) => {
        assert.strictEqual(
          validateDuration(d),
          false,
          `validateDuration(${d}) should be false but returned true`
        );
        return true;
      }),
      { numRuns: 100 }
    );
  });

  // Property 7c: non-integer numbers must return false
  await test('Property 7c — validateDuration returns false for non-integer numbers (Req 3.9, 4.1, 4.4)', () => {
    // Generate doubles that are not whole integers (i.e. fractional part != 0)
    const nonIntegerDoubleArb = fc.double({ noNaN: true, noDefaultInfinity: true })
      .filter(d => !Number.isInteger(d));
    fc.assert(
      fc.property(nonIntegerDoubleArb, (d) => {
        assert.strictEqual(
          validateDuration(d),
          false,
          `validateDuration(${d}) should be false but returned true`
        );
        return true;
      }),
      { numRuns: 100 }
    );
  });

  // Property 7d: non-number values must return false
  await test('Property 7d — validateDuration returns false for non-number values (Req 3.9, 4.1, 4.4)', () => {
    const nonNumberValues = [null, undefined, NaN, '25', '1', '', true, false, {}, [], () => {}];
    for (const val of nonNumberValues) {
      assert.strictEqual(
        validateDuration(val),
        false,
        `validateDuration(${String(val)}) should be false but returned true`
      );
    }
  });

  // -------------------------------------------------------------------------
  // Property 8 (semantic): Pomodoro duration localStorage round-trip
  // Feature: todo-life-dashboard, Property 8: Pomodoro duration localStorage round-trip
  //
  // For any integer d in [1, 120]:
  //   1. Save String(d) to Storage under KEYS.DURATION.
  //   2. Read it back with Storage.get, parse with parseInt(result, 10).
  //   3. The parsed integer must equal d.
  //   4. validateDuration(parsed) must return true.
  // -------------------------------------------------------------------------
  await test('Property 8 (semantic) — Pomodoro duration: parseInt(Storage.get()) === d (Req 4.3)', () => {
    installMockLocalStorage();
    fc.assert(
      fc.property(validDurationArb, (d) => {
        // Persist as string (mirrors how Timer.setDuration stores the value).
        Storage.set(KEYS.DURATION, String(d));

        // Load back and parse.
        const loaded = Storage.get(KEYS.DURATION);
        const parsed = parseInt(loaded, 10);

        // The round-tripped integer must equal the original value.
        assert.strictEqual(
          parsed,
          d,
          `Expected parseInt(Storage.get(KEYS.DURATION)) = ${d} but got ${parsed}`
        );

        // The parsed value must still pass duration validation.
        assert.strictEqual(
          validateDuration(parsed),
          true,
          `validateDuration(${parsed}) should be true for d=${d}`
        );

        return true;
      }),
      { numRuns: 120 }  // run once per possible valid duration value
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
