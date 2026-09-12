# Implementation Plan: Todo Life Dashboard

## Overview

Build a single-page personal productivity dashboard using pure HTML, CSS, and Vanilla JavaScript. The implementation follows a flat seven-module architecture inside a single `js/app.js` file, with all state persisted via `localStorage`. Tasks are ordered so that foundational scaffolding and shared modules come first, followed by each UI panel, then visual polish, and finally the property-based and unit test suite.

---

## Tasks

- [x] 1. Project scaffolding — file structure and HTML skeleton
  - Create `index.html` at the project root with semantic landmark regions: `<header>` for the theme toggle, `<main class="dashboard">` with four child `<section>` elements (`.panel-greeting`, `.panel-timer`, `.panel-tasks`, `.panel-links`), and a `<footer>`.
  - Add `<link rel="stylesheet" href="css/style.css">` and `<script src="js/app.js" defer></script>` to `index.html`.
  - Create `css/style.css` (empty placeholder).
  - Create `js/app.js` (empty placeholder).
  - Verify the file tree matches: `index.html`, `css/style.css`, `js/app.js` — no other JS or CSS files.
  - _Requirements: 11.1_

- [x] 2. Storage module
  - [x] 2.1 Implement `Storage` module inside `js/app.js`
    - Write `Storage.get(key)` — wraps `localStorage.getItem` in `try/catch`; returns `string | null`.
    - Write `Storage.set(key, value)` — wraps `localStorage.setItem` in `try/catch`; returns `boolean`.
    - Write `Storage.remove(key)` — wraps `localStorage.removeItem` in `try/catch`; returns `void`.
    - Define all six storage-key constants (`tld_name`, `tld_duration`, `tld_tasks`, `tld_sort`, `tld_links`, `tld_theme`).
    - _Requirements: 6.3, 9.8_

  - [x] 2.2 Write property test for Storage round-trip (Property 5, 8, 14, 17, 21, 22)
    - Set up `js/app.test.js` with [fast-check](https://github.com/dubzzz/fast-check) imported as an ES module (or via a `<script type="module">` in a test HTML runner for Node-less environments — use a hand-rolled assert suite backed by fast-check if Node is available).
    - **Property 5: Custom name localStorage round-trip** — Validates: Requirements 2.3
    - **Property 8: Pomodoro duration localStorage round-trip** — Validates: Requirements 4.3
    - **Property 14: Task collection localStorage round-trip** — Validates: Requirements 6.1, 6.2
    - **Property 17: Sort preference localStorage round-trip** — Validates: Requirements 8.5, 8.6
    - **Property 21: Link collection localStorage round-trip** — Validates: Requirements 9.6, 9.7
    - **Property 22: Theme persistence round-trip** — Validates: Requirements 10.3

- [x] 3. Utilities module
  - [x] 3.1 Implement `Utils` module inside `js/app.js`
    - Write `Utils.generateId()` — returns `crypto.randomUUID()` with a `Date.now() + Math.random()` string fallback.
    - Write `Utils.padTwo(n)` — zero-pads a single-digit number to two characters.
    - Write `Utils.clamp(val, min, max)` — clamps a number to [min, max].
    - Write `Utils.trimAndLower(str)` — returns `str.trim().toLowerCase()`.
    - _Requirements: 11.2 (pure helpers, no external deps)_

- [x] 4. CSS base and theme tokens
  - [x] 4.1 Define CSS custom properties and base styles in `css/style.css`
    - Declare all colour tokens as CSS custom properties on `:root` (background, card surface, text, accent, error, etc.).
    - Add `[data-theme="dark"]` overrides for all colour tokens.
    - Set `system-ui` font stack, `box-sizing: border-box` reset, and body background gradient (`linear-gradient(135deg, #667eea 0%, #764ba2 100%)`).
    - Style `.dashboard` with CSS Grid: `grid-template-columns: 1fr 1fr`, explicit `grid-column`/`grid-row` for each panel class.
    - Add single-column mobile breakpoint (`< 768px`) and max-width cap (`> 1400px`).
    - Style card base (`.panel`): white/dark surface, `border-radius: 16px`, `box-shadow`.
    - _Requirements: 10.2, 12.3_

  - [x] 4.2 Implement `Theme` module inside `js/app.js`
    - Write `resolveTheme(stored)` — returns `'light'` or `'dark'`; defaults to `'light'` for absent/unrecognised values.
    - Write `Theme.init()` — loads theme from `Storage`, calls `resolveTheme`, sets `document.documentElement.dataset.theme`.
    - Write `Theme.toggle()` — flips current theme, persists via `Storage.set`, updates `dataset.theme`.
    - Wire the theme toggle control's `click` listener to `Theme.toggle()`.
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [x] 4.3 Write property test for Theme (Property 22)
    - **Property 22: Theme persistence round-trip** — Validates: Requirements 10.3

- [x] 5. Greeting panel
  - [x] 5.1 Implement pure Greeting helpers inside `js/app.js`
    - Write `formatTime(date)` — returns `"HH:MM"` (24-hour, zero-padded via `Utils.padTwo`).
    - Write `formatDate(date)` — returns `"Weekday, DD MonthName YYYY"`.
    - Write `getGreeting(hour)` — maps hour [0–23] to one of: "Good morning" (5–11), "Good afternoon" (12–17), "Good evening" (18–20), "Good night" (21–23, 0–4).
    - Write `buildGreetingMessage(greeting, name)` — returns `greeting + ", " + name` when name is non-empty trimmed, otherwise `greeting`.
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.2_

  - [x] 5.2 Write property tests for Greeting helpers (Properties 1–4)
    - **Property 1: Time format is always HH:MM** — Validates: Requirements 1.1
    - **Property 2: Date format matches "Weekday, DD MonthName YYYY"** — Validates: Requirements 1.2
    - **Property 3: Greeting covers all hours exhaustively and without overlap** — Validates: Requirements 1.3, 1.4, 1.5, 1.6
    - **Property 4: Greeting message includes name when name is non-empty** — Validates: Requirements 2.2

  - [x] 5.3 Implement `Greeting` module (DOM + persistence) inside `js/app.js`
    - Write `Greeting.init()` — reads saved name via `Storage.get('tld_name')`, renders time/date/greeting into the `.panel-greeting` DOM nodes, starts `setInterval(tick, 60_000)`, fires first render immediately.
    - Write `Greeting.saveName(name)` — validates 1–50 non-whitespace chars, calls `Storage.set('tld_name', name.trim())`, re-renders greeting.
    - Wire the name input's `blur` and Enter-key `keydown` events to `Greeting.saveName()`.
    - Handle `Storage.set` returning `false` by showing the storage-unavailable banner.
    - _Requirements: 2.1, 2.3, 2.4, 2.5_

- [x] 6. Checkpoint — Greeting and Theme
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Focus Timer
  - [x] 7.1 Implement pure Timer helpers inside `js/app.js`
    - Write `formatTimer(totalSeconds)` — returns `"MM:SS"` (zero-padded).
    - Write `validateDuration(value)` — returns `true` iff `value` is an integer satisfying `1 ≤ value ≤ 120`.
    - _Requirements: 3.1, 3.9, 4.1, 4.4_

  - [x] 7.2 Write property tests for Timer helpers (Properties 6–7)
    - **Property 6: Timer format is always MM:SS** — Validates: Requirements 3.1
    - **Property 7: Duration validation accepts exactly the valid range** — Validates: Requirements 3.9, 4.1, 4.4

  - [x] 7.3 Implement `Timer` module (state machine + DOM) inside `js/app.js`
    - Declare module-scoped state: `_state` (`'STOPPED'|'RUNNING'|'PAUSED'`), `_remaining` (seconds), `_duration` (minutes), `_pendingDuration`, `_intervalId`.
    - Write `Timer.init()` — loads duration from `Storage.get('tld_duration')`, validates, renders display, attaches Start/Stop/Reset button listeners.
    - Write `Timer.start()` — transitions `STOPPED/PAUSED → RUNNING`, starts `setInterval` tick (1 s), updates button states.
    - Write `Timer.stop()` — transitions `RUNNING → PAUSED`, clears interval, updates button states.
    - Write `Timer.reset()` — transitions to `STOPPED`, resets `_remaining` to `_duration * 60`, clears pending, renders display, updates button states.
    - Implement the tick: decrements `_remaining`; on reaching 0, stops interval, transitions to `STOPPED`, fires audio notification and shows `.timer-notification` overlay.
    - Write `Timer.setDuration(mins)` — calls `validateDuration`; if not running, applies immediately and resets; if running, sets `_pendingDuration`; persists via `Storage.set('tld_duration', mins)`.
    - Wire the duration input's `change`/`blur` to `Timer.setDuration()`.
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 7.4 Implement Web Audio API end-of-session alert inside `js/app.js`
    - Create `AudioContext` lazily on first user interaction (store in a module-scoped variable).
    - On session end, create an `OscillatorNode` (sine wave, ~440 Hz, ~0.5 s duration), connect to destination, start and stop.
    - If `AudioContext` is unsupported, skip audio silently; the `.timer-notification` overlay still shows.
    - Dismiss the `.timer-notification` overlay on the next Start or Reset call.
    - _Requirements: 3.6_

  - [x] 7.5 Write property test for Timer duration round-trip (Property 8)
    - **Property 8: Pomodoro duration localStorage round-trip** — Validates: Requirements 4.3

- [x] 8. Checkpoint — Timer
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Task List
  - [x] 9.1 Implement pure Task helpers inside `js/app.js`
    - Write `validateTaskTitle(title)` — returns `{ valid: boolean, error: string }`; checks non-empty trim, max 200 chars.
    - Write `isDuplicate(tasks, title)` — returns `true` if `tasks` contains any item where `trimAndLower(item.title) === trimAndLower(title)`.
    - Write `createTask(title)` — returns a new Task object (`id`, `title: title.trim()`, `completed: false`, `createdAt: Date.now()`).
    - Write `toggleTask(task)` — returns a new Task object with `completed` flipped; all other fields unchanged.
    - Write `editTask(task, newTitle)` — returns a new Task object with `title: newTitle.trim()`; all other fields preserved.
    - Write `deleteTask(tasks, id)` — returns a new array without the element whose `.id === id`.
    - Write `sortTasks(tasks, option)` — returns a new sorted array; `'default'` → newest first by `createdAt`; `'az'` → ascending by `trimAndLower(title)`; `'za'` → descending; original array is not mutated.
    - Write `serializeTasks(tasks)` — returns `JSON.stringify(tasks)`.
    - Write `deserializeTasks(json)` — returns parsed array or `[]` on any error.
    - _Requirements: 5.2, 5.3, 5.4, 5.6, 5.8, 5.9, 5.10, 5.11, 7.1, 8.2, 8.3, 8.4_

  - [x] 9.2 Write property tests for Task helpers (Properties 9–16)
    - **Property 9: Adding a valid task increases list length by exactly one** — Validates: Requirements 5.2
    - **Property 10: Whitespace-only titles are always invalid** — Validates: Requirements 5.3, 5.9
    - **Property 11: Task toggle is its own inverse** — Validates: Requirements 5.6
    - **Property 12: Editing a task updates title and preserves all other fields** — Validates: Requirements 5.8
    - **Property 13: Deleting a task removes exactly that task** — Validates: Requirements 5.11
    - **Property 14: Task collection localStorage round-trip** — Validates: Requirements 6.1, 6.2
    - **Property 15: Duplicate detection is case-insensitive and trim-invariant** — Validates: Requirements 7.1
    - **Property 16: Sort produces correct orderings** — Validates: Requirements 8.2, 8.3, 8.4

  - [x] 9.3 Implement `Tasks` module (DOM + persistence) inside `js/app.js`
    - Declare module-scoped state: `let _tasks = []`, `let _sort = 'default'`.
    - Write `Tasks.init()` — loads tasks via `deserializeTasks(Storage.get('tld_tasks'))`, loads sort via `Storage.get('tld_sort')`, renders the full list.
    - Write `Tasks.addTask(title)` — validates title, checks duplicate and capacity (≤ 100), creates task, pushes to `_tasks`, saves, re-renders, clears input; shows inline error on failure.
    - Write `Tasks.toggleTask(id)` — maps `_tasks` with `toggleTask`, saves, re-renders.
    - Write `Tasks.startEdit(id)` — re-renders affected row in edit mode with pre-filled input and focus.
    - Write `Tasks.saveEdit(id, newTitle)` — validates title, maps `_tasks` with `editTask`, saves, re-renders; shows inline error on failure.
    - Write `Tasks.cancelEdit(id)` — re-renders affected row back to read view.
    - Write `Tasks.deleteTask(id)` — calls `deleteTask(_tasks, id)`, saves, re-renders.
    - Write `Tasks.setSort(option)` — persists to `Storage`, updates `_sort`, re-renders.
    - Implement `renderTaskList()` — calls `sortTasks(_tasks, _sort)`, maps to HTML strings via `renderTaskItem(task)`, writes to `#task-list` innerHTML.
    - Implement `renderTaskItem(task)` — returns `<li data-id="…">` HTML with checkbox, title (with strikethrough class when completed), edit and delete buttons; returns edit-mode HTML when in edit state.
    - Attach a single delegated `click` listener on `#task-list`; dispatch to the correct `Tasks.*` method based on `e.target` class.
    - Attach `submit` listener on the add-task form.
    - Attach `change` listener on the sort `<select>`.
    - Handle `Storage.set` returning `false` with the storage-unavailable banner.
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 5.10, 5.11, 6.1, 6.2, 6.3, 6.4, 7.1, 7.2, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

  - [x] 9.4 Write property test for Sort preference round-trip (Property 17)
    - **Property 17: Sort preference localStorage round-trip** — Validates: Requirements 8.5, 8.6

- [x] 10. Checkpoint — Task List
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Quick Links panel
  - [x] 11.1 Implement pure Link helpers inside `js/app.js`
    - Write `validateLink(name, url, currentCount)` — returns `{ valid: boolean, errors: { name?, url?, capacity? } }` checking name length (1–50), URL prefix (`/^https?:\/\//i`), URL length (≤ 2048), and count (< 20).
    - Write `createLink(name, url)` — returns `{ id: Utils.generateId(), name: name.trim(), url }`.
    - Write `deleteLink(links, id)` — returns a new array without the element with matching `id`.
    - Write `serializeLinks(links)` — returns `JSON.stringify(links)`.
    - Write `deserializeLinks(json)` — returns parsed array or `[]` on any error.
    - _Requirements: 9.2, 9.3, 9.5, 9.9_

  - [x] 11.2 Write property tests for Link helpers (Properties 18–21)
    - **Property 18: Adding a valid link increases link count by exactly one** — Validates: Requirements 9.2
    - **Property 19: Link validation rejects all invalid inputs** — Validates: Requirements 9.3, 9.9
    - **Property 20: Deleting a link removes exactly that link** — Validates: Requirements 9.5
    - **Property 21: Link collection localStorage round-trip** — Validates: Requirements 9.6, 9.7

  - [x] 11.3 Implement `Links` module (DOM + persistence) inside `js/app.js`
    - Declare module-scoped state: `let _links = []`.
    - Write `Links.init()` — loads links via `deserializeLinks(Storage.get('tld_links'))`; if `Storage.get` returns `null` and storage appears unavailable, shows error per Req 9.8; renders panel.
    - Write `Links.addLink(name, url)` — calls `validateLink`; on success, pushes `createLink(name, url)` to `_links`, saves, re-renders, clears inputs; on failure, shows field-level inline errors.
    - Write `Links.deleteLink(id)` — calls `deleteLink(_links, id)`, saves, re-renders.
    - Implement `renderLinkList()` — maps `_links` to `<button>` (or `<a role="button">`) elements with `target="_blank" rel="noopener noreferrer"` and a delete `×` control.
    - Attach a single delegated `click` listener on `#link-list` for delete controls.
    - Attach `submit` listener on the add-link form; each link button's `click` calls `window.open(url, '_blank', 'noopener,noreferrer')`.
    - Handle `Storage.set` returning `false` with the storage-unavailable banner.
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9_

- [x] 12. Initialisation wiring
  - [x] 12.1 Wire `DOMContentLoaded` bootstrap in `js/app.js`
    - Inside the `DOMContentLoaded` handler, call in order: `Storage` (already initialised, no-op), `Theme.init()`, `Greeting.init()`, `Timer.init()`, `Tasks.init()`, `Links.init()`.
    - Implement the shared storage-unavailable dismissible banner (`<div id="storage-banner">`) shown when any `Storage.set` returns `false`; wire a close button.
    - _Requirements: 2.5, 6.3, 9.8, 10.5_

- [x] 13. Checkpoint — All modules wired
  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. Responsive layout and visual polish
  - [x] 14.1 Complete CSS layout and visual design in `css/style.css`
    - Complete grid layout rules for all four panels (desktop ≥ 768 px placement per design).
    - Add responsive single-column stack for `< 768 px`.
    - Add max-width container (`max-width: 1400px; margin: auto`) for `> 1400 px`.
    - Style panel cards (`.panel`), headings, inputs, buttons, checkboxes, error messages (`.error-msg`), sort control, and timer display.
    - Style `.timer-notification` overlay (hidden by default, shown by adding `.visible` class).
    - Style focus rings and ensure visible focus indicators in both themes.
    - Style task completion state (`text-decoration: line-through` on `.task-completed`).
    - Style link buttons and their delete `×` controls.
    - _Requirements: 12.3, 10.2_

  - [x] 14.2 Add accessibility attributes to `index.html` and rendered HTML
    - Add `aria-label` or `<label>` for every interactive control (name input, duration input, theme toggle, sort select, task add input, link name/URL inputs).
    - Link all error `<span class="error-msg">` elements to their inputs via `aria-describedby`.
    - Ensure timer notification region has `role="status"` or `aria-live="polite"`.
    - Add `aria-pressed` or `aria-checked` to the theme toggle as appropriate.
    - _Requirements: 5.3, 5.4 (inline errors must be screen-reader accessible)_

- [x] 15. Unit tests for all pure helpers
  - [x] 15.1 Write unit tests for Greeting helpers in `js/app.test.js`
    - Test `formatTime`: boundary hours (0, 23), boundary minutes (0, 59), single-digit padding.
    - Test `formatDate`: spot-check known dates, day/month names.
    - Test `getGreeting`: all 24 hours, boundary hours (5, 12, 18, 21, 0, 4).
    - Test `buildGreetingMessage`: with non-empty name, empty name, whitespace-only name.
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.2_

  - [x] 15.2 Write unit tests for Timer helpers in `js/app.test.js`
    - Test `formatTimer`: 0 s, 60 s, 3600 s, 7200 s, boundary padding.
    - Test `validateDuration`: valid (1, 25, 120), invalid (0, 121, -1, 1.5, NaN, "25", null).
    - _Requirements: 3.1, 3.9, 4.1, 4.4_

  - [x] 15.3 Write unit tests for Task helpers in `js/app.test.js`
    - Test `validateTaskTitle`: empty string, whitespace-only, 1 char, 200 chars, 201 chars.
    - Test `isDuplicate`: exact match, case-insensitive match, trim match, no match.
    - Test `createTask`: returned object shape and defaults.
    - Test `toggleTask`: false→true, true→false, field preservation.
    - Test `editTask`: title update, field preservation.
    - Test `deleteTask`: removes correct element, length decreases by 1, id not found (no-op).
    - Test `sortTasks`: all three sort options, no mutation of input array, single item, empty array.
    - Test `serializeTasks` / `deserializeTasks`: round-trip, malformed JSON returns `[]`.
    - _Requirements: 5.2, 5.3, 5.4, 5.6, 5.8, 5.11, 7.1, 8.2, 8.3, 8.4_

  - [x] 15.4 Write unit tests for Link helpers in `js/app.test.js`
    - Test `validateLink`: valid submission, empty name, name > 50 chars, non-http URL, URL > 2048 chars, count = 20.
    - Test `createLink`: returned object shape.
    - Test `deleteLink`: removes correct element, length decreases by 1.
    - Test `serializeLinks` / `deserializeLinks`: round-trip, malformed JSON returns `[]`.
    - Test `resolveTheme`: `'light'`, `'dark'`, `null`, `''`, unrecognised string.
    - _Requirements: 9.2, 9.3, 9.5, 9.9, 10.4_

- [-] 16. Final checkpoint — all tests pass
  - Ensure all unit and property-based tests pass, ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP. All core behaviour remains correct without them.
- Each task references specific requirements for end-to-end traceability.
- The `Storage` module is the single point of contact with `localStorage`; no other code calls `localStorage` directly.
- Property-based tests rely on [fast-check](https://github.com/dubzzz/fast-check) and are run in Node.js; pure helpers are exported at the bottom of `app.js` under a `typeof module !== 'undefined'` guard so the file still works as a plain browser script.
- All 22 correctness properties from the design document are covered by property sub-tasks 2.2, 4.3, 5.2, 7.2, 7.5, 9.2, 9.4, 11.2.
- Checkpoints (tasks 6, 8, 10, 13, 16) are natural pause points for review before moving to the next panel.

---

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["2.1", "3.1"] },
    { "id": 1, "tasks": ["2.2", "4.1"] },
    { "id": 2, "tasks": ["4.2"] },
    { "id": 3, "tasks": ["4.3", "5.1"] },
    { "id": 4, "tasks": ["5.2", "5.3"] },
    { "id": 5, "tasks": ["7.1"] },
    { "id": 6, "tasks": ["7.2", "7.3"] },
    { "id": 7, "tasks": ["7.4", "7.5"] },
    { "id": 8, "tasks": ["9.1"] },
    { "id": 9, "tasks": ["9.2", "9.3"] },
    { "id": 10, "tasks": ["9.4", "11.1"] },
    { "id": 11, "tasks": ["11.2", "11.3"] },
    { "id": 12, "tasks": ["12.1"] },
    { "id": 13, "tasks": ["14.1", "14.2"] },
    { "id": 14, "tasks": ["15.1", "15.2", "15.3", "15.4"] }
  ]
}
```
