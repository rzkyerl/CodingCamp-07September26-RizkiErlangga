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
  validateLink,
  createLink,
  deleteLink,
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

  // -------------------------------------------------------------------------
  // Property 18: Adding a valid link increases link count by exactly one
  // Feature: todo-life-dashboard, Property 18: Adding a valid link increases link count by exactly one
  // -------------------------------------------------------------------------
  await test('Property 18 — createLink + push increases link count by exactly one (Req 9.2)', () => {
    // Generate a links array with 0–19 items (capacity < 20) plus a new valid link.
    const existingLinksArb = fc.uniqueArray(validLinkArb, { maxLength: 19, selector: l => l.id });
    // New link inputs: valid name (1–50 non-whitespace chars) and valid URL.
    const validNewNameArb = fc.string({ minLength: 1, maxLength: 50 })
      .filter(s => s.trim().length > 0);
    const validNewUrlArb = fc.webUrl({ validSchemes: ['http', 'https'] })
      .filter(u => u.length <= 2048);

    fc.assert(
      fc.property(existingLinksArb, validNewNameArb, validNewUrlArb, (links, name, url) => {
        const before = links.length;

        // Verify validateLink accepts this submission (capacity check).
        const { valid } = validateLink(name, url, before);
        assert.strictEqual(valid, true,
          `validateLink("${name}", "${url}", ${before}) should be valid`);

        // createLink produces a well-shaped object.
        const newLink = createLink(name, url);
        assert.ok(typeof newLink.id   === 'string', 'new link must have an id');
        assert.strictEqual(newLink.name, name.trim(), 'name must be trimmed');
        assert.strictEqual(newLink.url,  url,          'url must be preserved as-is');

        // Pushing the new link increases the array length by exactly 1.
        const after = [...links, newLink];
        assert.strictEqual(
          after.length,
          before + 1,
          `Expected length ${before + 1} but got ${after.length}`
        );

        // The new element is reachable at the end with the correct name and url.
        const inserted = after[after.length - 1];
        assert.strictEqual(inserted.name, name.trim(), 'inserted link name mismatch');
        assert.strictEqual(inserted.url,  url,          'inserted link url mismatch');

        return true;
      }),
      { numRuns: 100 }
    );
  });

  // -------------------------------------------------------------------------
  // Property 19: Link validation rejects all invalid inputs
  // Feature: todo-life-dashboard, Property 19: Link validation rejects all invalid inputs
  // -------------------------------------------------------------------------

  // 19a: empty name is always rejected.
  await test('Property 19a — validateLink rejects empty name (Req 9.3)', () => {
    const countArb = fc.integer({ min: 0, max: 19 });
    const validUrlForRejectionArb = fc.webUrl({ validSchemes: ['http', 'https'] })
      .filter(u => u.length <= 2048);

    fc.assert(
      fc.property(countArb, validUrlForRejectionArb, (count, url) => {
        // Empty name variations: '', '   ', '\t', '\n'
        for (const emptyName of ['', '   ', '\t', '\n']) {
          const result = validateLink(emptyName, url, count);
          assert.strictEqual(
            result.valid,
            false,
            `validateLink("${emptyName}", url, ${count}) should be invalid (empty name)`
          );
        }
        return true;
      }),
      { numRuns: 100 }
    );
  });

  // 19b: name exceeding 50 characters is always rejected.
  await test('Property 19b — validateLink rejects name > 50 chars (Req 9.3)', () => {
    const longNameArb = fc.string({ minLength: 51, maxLength: 200 });
    const countArb = fc.integer({ min: 0, max: 19 });
    const validUrlForRejectionArb = fc.webUrl({ validSchemes: ['http', 'https'] })
      .filter(u => u.length <= 2048);

    fc.assert(
      fc.property(longNameArb, countArb, validUrlForRejectionArb, (name, count, url) => {
        // Only test if the name actually has > 50 trimmed chars.
        if (name.trim().length <= 50) return true;
        const result = validateLink(name, url, count);
        assert.strictEqual(
          result.valid,
          false,
          `validateLink("${name.slice(0, 20)}…", url, ${count}) should be invalid (name > 50 chars)`
        );
        return true;
      }),
      { numRuns: 100 }
    );
  });

  // 19c: URL that does not start with http:// or https:// is always rejected.
  await test('Property 19c — validateLink rejects URLs without http:// or https:// prefix (Req 9.3)', () => {
    // Generate strings that do NOT match /^https?:\/\//i
    const invalidUrlArb = fc.string({ minLength: 1, maxLength: 100 })
      .filter(s => !/^https?:\/\//i.test(s));
    const validNameForRejectionArb = fc.string({ minLength: 1, maxLength: 50 })
      .filter(s => s.trim().length > 0);
    const countArb = fc.integer({ min: 0, max: 19 });

    fc.assert(
      fc.property(invalidUrlArb, validNameForRejectionArb, countArb, (url, name, count) => {
        const result = validateLink(name, url, count);
        assert.strictEqual(
          result.valid,
          false,
          `validateLink(name, "${url}", ${count}) should be invalid (bad URL prefix)`
        );
        return true;
      }),
      { numRuns: 100 }
    );
  });

  // 19d: URL exceeding 2048 characters is always rejected.
  await test('Property 19d — validateLink rejects URLs > 2048 chars (Req 9.3)', () => {
    // Build URLs that are valid in prefix but too long.
    const tooLongUrlArb = fc.string({ minLength: 2042, maxLength: 3000 })
      .map(s => 'https://' + s)
      .filter(u => u.length > 2048);
    const validNameForRejectionArb = fc.string({ minLength: 1, maxLength: 50 })
      .filter(s => s.trim().length > 0);
    const countArb = fc.integer({ min: 0, max: 19 });

    fc.assert(
      fc.property(tooLongUrlArb, validNameForRejectionArb, countArb, (url, name, count) => {
        const result = validateLink(name, url, count);
        assert.strictEqual(
          result.valid,
          false,
          `validateLink(name, url[${url.length}], ${count}) should be invalid (URL > 2048 chars)`
        );
        return true;
      }),
      { numRuns: 100 }
    );
  });

  // 19e: count >= 20 is always rejected regardless of name/url validity.
  await test('Property 19e — validateLink rejects when capacity reached (count >= 20) (Req 9.9)', () => {
    const atCapacityCountArb = fc.integer({ min: 20, max: 100 });
    const validNameForRejectionArb = fc.string({ minLength: 1, maxLength: 50 })
      .filter(s => s.trim().length > 0);
    const validUrlForCapacityArb = fc.webUrl({ validSchemes: ['http', 'https'] })
      .filter(u => u.length <= 2048);

    fc.assert(
      fc.property(atCapacityCountArb, validNameForRejectionArb, validUrlForCapacityArb, (count, name, url) => {
        const result = validateLink(name, url, count);
        assert.strictEqual(
          result.valid,
          false,
          `validateLink(name, url, ${count}) should be invalid (count >= 20)`
        );
        return true;
      }),
      { numRuns: 100 }
    );
  });

  // -------------------------------------------------------------------------
  // Property 20: Deleting a link removes exactly that link
  // Feature: todo-life-dashboard, Property 20: Deleting a link removes exactly that link
  // -------------------------------------------------------------------------
  await test('Property 20 — deleteLink removes exactly the targeted link (Req 9.5)', () => {
    // Need at least 1 link to delete; pick from an array of 1–20 items.
    const nonEmptyLinksArb = fc.uniqueArray(validLinkArb, { minLength: 1, maxLength: 20, selector: l => l.id });

    fc.assert(
      fc.property(nonEmptyLinksArb, fc.integer({ min: 0, max: 19 }), (links, indexSeed) => {
        // Pick a valid index within the actual array length.
        const idx        = indexSeed % links.length;
        const targetId   = links[idx].id;
        const before     = links.length;

        const result = deleteLink(links, targetId);

        // Length decreased by exactly 1.
        assert.strictEqual(
          result.length,
          before - 1,
          `Expected length ${before - 1} after deletion but got ${result.length}`
        );

        // The deleted id is no longer present.
        const stillPresent = result.some(l => l.id === targetId);
        assert.strictEqual(
          stillPresent,
          false,
          `Link with id "${targetId}" should be absent after deleteLink`
        );

        // All other links are still present (no accidental removals).
        const survivingIds = new Set(result.map(l => l.id));
        for (const l of links) {
          if (l.id === targetId) continue;
          assert.ok(
            survivingIds.has(l.id),
            `Link "${l.id}" should still be present after deleting "${targetId}"`
          );
        }

        // Original array is not mutated.
        assert.strictEqual(
          links.length,
          before,
          'deleteLink must not mutate the original array'
        );

        return true;
      }),
      { numRuns: 100 }
    );
  });

  // -------------------------------------------------------------------------
  // Property 21: Link collection localStorage round-trip
  // Feature: todo-life-dashboard, Property 21: Link collection localStorage round-trip
  // Already tested above (pure serialize/deserialize round-trip).
  // This additional pass focuses on the full localStorage path via Storage.
  // -------------------------------------------------------------------------
  await test('Property 21 — serializeLinks/deserializeLinks round-trip (Req 9.6, 9.7)', () => {
    // Already covered by the earlier pure-function test; this companion test
    // exercises the Storage-backed path.
    installMockLocalStorage();
    fc.assert(
      fc.property(validLinksArb, (links) => {
        Storage.set(KEYS.LINKS, serializeLinks(links));
        const loaded   = Storage.get(KEYS.LINKS);
        const restored = deserializeLinks(loaded);

        assert.deepStrictEqual(
          restored,
          links,
          `Storage round-trip failed for ${links.length} links`
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

// NOTE: Properties 9–16 are appended below. They run inside the same
// IIFE as the tests above, but because the IIFE has already been defined
// and self-invoked, we re-open the stream by appending stand-alone async
// IIFE blocks that push into the same `results` array and print their own
// summary line. A combined process.exit is handled at the very end.

// ---------------------------------------------------------------------------
// Properties 9–16: Task helper property-based tests
// Feature: todo-life-dashboard
// ---------------------------------------------------------------------------

(async () => {
  process.stdout.write('\nTask Helper Properties (9–16)\n');
  process.stdout.write('=============================\n\n');

  const {
    validateTaskTitle,
    isDuplicate,
    createTask,
    toggleTask,
    editTask,
    deleteTask,
    sortTasks,
    serializeTasks,
    deserializeTasks,
  } = require('./app.js');

  // -------------------------------------------------------------------------
  // Arbitraries
  // -------------------------------------------------------------------------

  // Valid task title: 1–200 chars with at least one non-whitespace character.
  const validTitleArb = fc.string({ minLength: 1, maxLength: 200 })
    .filter(s => s.trim().length > 0);

  // Whitespace-only string (including empty string).
  // fc.stringOf is not available in fast-check v4; use array + join instead.
  const whitespaceOnlyArb = fc.array(
    fc.constantFrom(' ', '\t', '\n', '\r', '\f', '\v'),
    { minLength: 0, maxLength: 50 }
  ).map(chars => chars.join(''));

  // Valid Task object — plain object (same shape as design.md data model).
  const taskArb2 = fc.record({
    id:        fc.uuid(),
    title:     fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0),
    completed: fc.boolean(),
    createdAt: fc.integer({ min: 0, max: Number.MAX_SAFE_INTEGER }),
  }).map(t => Object.assign({}, t));

  // Array of up to 100 valid Tasks with unique ids.
  const tasksArb2 = fc.uniqueArray(taskArb2, { maxLength: 100, selector: t => t.id });

  // Array of up to 99 valid Tasks with unique ids (leaves room to add one).
  const tasksUnder100Arb = fc.uniqueArray(taskArb2, { maxLength: 99, selector: t => t.id });

  // -------------------------------------------------------------------------
  // Property 9: Adding a valid task increases list length by exactly one
  // Feature: todo-life-dashboard, Property 9: Adding a valid task increases list length by exactly one
  // -------------------------------------------------------------------------
  await test('Property 9 — addTask: array length increases by exactly one (Req 5.2)', () => {
    fc.assert(
      fc.property(tasksUnder100Arb, validTitleArb, (tasks, rawTitle) => {
        // Skip if the title would be a duplicate (test focuses on the add case).
        if (isDuplicate(tasks, rawTitle)) return true;

        const before = tasks.length;
        const newTask = createTask(rawTitle);
        const after  = [...tasks, newTask];

        // Length must increase by exactly 1.
        assert.strictEqual(
          after.length,
          before + 1,
          `Expected length ${before + 1} but got ${after.length}`
        );

        // The new element must have the trimmed title.
        assert.strictEqual(
          after[after.length - 1].title,
          rawTitle.trim(),
          `Expected title "${rawTitle.trim()}" but got "${after[after.length - 1].title}"`
        );

        // The new element must start as not completed.
        assert.strictEqual(
          after[after.length - 1].completed,
          false,
          `New task should have completed=false`
        );

        return true;
      }),
      { numRuns: 100 }
    );
  });

  // -------------------------------------------------------------------------
  // Property 10: Whitespace-only titles are always invalid
  // Feature: todo-life-dashboard, Property 10: Whitespace-only titles are always invalid
  // -------------------------------------------------------------------------
  await test('Property 10 — validateTaskTitle returns false for whitespace-only/empty titles (Req 5.3, 5.9)', () => {
    fc.assert(
      fc.property(whitespaceOnlyArb, (s) => {
        const result = validateTaskTitle(s);
        assert.strictEqual(
          result.valid,
          false,
          `validateTaskTitle("${s}") should be invalid but got valid=true`
        );
        return true;
      }),
      { numRuns: 100 }
    );
  });

  // -------------------------------------------------------------------------
  // Property 11: Task toggle is its own inverse
  // Feature: todo-life-dashboard, Property 11: Task toggle is its own inverse
  // -------------------------------------------------------------------------
  await test('Property 11 — toggleTask(toggleTask(t)).completed === t.completed (Req 5.6)', () => {
    fc.assert(
      fc.property(taskArb2, (task) => {
        const twice = toggleTask(toggleTask(task));
        assert.strictEqual(
          twice.completed,
          task.completed,
          `Expected completed=${task.completed} after double-toggle but got ${twice.completed}`
        );
        return true;
      }),
      { numRuns: 100 }
    );
  });

  // -------------------------------------------------------------------------
  // Property 12: Editing a task updates title and preserves all other fields
  // Feature: todo-life-dashboard, Property 12: Editing a task updates title and preserves all other fields
  // -------------------------------------------------------------------------
  await test('Property 12 — editTask: title updated, all other fields preserved (Req 5.8)', () => {
    fc.assert(
      fc.property(taskArb2, validTitleArb, (task, newTitle) => {
        const edited = editTask(task, newTitle);

        assert.strictEqual(
          edited.title,
          newTitle.trim(),
          `Expected title "${newTitle.trim()}" but got "${edited.title}"`
        );
        assert.strictEqual(
          edited.completed,
          task.completed,
          `completed field must be preserved`
        );
        assert.strictEqual(
          edited.id,
          task.id,
          `id field must be preserved`
        );
        assert.strictEqual(
          edited.createdAt,
          task.createdAt,
          `createdAt field must be preserved`
        );

        return true;
      }),
      { numRuns: 100 }
    );
  });

  // -------------------------------------------------------------------------
  // Property 13: Deleting a task removes exactly that task
  // Feature: todo-life-dashboard, Property 13: Deleting a task removes exactly that task
  // -------------------------------------------------------------------------
  await test('Property 13 — deleteTask: removes exactly the targeted task (Req 5.11)', () => {
    // We need at least one task so we can pick an id to delete.
    const nonEmptyTasksArb = fc.uniqueArray(taskArb2, { minLength: 1, maxLength: 100, selector: t => t.id });

    fc.assert(
      fc.property(nonEmptyTasksArb, (tasks) => {
        // Pick the id of a random element (fast-check controls randomness).
        const targetIndex = 0; // deterministically pick first to keep test simple
        const targetId    = tasks[targetIndex].id;

        const result = deleteTask(tasks, targetId);

        // Length decreases by exactly 1.
        assert.strictEqual(
          result.length,
          tasks.length - 1,
          `Expected length ${tasks.length - 1} but got ${result.length}`
        );

        // The deleted id must not appear in the result.
        const stillPresent = result.some(t => t.id === targetId);
        assert.strictEqual(
          stillPresent,
          false,
          `Task with id "${targetId}" should not be present after deleteTask`
        );

        return true;
      }),
      { numRuns: 100 }
    );
  });

  // -------------------------------------------------------------------------
  // Property 14: Task collection serialize/deserialize round-trip
  // Feature: todo-life-dashboard, Property 14: Task collection localStorage round-trip
  // -------------------------------------------------------------------------
  // (Already covered earlier in the file; this block adds extra coverage via
  // the task-specific arbitrary.)
  await test('Property 14 (task arb) — serializeTasks/deserializeTasks round-trip (Req 6.1, 6.2)', () => {
    fc.assert(
      fc.property(tasksArb2, (tasks) => {
        const restored = deserializeTasks(serializeTasks(tasks));
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
  // Property 15: Duplicate detection is case-insensitive and trim-invariant
  // Feature: todo-life-dashboard, Property 15: Duplicate detection is case-insensitive and trim-invariant
  // -------------------------------------------------------------------------
  await test('Property 15 — isDuplicate: case-insensitive and trim-invariant (Req 7.1)', () => {
    // Build an arbitrary that provides (tasks, variantTitle) where
    // variantTitle.trim().toLowerCase() === tasks[0].title.trim().toLowerCase()
    // for at least one task in the array.
    const nonEmptyTasksArb2 = fc.uniqueArray(taskArb2, { minLength: 1, maxLength: 20, selector: t => t.id });

    // Produce a variant: randomly add leading/trailing spaces and randomly
    // change case by mixing toUpperCase / original per character.
    const caseVariantOf = (str) => {
      // We can't pass a function to fc.map directly in this outer scope,
      // so we produce a static variant that is just the upper-cased + padded version.
      return '  ' + str.toUpperCase() + '  ';
    };

    fc.assert(
      fc.property(nonEmptyTasksArb2, (tasks) => {
        const baseTitle = tasks[0].title; // guaranteed by minLength: 1
        const variant   = caseVariantOf(baseTitle);

        // variant.trim().toLowerCase() should equal baseTitle.trim().toLowerCase()
        assert.strictEqual(
          variant.trim().toLowerCase(),
          baseTitle.trim().toLowerCase(),
          `Test setup error: variant "${variant}" does not normalise to base`
        );

        const result = isDuplicate(tasks, variant);
        assert.strictEqual(
          result,
          true,
          `isDuplicate should detect "${variant}" as duplicate of "${baseTitle}"`
        );

        return true;
      }),
      { numRuns: 100 }
    );
  });

  // -------------------------------------------------------------------------
  // Property 16: Sort produces correct orderings
  // Feature: todo-life-dashboard, Property 16: Sort produces correct orderings
  // -------------------------------------------------------------------------

  // Helper: checks that array is in non-decreasing order according to comparator.
  function isSortedAsc(arr, key) {
    for (let i = 1; i < arr.length; i++) {
      if (key(arr[i - 1]) > key(arr[i])) return false;
    }
    return true;
  }

  // 'default': non-increasing by createdAt (newest first → descending).
  await test('Property 16a — sortTasks("default"): newest createdAt first (Req 8.2)', () => {
    fc.assert(
      fc.property(tasksArb2, (tasks) => {
        const sorted = sortTasks(tasks, 'default');

        for (let i = 1; i < sorted.length; i++) {
          assert.ok(
            sorted[i - 1].createdAt >= sorted[i].createdAt,
            `sortTasks("default") not in descending createdAt order at index ${i}: ` +
            `${sorted[i - 1].createdAt} < ${sorted[i].createdAt}`
          );
        }

        return true;
      }),
      { numRuns: 100 }
    );
  });

  await test('Property 16b — sortTasks("az"): non-decreasing by title (Req 8.3)', () => {
    fc.assert(
      fc.property(tasksArb2, (tasks) => {
        const sorted = sortTasks(tasks, 'az');

        for (let i = 1; i < sorted.length; i++) {
          const a = sorted[i - 1].title.trim().toLowerCase();
          const b = sorted[i].title.trim().toLowerCase();
          assert.ok(
            a.localeCompare(b) <= 0,
            `sortTasks("az") not in ascending title order at index ${i}: "${a}" > "${b}"`
          );
        }

        return true;
      }),
      { numRuns: 100 }
    );
  });

  await test('Property 16c — sortTasks("za"): non-increasing by title (Req 8.4)', () => {
    // The design spec says "za" returns the reverse of "az". For distinct titles
    // this is equivalent to non-increasing title order. For ties (equal titles),
    // stable sort means both az and za keep the same relative order for equal
    // elements — so the ordering property is: each consecutive pair satisfies
    // a.localeCompare(b) >= 0 (non-increasing).
    fc.assert(
      fc.property(tasksArb2, (tasks) => {
        const za = sortTasks(tasks, 'za');

        for (let i = 1; i < za.length; i++) {
          const a = za[i - 1].title.trim().toLowerCase();
          const b = za[i].title.trim().toLowerCase();
          assert.ok(
            a.localeCompare(b) >= 0,
            `sortTasks("za") not in descending title order at index ${i}: "${a}" < "${b}"`
          );
        }

        return true;
      }),
      { numRuns: 100 }
    );
  });

  await test('Property 16d — sortTasks: original array is never mutated (Req 8.2–8.4)', () => {
    fc.assert(
      fc.property(tasksArb2, fc.constantFrom('default', 'az', 'za'), (tasks, option) => {
        const snapshot = tasks.map(t => Object.assign({}, t));
        sortTasks(tasks, option);

        assert.deepStrictEqual(
          tasks,
          snapshot,
          `sortTasks("${option}") mutated the original array`
        );

        return true;
      }),
      { numRuns: 100 }
    );
  });

  // ---------------------------------------------------------------------------
  // Summary for this block
  // ---------------------------------------------------------------------------
  const blockResults = results.filter(r =>
    [
      'Property 9', 'Property 10', 'Property 11', 'Property 12',
      'Property 13', 'Property 14 (task arb)', 'Property 15',
      'Property 16a', 'Property 16b', 'Property 16c', 'Property 16d',
    ].some(prefix => r.name.startsWith(prefix))
  );
  const bPassed = blockResults.filter(r => r.passed).length;
  const bFailed = blockResults.filter(r => !r.passed).length;
  process.stdout.write('\n-------------------------------------------\n');
  process.stdout.write(`Block results (Properties 9–16): ${bPassed}/${blockResults.length} passed`);
  if (bFailed > 0) process.stdout.write(`, ${bFailed} failed`);
  process.stdout.write('\n');
  if (bFailed > 0) process.exit(1);
  else process.stdout.write('All task property tests passed.\n\n');
})();

// ---------------------------------------------------------------------------
// Unit tests for Greeting helpers: formatTime, formatDate, getGreeting,
// buildGreetingMessage
// Task 15.1
// ---------------------------------------------------------------------------

(async () => {
  process.stdout.write('\nGreeting Helper Unit Tests (Task 15.1)\n');
  process.stdout.write('======================================\n\n');

  const {
    formatTime,
    formatDate,
    getGreeting,
    buildGreetingMessage,
  } = require('./app.js');

  // -------------------------------------------------------------------------
  // formatTime
  // -------------------------------------------------------------------------
  await test('formatTime — 09:05 for 9h 5m', () => {
    assert.strictEqual(formatTime(new Date('2024-01-01T09:05:00')), '09:05');
  });

  await test('formatTime — 00:00 for midnight', () => {
    assert.strictEqual(formatTime(new Date('2024-01-01T00:00:00')), '00:00');
  });

  await test('formatTime — 23:59 for end of day', () => {
    assert.strictEqual(formatTime(new Date('2024-01-01T23:59:00')), '23:59');
  });

  // -------------------------------------------------------------------------
  // formatDate
  // -------------------------------------------------------------------------
  await test('formatDate — 2024-09-16 contains correct weekday, day, month, year', () => {
    // 2024-09-16 is a Monday
    const result = formatDate(new Date('2024-09-16T00:00:00'));
    assert.ok(result.includes('Monday'),   `Expected "Monday" in "${result}"`);
    assert.ok(result.includes('16'),        `Expected "16" in "${result}"`);
    assert.ok(result.includes('September'), `Expected "September" in "${result}"`);
    assert.ok(result.includes('2024'),      `Expected "2024" in "${result}"`);
  });

  await test('formatDate — day is zero-padded for single-digit days (Jan 5)', () => {
    // 2024-01-05 is a Friday
    const result = formatDate(new Date('2024-01-05T00:00:00'));
    assert.ok(
      result.includes('05'),
      `Expected zero-padded "05" in "${result}"`
    );
  });

  // -------------------------------------------------------------------------
  // getGreeting
  // -------------------------------------------------------------------------
  await test('getGreeting(0) === "Good night"', () => {
    assert.strictEqual(getGreeting(0), 'Good night');
  });

  await test('getGreeting(4) === "Good night"', () => {
    assert.strictEqual(getGreeting(4), 'Good night');
  });

  await test('getGreeting(5) === "Good morning"', () => {
    assert.strictEqual(getGreeting(5), 'Good morning');
  });

  await test('getGreeting(11) === "Good morning"', () => {
    assert.strictEqual(getGreeting(11), 'Good morning');
  });

  await test('getGreeting(12) === "Good afternoon"', () => {
    assert.strictEqual(getGreeting(12), 'Good afternoon');
  });

  await test('getGreeting(17) === "Good afternoon"', () => {
    assert.strictEqual(getGreeting(17), 'Good afternoon');
  });

  await test('getGreeting(18) === "Good evening"', () => {
    assert.strictEqual(getGreeting(18), 'Good evening');
  });

  await test('getGreeting(20) === "Good evening"', () => {
    assert.strictEqual(getGreeting(20), 'Good evening');
  });

  await test('getGreeting(21) === "Good night"', () => {
    assert.strictEqual(getGreeting(21), 'Good night');
  });

  await test('getGreeting(23) === "Good night"', () => {
    assert.strictEqual(getGreeting(23), 'Good night');
  });

  // -------------------------------------------------------------------------
  // buildGreetingMessage
  // -------------------------------------------------------------------------
  await test('buildGreetingMessage — includes name when non-empty', () => {
    assert.strictEqual(
      buildGreetingMessage('Good morning', 'Alice'),
      'Good morning, Alice'
    );
  });

  await test('buildGreetingMessage — trims name before appending', () => {
    assert.strictEqual(
      buildGreetingMessage('Good morning', '  Bob  '),
      'Good morning, Bob'
    );
  });

  await test('buildGreetingMessage — returns greeting alone when name is empty string', () => {
    assert.strictEqual(
      buildGreetingMessage('Good morning', ''),
      'Good morning'
    );
  });

  await test('buildGreetingMessage — returns greeting alone when name is whitespace-only', () => {
    assert.strictEqual(
      buildGreetingMessage('Good morning', '   '),
      'Good morning'
    );
  });

  await test('buildGreetingMessage — returns greeting alone when name is null', () => {
    assert.strictEqual(
      buildGreetingMessage('Good morning', null),
      'Good morning'
    );
  });

  // -------------------------------------------------------------------------
  // Block summary
  // -------------------------------------------------------------------------
  const unitTestNames = [
    'formatTime',
    'formatDate',
    'getGreeting',
    'buildGreetingMessage',
  ];
  const blockResults = results.filter(r =>
    unitTestNames.some(prefix => r.name.startsWith(prefix)) ||
    r.name.includes('Good morning') ||
    r.name.includes('Good afternoon') ||
    r.name.includes('Good evening') ||
    r.name.includes('Good night') ||
    r.name.startsWith('formatTime') ||
    r.name.startsWith('formatDate') ||
    r.name.startsWith('getGreeting') ||
    r.name.startsWith('buildGreetingMessage')
  );
  const bPassed = blockResults.filter(r => r.passed).length;
  const bFailed = blockResults.filter(r => !r.passed).length;
  process.stdout.write('\n-------------------------------------------\n');
  process.stdout.write(`Block results (Greeting unit tests): ${bPassed}/${blockResults.length} passed`);
  if (bFailed > 0) process.stdout.write(`, ${bFailed} failed`);
  process.stdout.write('\n');
  if (bFailed > 0) process.exit(1);
  else process.stdout.write('All greeting unit tests passed.\n\n');
})();

// ---------------------------------------------------------------------------
// Task 15.2: Unit tests for Timer helpers — formatTimer and validateDuration
// Feature: todo-life-dashboard
// ---------------------------------------------------------------------------

(async () => {
  process.stdout.write('\nTimer Helper Unit Tests (Task 15.2)\n');
  process.stdout.write('====================================\n\n');

  const { formatTimer, validateDuration } = require('./app.js');

  // ---- formatTimer --------------------------------------------------------

  await test('formatTimer(0) === "00:00"', () => {
    assert.strictEqual(formatTimer(0), '00:00');
  });

  await test('formatTimer(60) === "01:00"', () => {
    assert.strictEqual(formatTimer(60), '01:00');
  });

  await test('formatTimer(90) === "01:30"', () => {
    assert.strictEqual(formatTimer(90), '01:30');
  });

  await test('formatTimer(1500) === "25:00" (25 minutes)', () => {
    assert.strictEqual(formatTimer(1500), '25:00');
  });

  await test('formatTimer(7200) === "120:00" (120 minutes)', () => {
    assert.strictEqual(formatTimer(7200), '120:00');
  });

  await test('formatTimer(61) === "01:01"', () => {
    assert.strictEqual(formatTimer(61), '01:01');
  });

  await test('formatTimer(3661) === "61:01"', () => {
    assert.strictEqual(formatTimer(3661), '61:01');
  });

  // ---- validateDuration ---------------------------------------------------

  await test('validateDuration(1) === true', () => {
    assert.strictEqual(validateDuration(1), true);
  });

  await test('validateDuration(25) === true', () => {
    assert.strictEqual(validateDuration(25), true);
  });

  await test('validateDuration(120) === true', () => {
    assert.strictEqual(validateDuration(120), true);
  });

  await test('validateDuration(0) === false', () => {
    assert.strictEqual(validateDuration(0), false);
  });

  await test('validateDuration(121) === false', () => {
    assert.strictEqual(validateDuration(121), false);
  });

  await test('validateDuration(-1) === false', () => {
    assert.strictEqual(validateDuration(-1), false);
  });

  await test('validateDuration(1.5) === false', () => {
    assert.strictEqual(validateDuration(1.5), false);
  });

  await test('validateDuration(NaN) === false', () => {
    assert.strictEqual(validateDuration(NaN), false);
  });

  await test('validateDuration(null) === false', () => {
    assert.strictEqual(validateDuration(null), false);
  });

  await test('validateDuration("25") === false', () => {
    assert.strictEqual(validateDuration('25'), false);
  });

  await test('validateDuration(undefined) === false', () => {
    assert.strictEqual(validateDuration(undefined), false);
  });

  // ---- Block summary ------------------------------------------------------
  const blockNames = [
    'formatTimer(0)',
    'formatTimer(60)',
    'formatTimer(90)',
    'formatTimer(1500)',
    'formatTimer(7200)',
    'formatTimer(61)',
    'formatTimer(3661)',
    'validateDuration(1)',
    'validateDuration(25)',
    'validateDuration(120)',
    'validateDuration(0)',
    'validateDuration(121)',
    'validateDuration(-1)',
    'validateDuration(1.5)',
    'validateDuration(NaN)',
    'validateDuration(null)',
    'validateDuration("25")',
    'validateDuration(undefined)',
  ];

  const blockResults = results.filter(r => blockNames.some(n => r.name.startsWith(n)));
  const bPassed = blockResults.filter(r => r.passed).length;
  const bFailed = blockResults.filter(r => !r.passed).length;

  process.stdout.write('\n-------------------------------------------\n');
  process.stdout.write(`Block results (Timer helper unit tests): ${bPassed}/${blockResults.length} passed`);
  if (bFailed > 0) process.stdout.write(`, ${bFailed} failed`);
  process.stdout.write('\n');
  if (bFailed > 0) process.exit(1);
  else process.stdout.write('All Timer helper unit tests passed.\n\n');
})();

// ---------------------------------------------------------------------------
// Unit Tests for Task helpers (Task 15.3)
// Deterministic, concrete-input/expected-output tests.
// ---------------------------------------------------------------------------

(async () => {
  process.stdout.write('\nUnit Tests — Task Helpers (Task 15.3)\n');
  process.stdout.write('=====================================\n\n');

  const {
    validateTaskTitle,
    isDuplicate,
    createTask,
    toggleTask,
    editTask,
    deleteTask,
    sortTasks,
    serializeTasks,
    deserializeTasks,
  } = require('./app.js');

  // -------------------------------------------------------------------------
  // validateTaskTitle
  // -------------------------------------------------------------------------

  await test('validateTaskTitle — valid title returns valid=true', () => {
    assert.strictEqual(validateTaskTitle('Buy milk').valid, true);
  });

  await test('validateTaskTitle — empty string returns valid=false', () => {
    assert.strictEqual(validateTaskTitle('').valid, false);
  });

  await test('validateTaskTitle — whitespace-only returns valid=false', () => {
    assert.strictEqual(validateTaskTitle('   ').valid, false);
  });

  await test('validateTaskTitle — 201-char title returns valid=false', () => {
    assert.strictEqual(validateTaskTitle('a'.repeat(201)).valid, false);
  });

  await test('validateTaskTitle — 200-char title returns valid=true', () => {
    assert.strictEqual(validateTaskTitle('a'.repeat(200)).valid, true);
  });

  await test('validateTaskTitle — single char title returns valid=true', () => {
    assert.strictEqual(validateTaskTitle('x').valid, true);
  });

  // -------------------------------------------------------------------------
  // isDuplicate
  // -------------------------------------------------------------------------

  await test('isDuplicate — exact match returns true', () => {
    const tasks = [createTask('Buy milk'), createTask('Walk dog')];
    assert.strictEqual(isDuplicate(tasks, 'Buy milk'), true);
  });

  await test('isDuplicate — case-insensitive match returns true', () => {
    const tasks = [createTask('Buy milk'), createTask('Walk dog')];
    assert.strictEqual(isDuplicate(tasks, 'buy milk'), true);
  });

  await test('isDuplicate — trim-invariant match returns true', () => {
    const tasks = [createTask('Buy milk'), createTask('Walk dog')];
    assert.strictEqual(isDuplicate(tasks, '  Buy Milk  '), true);
  });

  await test('isDuplicate — no match returns false', () => {
    const tasks = [createTask('Buy milk'), createTask('Walk dog')];
    assert.strictEqual(isDuplicate(tasks, 'Read book'), false);
  });

  await test('isDuplicate — empty array always returns false', () => {
    assert.strictEqual(isDuplicate([], 'anything'), false);
  });

  // -------------------------------------------------------------------------
  // createTask
  // -------------------------------------------------------------------------

  await test('createTask — title is trimmed', () => {
    const t = createTask('  Hello World  ');
    assert.strictEqual(t.title, 'Hello World');
  });

  await test('createTask — completed starts as false', () => {
    const t = createTask('Test task');
    assert.strictEqual(t.completed, false);
  });

  await test('createTask — id is a string', () => {
    const t = createTask('Test task');
    assert.strictEqual(typeof t.id, 'string');
  });

  await test('createTask — createdAt is a number', () => {
    const t = createTask('Test task');
    assert.strictEqual(typeof t.createdAt, 'number');
  });

  await test('createTask — each call produces a unique id', () => {
    const t1 = createTask('Task one');
    const t2 = createTask('Task two');
    assert.notStrictEqual(t1.id, t2.id);
  });

  // -------------------------------------------------------------------------
  // toggleTask
  // -------------------------------------------------------------------------

  await test('toggleTask — false → true', () => {
    const t = createTask('test'); // completed=false
    assert.strictEqual(toggleTask(t).completed, true);
  });

  await test('toggleTask — true → false (double toggle restores original)', () => {
    const t = createTask('test');
    assert.strictEqual(toggleTask(toggleTask(t)).completed, false);
  });

  await test('toggleTask — id is preserved', () => {
    const t = createTask('test');
    assert.strictEqual(toggleTask(t).id, t.id);
  });

  await test('toggleTask — title is preserved', () => {
    const t = createTask('test title');
    assert.strictEqual(toggleTask(t).title, t.title);
  });

  await test('toggleTask — createdAt is preserved', () => {
    const t = createTask('test');
    assert.strictEqual(toggleTask(t).createdAt, t.createdAt);
  });

  await test('toggleTask — original task is not mutated', () => {
    const t = createTask('test');
    toggleTask(t);
    assert.strictEqual(t.completed, false);
  });

  // -------------------------------------------------------------------------
  // editTask
  // -------------------------------------------------------------------------

  await test('editTask — title is updated and trimmed', () => {
    const t3 = createTask('Old title');
    const edited = editTask(t3, '  New title  ');
    assert.strictEqual(edited.title, 'New title');
  });

  await test('editTask — id is preserved', () => {
    const t3 = createTask('Old title');
    const edited = editTask(t3, 'New title');
    assert.strictEqual(edited.id, t3.id);
  });

  await test('editTask — completed is preserved', () => {
    const t3 = createTask('Old title');
    const edited = editTask(t3, 'New title');
    assert.strictEqual(edited.completed, t3.completed);
  });

  await test('editTask — createdAt is preserved', () => {
    const t3 = createTask('Old title');
    const edited = editTask(t3, 'New title');
    assert.strictEqual(edited.createdAt, t3.createdAt);
  });

  await test('editTask — original task is not mutated', () => {
    const t3 = createTask('Old title');
    editTask(t3, 'New title');
    assert.strictEqual(t3.title, 'Old title');
  });

  // -------------------------------------------------------------------------
  // deleteTask
  // -------------------------------------------------------------------------

  await test('deleteTask — result length is one less than original', () => {
    const tasks2 = [createTask('A'), createTask('B'), createTask('C')];
    const after = deleteTask(tasks2, tasks2[1].id);
    assert.strictEqual(after.length, 2);
  });

  await test('deleteTask — deleted task is not in the result', () => {
    const tasks2 = [createTask('A'), createTask('B'), createTask('C')];
    const targetId = tasks2[1].id;
    const after = deleteTask(tasks2, targetId);
    assert.strictEqual(after.every(t => t.id !== targetId), true);
  });

  await test('deleteTask — task title "B" is absent after deleting it', () => {
    const tasks2 = [createTask('A'), createTask('B'), createTask('C')];
    const after = deleteTask(tasks2, tasks2[1].id);
    assert.strictEqual(after.every(t => t.title !== 'B'), true);
  });

  await test('deleteTask — original array is not mutated', () => {
    const tasks2 = [createTask('A'), createTask('B'), createTask('C')];
    deleteTask(tasks2, tasks2[1].id);
    assert.strictEqual(tasks2.length, 3);
  });

  await test('deleteTask — non-existent id returns same-length array (no-op)', () => {
    const tasks2 = [createTask('A'), createTask('B')];
    const after = deleteTask(tasks2, 'non-existent-id');
    assert.strictEqual(after.length, 2);
  });

  await test('deleteTask — empty array returns empty array', () => {
    const after = deleteTask([], 'any-id');
    assert.strictEqual(after.length, 0);
  });

  // -------------------------------------------------------------------------
  // sortTasks
  // -------------------------------------------------------------------------

  await test('sortTasks("default") — empty array returns empty array', () => {
    assert.strictEqual(sortTasks([], 'default').length, 0);
  });

  await test('sortTasks("default") — newest task appears first', () => {
    const older = Object.assign(createTask('Older'), { createdAt: 1000 });
    const newer = Object.assign(createTask('Newer'), { createdAt: 9000 });
    const sorted = sortTasks([older, newer], 'default');
    assert.strictEqual(sorted[0].title, 'Newer');
    assert.strictEqual(sorted[1].title, 'Older');
  });

  await test('sortTasks("az") — alphabetical ascending', () => {
    const tasks3 = [createTask('Zebra'), createTask('apple'), createTask('Mango')];
    const sorted = sortTasks(tasks3, 'az');
    // 'apple'.localeCompare('mango') < 0 < 'zebra'
    assert.strictEqual(sorted[0].title.toLowerCase(), 'apple');
    assert.strictEqual(sorted[sorted.length - 1].title.toLowerCase(), 'zebra');
  });

  await test('sortTasks("za") — alphabetical descending', () => {
    const tasks3 = [createTask('apple'), createTask('Mango'), createTask('Zebra')];
    const sorted = sortTasks(tasks3, 'za');
    assert.strictEqual(sorted[0].title.toLowerCase(), 'zebra');
    assert.strictEqual(sorted[sorted.length - 1].title.toLowerCase(), 'apple');
  });

  await test('sortTasks — original array is not mutated', () => {
    const tasks3 = [createTask('Zebra'), createTask('Apple')];
    const originalFirst = tasks3[0].title;
    sortTasks(tasks3, 'az');
    assert.strictEqual(tasks3[0].title, originalFirst);
  });

  await test('sortTasks — single item returns single-item array', () => {
    const single = [createTask('Only one')];
    const sorted = sortTasks(single, 'az');
    assert.strictEqual(sorted.length, 1);
    assert.strictEqual(sorted[0].title, 'Only one');
  });

  // -------------------------------------------------------------------------
  // serializeTasks / deserializeTasks
  // -------------------------------------------------------------------------

  await test('serializeTasks / deserializeTasks — round-trip of empty array', () => {
    const restored = deserializeTasks(serializeTasks([]));
    assert.deepStrictEqual(restored, []);
  });

  await test('serializeTasks / deserializeTasks — round-trip preserves task data', () => {
    const tasks4 = [createTask('Buy groceries'), createTask('Read book')];
    const restored = deserializeTasks(serializeTasks(tasks4));
    assert.strictEqual(restored.length, 2);
    assert.strictEqual(restored[0].title, 'Buy groceries');
    assert.strictEqual(restored[1].title, 'Read book');
    assert.strictEqual(restored[0].completed, false);
  });

  await test('deserializeTasks — malformed JSON returns []', () => {
    assert.deepStrictEqual(deserializeTasks('invalid json'), []);
  });

  await test('deserializeTasks — null input returns []', () => {
    assert.deepStrictEqual(deserializeTasks(null), []);
  });

  await test('deserializeTasks — JSON object (not array) returns []', () => {
    assert.deepStrictEqual(deserializeTasks('{"id":"1","title":"t"}'), []);
  });

  await test('deserializeTasks — JSON number returns []', () => {
    assert.deepStrictEqual(deserializeTasks('42'), []);
  });

  // ---------------------------------------------------------------------------
  // Block summary
  // ---------------------------------------------------------------------------
  const blockPrefix = [
    'validateTaskTitle',
    'isDuplicate',
    'createTask',
    'toggleTask',
    'editTask',
    'deleteTask',
    'sortTasks',
    'serializeTasks',
    'deserializeTasks',
  ];
  const blockResults = results.filter(r =>
    blockPrefix.some(prefix => r.name.startsWith(prefix))
  );
  const bPassed = blockResults.filter(r => r.passed).length;
  const bFailed = blockResults.filter(r => !r.passed).length;
  process.stdout.write('\n-------------------------------------------\n');
  process.stdout.write(`Block results (Task helpers unit tests): ${bPassed}/${blockResults.length} passed`);
  if (bFailed > 0) process.stdout.write(`, ${bFailed} failed`);
  process.stdout.write('\n');
  if (bFailed > 0) process.exit(1);
  else process.stdout.write('All Task helper unit tests passed.\n\n');
})();

// ---------------------------------------------------------------------------
// Task 15.4 — Unit tests for Link helpers
// Deterministic, concrete-input/expected-output tests for:
//   validateLink, createLink, deleteLink, serializeLinks, deserializeLinks
// ---------------------------------------------------------------------------

(async () => {
  process.stdout.write('\nLink Helper Unit Tests (Task 15.4)\n');
  process.stdout.write('===================================\n\n');

  const {
    validateLink,
    createLink,
    deleteLink,
    serializeLinks,
    deserializeLinks,
  } = require('./app.js');

  // -------------------------------------------------------------------------
  // validateLink — valid cases
  // -------------------------------------------------------------------------
  await test('validateLink: valid name + https URL + count 0 → valid', () => {
    const result = validateLink('GitHub', 'https://github.com', 0);
    assert.strictEqual(result.valid, true, `Expected valid=true, got ${result.valid}`);
  });

  await test('validateLink: protocol check is case-insensitive (HTTPS://)', () => {
    const result = validateLink('GitHub', 'HTTPS://github.com', 0);
    assert.strictEqual(result.valid, true,
      `Expected HTTPS:// to be accepted, got valid=${result.valid}`);
  });

  await test('validateLink: valid http URL is accepted', () => {
    const result = validateLink('Example', 'http://example.com', 0);
    assert.strictEqual(result.valid, true, `Expected http:// to be valid, got ${result.valid}`);
  });

  // -------------------------------------------------------------------------
  // validateLink — invalid: empty / whitespace-only name
  // -------------------------------------------------------------------------
  await test('validateLink: empty name → invalid', () => {
    const result = validateLink('', 'https://github.com', 0);
    assert.strictEqual(result.valid, false, `Expected valid=false for empty name`);
  });

  await test('validateLink: whitespace-only name → invalid', () => {
    const result = validateLink('   ', 'https://github.com', 0);
    assert.strictEqual(result.valid, false, `Expected valid=false for whitespace-only name`);
  });

  // -------------------------------------------------------------------------
  // validateLink — invalid: name too long (> 50 chars)
  // -------------------------------------------------------------------------
  await test('validateLink: name with 51 chars → invalid', () => {
    const longName = 'a'.repeat(51);
    const result = validateLink(longName, 'https://github.com', 0);
    assert.strictEqual(result.valid, false,
      `Expected valid=false for name of length ${longName.length}`);
  });

  // -------------------------------------------------------------------------
  // validateLink — invalid: bad URL prefix
  // -------------------------------------------------------------------------
  await test('validateLink: URL without protocol (github.com) → invalid', () => {
    const result = validateLink('GitHub', 'github.com', 0);
    assert.strictEqual(result.valid, false,
      `Expected valid=false for URL without http(s):// prefix`);
  });

  await test('validateLink: URL with wrong protocol (ftp://) → invalid', () => {
    const result = validateLink('GitHub', 'ftp://github.com', 0);
    assert.strictEqual(result.valid, false,
      `Expected valid=false for ftp:// URL`);
  });

  // -------------------------------------------------------------------------
  // validateLink — invalid: URL too long (> 2048 chars)
  // -------------------------------------------------------------------------
  await test('validateLink: URL length > 2048 chars → invalid', () => {
    // 'https://' is 8 chars; pad with 2041 'x's → total 2049 chars
    const longUrl = 'https://' + 'x'.repeat(2041);
    assert.ok(longUrl.length > 2048, 'Test setup: URL must exceed 2048 chars');
    const result = validateLink('Long', longUrl, 0);
    assert.strictEqual(result.valid, false,
      `Expected valid=false for URL of length ${longUrl.length}`);
  });

  // -------------------------------------------------------------------------
  // validateLink — invalid: capacity reached (count >= 20)
  // -------------------------------------------------------------------------
  await test('validateLink: count === 20 (at capacity) → invalid', () => {
    const result = validateLink('GitHub', 'https://github.com', 20);
    assert.strictEqual(result.valid, false,
      `Expected valid=false when count=20 (capacity reached)`);
  });

  await test('validateLink: count === 19 (one below capacity) → valid', () => {
    const result = validateLink('GitHub', 'https://github.com', 19);
    assert.strictEqual(result.valid, true,
      `Expected valid=true when count=19 (one slot remaining)`);
  });

  // -------------------------------------------------------------------------
  // createLink
  // -------------------------------------------------------------------------
  await test('createLink: name is trimmed', () => {
    const link = createLink('  GitHub  ', 'https://github.com');
    assert.strictEqual(link.name, 'GitHub',
      `Expected name="GitHub" (trimmed), got "${link.name}"`);
  });

  await test('createLink: url is preserved as-is', () => {
    const url  = 'https://github.com';
    const link = createLink('GitHub', url);
    assert.strictEqual(link.url, url,
      `Expected url="${url}", got "${link.url}"`);
  });

  await test('createLink: id is a non-empty string', () => {
    const link = createLink('GitHub', 'https://github.com');
    assert.strictEqual(typeof link.id, 'string',
      `Expected id to be a string, got ${typeof link.id}`);
    assert.ok(link.id.length > 0, `Expected id to be non-empty`);
  });

  await test('createLink: two links get distinct ids', () => {
    const a = createLink('GitHub', 'https://github.com');
    const b = createLink('Google', 'https://google.com');
    assert.notStrictEqual(a.id, b.id,
      `Expected distinct ids but both were "${a.id}"`);
  });

  // -------------------------------------------------------------------------
  // deleteLink
  // -------------------------------------------------------------------------
  await test('deleteLink: removes the targeted link (length decreases by 1)', () => {
    const links = [
      createLink('GitHub', 'https://github.com'),
      createLink('Google', 'https://google.com'),
    ];
    const after = deleteLink(links, links[0].id);
    assert.strictEqual(after.length, 1,
      `Expected length 1 after deletion, got ${after.length}`);
  });

  await test('deleteLink: correct link remains after deletion', () => {
    const links = [
      createLink('GitHub', 'https://github.com'),
      createLink('Google', 'https://google.com'),
    ];
    const after = deleteLink(links, links[0].id);
    assert.strictEqual(after[0].name, 'Google',
      `Expected remaining link to be "Google", got "${after[0].name}"`);
  });

  await test('deleteLink: does not mutate the original array', () => {
    const links = [
      createLink('GitHub', 'https://github.com'),
      createLink('Google', 'https://google.com'),
    ];
    deleteLink(links, links[0].id);
    assert.strictEqual(links.length, 2,
      `Expected original array length to remain 2 after deleteLink, got ${links.length}`);
  });

  await test('deleteLink: deleting non-existent id returns same-length array', () => {
    const links = [
      createLink('GitHub', 'https://github.com'),
    ];
    const after = deleteLink(links, 'non-existent-id');
    assert.strictEqual(after.length, 1,
      `Expected length 1 when deleting missing id, got ${after.length}`);
  });

  await test('deleteLink: deleting from empty array returns empty array', () => {
    const after = deleteLink([], 'any-id');
    assert.strictEqual(after.length, 0,
      `Expected empty array, got length ${after.length}`);
  });

  // -------------------------------------------------------------------------
  // serializeLinks / deserializeLinks
  // -------------------------------------------------------------------------
  await test('deserializeLinks(serializeLinks([])): empty array round-trip', () => {
    const result = deserializeLinks(serializeLinks([]));
    assert.strictEqual(result.length, 0,
      `Expected empty array, got length ${result.length}`);
  });

  await test('serializeLinks/deserializeLinks: single link round-trip preserves all fields', () => {
    const original = [{ id: 'abc-123', name: 'GitHub', url: 'https://github.com' }];
    const result   = deserializeLinks(serializeLinks(original));
    assert.deepStrictEqual(result, original,
      `Round-trip failed: ${JSON.stringify(result)} !== ${JSON.stringify(original)}`);
  });

  await test('serializeLinks/deserializeLinks: multiple links round-trip', () => {
    const original = [
      { id: 'id-1', name: 'GitHub', url: 'https://github.com' },
      { id: 'id-2', name: 'Google', url: 'https://google.com' },
      { id: 'id-3', name: 'MDN',    url: 'https://developer.mozilla.org' },
    ];
    const result = deserializeLinks(serializeLinks(original));
    assert.deepStrictEqual(result, original,
      `Multi-link round-trip failed`);
  });

  await test('deserializeLinks: bad JSON string returns []', () => {
    const result = deserializeLinks('bad json');
    assert.deepStrictEqual(result, [],
      `Expected [] for invalid JSON, got ${JSON.stringify(result)}`);
  });

  await test('deserializeLinks: null returns []', () => {
    const result = deserializeLinks(null);
    assert.deepStrictEqual(result, [],
      `Expected [] for null input, got ${JSON.stringify(result)}`);
  });

  await test('deserializeLinks: non-array JSON object ("{}") returns []', () => {
    const result = deserializeLinks('{}');
    assert.deepStrictEqual(result, [],
      `Expected [] for object JSON, got ${JSON.stringify(result)}`);
  });

  await test('deserializeLinks: non-array JSON primitive returns []', () => {
    const result = deserializeLinks('"a string"');
    assert.deepStrictEqual(result, [],
      `Expected [] for string JSON, got ${JSON.stringify(result)}`);
  });

  // -------------------------------------------------------------------------
  // Block summary
  // -------------------------------------------------------------------------
  const blockPrefix = [
    'validateLink:', 'createLink:', 'deleteLink:', 'deserializeLinks',
    'serializeLinks',
  ];
  const blockResults = results.filter(r =>
    blockPrefix.some(prefix => r.name.startsWith(prefix))
  );
  const bPassed = blockResults.filter(r => r.passed).length;
  const bFailed = blockResults.filter(r => !r.passed).length;

  process.stdout.write('\n-------------------------------------------\n');
  process.stdout.write(
    `Block results (Link Helper Unit Tests): ${bPassed}/${blockResults.length} passed`
  );
  if (bFailed > 0) {
    process.stdout.write(`, ${bFailed} failed`);
    process.stdout.write('\n');
    process.exit(1);
  } else {
    process.stdout.write('\nAll Link helper unit tests passed.\n\n');
  }
})();
