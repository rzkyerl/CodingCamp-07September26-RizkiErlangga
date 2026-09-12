/* ============================================================
   Todo Life Dashboard — js/app.js
   Single flat file; no build step, no ES module imports.
   All modules are plain object literals or IIFEs.
   ============================================================ */

// =============================================================================
// STORAGE KEYS
// Central constants for all localStorage keys used by the dashboard.
// =============================================================================
const KEYS = {
  NAME:     'tld_name',
  DURATION: 'tld_duration',
  TASKS:    'tld_tasks',
  SORT:     'tld_sort',
  LINKS:    'tld_links',
  THEME:    'tld_theme',
};

// =============================================================================
// Storage Module
// Thin wrapper around localStorage.
// All reads/writes go through this module; swallows SecurityError
// when storage is blocked (e.g. private browsing mode).
// =============================================================================
const Storage = {
  /**
   * Reads a value from localStorage.
   * @param {string} key
   * @returns {string|null} Stored string, or null if absent or on error.
   */
  get(key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  },

  /**
   * Writes a value to localStorage.
   * @param {string} key
   * @param {string} value
   * @returns {boolean} true on success, false if storage is unavailable.
   */
  set(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (e) {
      return false;
    }
  },

  /**
   * Removes a value from localStorage.
   * @param {string} key
   * @returns {void}
   */
  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      // Silently ignore — removal failure is non-critical.
    }
  },
};

// =============================================================================
// Utils Module
// Pure helper functions — no DOM dependencies, no external libraries.
// =============================================================================

const Utils = {
  /**
   * Returns a UUID string.
   * Prefers crypto.randomUUID() where available; falls back to a
   * Date.now() + Math.random() composite string for older environments.
   * @returns {string}
   */
  generateId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    // Fallback: "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx" style string
    return (
      Date.now().toString(36) +
      '-' +
      Math.random().toString(36).slice(2, 11)
    );
  },

  /**
   * Zero-pads a number to at least two characters.
   * e.g. padTwo(5) → "05", padTwo(12) → "12"
   * @param {number} n
   * @returns {string}
   */
  padTwo(n) {
    return String(n).padStart(2, '0');
  },

  /**
   * Clamps a number to [min, max].
   * e.g. clamp(150, 1, 120) → 120, clamp(-5, 1, 120) → 1
   * @param {number} val
   * @param {number} min
   * @param {number} max
   * @returns {number}
   */
  clamp(val, min, max) {
    return Math.min(Math.max(val, min), max);
  },

  /**
   * Trims leading/trailing whitespace and lowercases the string.
   * e.g. trimAndLower("  Hello World  ") → "hello world"
   * @param {string} str
   * @returns {string}
   */
  trimAndLower(str) {
    return str.trim().toLowerCase();
  },
};

// =============================================================================
// Task helpers — pure functions (no DOM dependencies).
// =============================================================================

/**
 * Validates a task title string.
 * Rules:
 *   - Trimmed length must be >= 1 (non-empty / not whitespace-only).
 *   - Raw length must be <= 200 characters.
 * @param {string} title
 * @returns {{ valid: boolean, error: string }}
 */
function validateTaskTitle(title) {
  if (!title || title.trim().length === 0) {
    return { valid: false, error: 'Title is required.' };
  }
  if (title.length > 200) {
    return { valid: false, error: 'Title must be 200 characters or fewer.' };
  }
  return { valid: true, error: '' };
}

/**
 * Returns true if the tasks array already contains an item whose trimmed,
 * lowercased title matches the given title (case-insensitive, trim-invariant).
 * @param {Object[]} tasks
 * @param {string} title
 * @returns {boolean}
 */
function isDuplicate(tasks, title) {
  const normalised = Utils.trimAndLower(title);
  return tasks.some(t => Utils.trimAndLower(t.title) === normalised);
}

/**
 * Creates a new Task object from a title string.
 * @param {string} title
 * @returns {{ id: string, title: string, completed: boolean, createdAt: number }}
 */
function createTask(title) {
  return {
    id:        Utils.generateId(),
    title:     title.trim(),
    completed: false,
    createdAt: Date.now(),
  };
}

/**
 * Returns a new Task with the `completed` flag flipped; all other fields
 * are preserved unchanged.
 * @param {{ id: string, title: string, completed: boolean, createdAt: number }} task
 * @returns {{ id: string, title: string, completed: boolean, createdAt: number }}
 */
function toggleTask(task) {
  return { ...task, completed: !task.completed };
}

/**
 * Returns a new Task with the title replaced by `newTitle.trim()`; all other
 * fields (id, completed, createdAt) are preserved unchanged.
 * @param {{ id: string, title: string, completed: boolean, createdAt: number }} task
 * @param {string} newTitle
 * @returns {{ id: string, title: string, completed: boolean, createdAt: number }}
 */
function editTask(task, newTitle) {
  return { ...task, title: newTitle.trim() };
}

/**
 * Returns a new array that excludes the task whose `.id` matches `id`.
 * Does not mutate the input array.
 * @param {Object[]} tasks
 * @param {string} id
 * @returns {Object[]}
 */
function deleteTask(tasks, id) {
  return tasks.filter(t => t.id !== id);
}

/**
 * Returns a new sorted copy of `tasks` according to `option`.
 *   'default' → newest first (descending createdAt)
 *   'az'      → ascending by trimmed, lowercased title
 *   'za'      → descending by trimmed, lowercased title
 * The original array is NOT mutated.
 * @param {Object[]} tasks
 * @param {'default'|'az'|'za'} option
 * @returns {Object[]}
 */
function sortTasks(tasks, option) {
  const copy = [...tasks];
  if (option === 'az') {
    copy.sort((a, b) =>
      Utils.trimAndLower(a.title).localeCompare(Utils.trimAndLower(b.title))
    );
  } else if (option === 'za') {
    copy.sort((a, b) =>
      Utils.trimAndLower(b.title).localeCompare(Utils.trimAndLower(a.title))
    );
  } else {
    // 'default': newest first
    copy.sort((a, b) => b.createdAt - a.createdAt);
  }
  return copy;
}

/**
 * Serialises a task array to a JSON string.
 * @param {Object[]} tasks
 * @returns {string}
 */
function serializeTasks(tasks) {
  return JSON.stringify(tasks);
}

/**
 * Deserialises a JSON string to a task array.
 * Returns [] on any parse error or if the result is not an array.
 * @param {string|null} json
 * @returns {Object[]}
 */
function deserializeTasks(json) {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

// =============================================================================
// Link helpers — pure functions (no DOM dependencies).
// Full implementations are provided in task 11.1.
// =============================================================================

/**
 * Serialises a link array to a JSON string.
 * @param {Object[]} links
 * @returns {string}
 */
function serializeLinks(links) {
  return JSON.stringify(links);
}

/**
 * Deserialises a JSON string to a link array.
 * Returns [] on any parse error.
 * @param {string|null} json
 * @returns {Object[]}
 */
function deserializeLinks(json) {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

// =============================================================================
// Theme helpers — pure function (no DOM dependency).
// =============================================================================

/**
 * Resolves a stored theme string to a valid theme value.
 * Returns 'dark' only when the stored value is exactly 'dark';
 * defaults to 'light' for any absent or unrecognised value.
 * @param {string|null} stored
 * @returns {'light'|'dark'}
 */
function resolveTheme(stored) {
  return stored === 'dark' ? 'dark' : 'light';
}

// =============================================================================
// Theme Module
// Manages the light/dark theme: loads from Storage, applies to the <html>
// element via data-theme, and persists user changes.
// =============================================================================

let _currentTheme = 'light';

const Theme = {
  /**
   * Loads the saved theme from Storage, resolves it, applies it to
   * document.documentElement.dataset.theme, and wires the toggle button.
   */
  init() {
    const stored = Storage.get(KEYS.THEME);
    _currentTheme = resolveTheme(stored);
    document.documentElement.dataset.theme = _currentTheme;

    // Wire theme toggle button — guard against missing element
    const btn = document.getElementById('theme-toggle');
    if (btn) {
      btn.addEventListener('click', () => Theme.toggle());
    }
  },

  /**
   * Flips the current theme between 'light' and 'dark',
   * persists the new value via Storage, and updates dataset.theme.
   */
  toggle() {
    _currentTheme = _currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = _currentTheme;

    const ok = Storage.set(KEYS.THEME, _currentTheme);
    if (!ok) {
      // Storage unavailable — show the banner if it exists in the DOM
      const banner = document.getElementById('storage-banner');
      if (banner) banner.classList.add('visible');
    }
  },
};

// =============================================================================
// Greeting helpers — pure functions (no DOM dependencies).
// =============================================================================

const _DAY_NAMES = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
];

const _MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * Formats a Date object as "HH:MM" in 24-hour time.
 * @param {Date} date
 * @returns {string} e.g. "09:05"
 */
function formatTime(date) {
  return Utils.padTwo(date.getHours()) + ':' + Utils.padTwo(date.getMinutes());
}

/**
 * Formats a Date object as "Weekday, DD MonthName YYYY".
 * @param {Date} date
 * @returns {string} e.g. "Monday, 12 September 2026"
 */
function formatDate(date) {
  const weekday = _DAY_NAMES[date.getDay()];
  const day     = Utils.padTwo(date.getDate());
  const month   = _MONTH_NAMES[date.getMonth()];
  const year    = date.getFullYear();
  return `${weekday}, ${day} ${month} ${year}`;
}

/**
 * Returns a contextual greeting string based on the hour of the day.
 * Mapping:
 *   05–11 → "Good morning"
 *   12–17 → "Good afternoon"
 *   18–20 → "Good evening"
 *   21–23, 0–4 → "Good night"
 * @param {number} hour — integer in [0, 23]
 * @returns {string}
 */
function getGreeting(hour) {
  if (hour >= 5 && hour <= 11) return 'Good morning';
  if (hour >= 12 && hour <= 17) return 'Good afternoon';
  if (hour >= 18 && hour <= 20) return 'Good evening';
  return 'Good night'; // 21–23, 0–4
}

/**
 * Builds the full greeting line.
 * Returns `greeting + ", " + name.trim()` when the trimmed name is non-empty,
 * otherwise returns the greeting alone.
 * @param {string} greeting — e.g. "Good morning"
 * @param {string|null|undefined} name — user-supplied name
 * @returns {string}
 */
function buildGreetingMessage(greeting, name) {
  const trimmed = (name || '').trim();
  return trimmed.length > 0 ? `${greeting}, ${trimmed}` : greeting;
}

// =============================================================================
// Greeting Module
// Manages the greeting panel: loads the saved name, renders time/date/greeting
// on load and every 60 seconds, and lets the user persist a custom name.
// DOM-dependent — not exported to Node.js.
// =============================================================================

/** Module-scoped state: the last successfully saved (or loaded) name. */
let _greetingName = '';

/** @type {number|null} setInterval handle for the clock tick. */
let _greetingIntervalId = null;

/**
 * Internal render — reads the current time and updates all three
 * greeting DOM nodes. All querySelector calls are null-guarded.
 */
function _renderGreeting() {
  const now  = new Date();
  const timeEl    = document.getElementById('greeting-time');
  const dateEl    = document.getElementById('greeting-date');
  const msgEl     = document.getElementById('greeting-message');

  if (timeEl) timeEl.textContent = formatTime(now);
  if (dateEl) dateEl.textContent = formatDate(now);
  if (msgEl)  msgEl.textContent  = buildGreetingMessage(getGreeting(now.getHours()), _greetingName);
}

const Greeting = {
  /**
   * Initialises the greeting panel.
   * Reads the saved name from Storage, fires an immediate render,
   * starts the 60-second clock tick, and wires the name input events.
   */
  init() {
    // Restore persisted name (may be null if nothing saved yet).
    const saved = Storage.get(KEYS.NAME);
    _greetingName = saved ? saved.trim() : '';

    // Pre-fill the name input if we have a saved name.
    const nameInput = document.getElementById('greeting-name-input');
    if (nameInput && _greetingName) {
      nameInput.value = _greetingName;
    }

    // Render immediately so there is no blank flash on load.
    _renderGreeting();

    // Start the 60-second tick (cancel any previous interval first).
    if (_greetingIntervalId !== null) clearInterval(_greetingIntervalId);
    _greetingIntervalId = setInterval(_renderGreeting, 60_000);

    // Wire name-input events.
    if (nameInput) {
      // Save on blur (user tabs or clicks away).
      nameInput.addEventListener('blur', () => {
        Greeting.saveName(nameInput.value);
      });

      // Save on Enter key.
      nameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          Greeting.saveName(nameInput.value);
        }
      });

      // Clear the inline error as soon as the user starts typing again.
      nameInput.addEventListener('input', () => {
        const errEl = document.getElementById('greeting-name-error');
        if (errEl) errEl.textContent = '';
      });
    }
  },

  /**
   * Validates and persists a custom greeting name.
   * Validation: trimmed length must be 1–50 characters.
   * On success: updates _greetingName, persists to Storage, re-renders.
   * On failure: shows an inline error (or console.warn if element absent).
   * On Storage failure: shows the storage-unavailable banner.
   * @param {string} name
   */
  saveName(name) {
    const trimmed = (name || '').trim();
    const errEl   = document.getElementById('greeting-name-error');

    if (trimmed.length === 0 || trimmed.length > 50) {
      const msg = trimmed.length === 0
        ? 'Name cannot be empty.'
        : 'Name must be 50 characters or fewer.';

      if (errEl) {
        errEl.textContent = msg;
      } else {
        console.warn('[Greeting.saveName]', msg);
      }
      return;
    }

    // Clear any previous error.
    if (errEl) errEl.textContent = '';

    // Update in-memory state.
    _greetingName = trimmed;

    // Persist — show the banner if Storage is unavailable.
    const ok = Storage.set(KEYS.NAME, trimmed);
    if (!ok) {
      const banner = document.getElementById('storage-banner');
      if (banner) banner.classList.add('visible');
    }

    // Re-render to show the updated name in the greeting message.
    _renderGreeting();
  },
};

// =============================================================================
// Timer helpers — pure functions (no DOM dependencies).
// =============================================================================

/**
 * Formats a duration in total seconds as "MM:SS" (both components zero-padded).
 * e.g. formatTimer(90) → "01:30", formatTimer(3600) → "60:00"
 * @param {number} totalSeconds — non-negative integer
 * @returns {string}
 */
function formatTimer(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return Utils.padTwo(minutes) + ':' + Utils.padTwo(seconds);
}

/**
 * Validates a Pomodoro duration value.
 * Returns true iff value is a whole integer satisfying 1 ≤ value ≤ 120.
 * Rejects: non-numbers, non-integers (e.g. 1.5), out-of-range values,
 * NaN, null, undefined, strings, etc.
 * @param {*} value
 * @returns {boolean}
 */
function validateDuration(value) {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 120
  );
}

// =============================================================================
// Timer Module
// Countdown state machine (STOPPED / RUNNING / PAUSED) that drives the focus
// timer panel.  All DOM access is null-guarded so the module does not crash
// when running inside the Node.js test harness.
// =============================================================================

// --------------- module-scoped state ----------------------------------------
/** @type {'STOPPED'|'RUNNING'|'PAUSED'} */
let _timerState = 'STOPPED';

/** Remaining seconds in the current session. */
let _remaining = 25 * 60;

/** Currently active duration in minutes. */
let _duration = 25;

/**
 * Duration (minutes) queued while a session is running.
 * Applied the next time the timer resets.
 * @type {number|null}
 */
let _pendingDuration = null;

/** @type {number|null} setInterval handle for the 1-second tick. */
let _timerIntervalId = null;

/**
 * Lazily-created AudioContext.
 * Must be created inside a user-gesture handler to satisfy browser
 * autoplay policies — initialised on the first Timer.start() call.
 * @type {AudioContext|null}
 */
let _audioContext = null;

// --------------- private helpers --------------------------------------------

/**
 * Initialises `_audioContext` on the first call (no-op thereafter).
 * Must be called from inside a user-gesture handler (e.g. Timer.start()).
 * Silently does nothing if the Web Audio API is unavailable.
 */
function _initAudioContext() {
  if (_audioContext !== null) return;
  // Both the standard and webkit-prefixed constructors are checked for
  // compatibility with older Safari versions.
  const Ctor = typeof AudioContext !== 'undefined'
    ? AudioContext
    : (typeof webkitAudioContext !== 'undefined' ? webkitAudioContext : null);
  if (Ctor) {
    try {
      _audioContext = new Ctor();
    } catch (e) {
      // Construction failed — audio will be silently skipped.
    }
  }
}

/**
 * Plays a short beep (~440 Hz sine wave, 0.5 s) via the Web Audio API.
 * Called when the countdown reaches zero.
 * No-op if AudioContext was never initialised or is unsupported.
 */
function _playTimerAlert() {
  if (_audioContext === null) return;
  try {
    const oscillator = _audioContext.createOscillator();
    oscillator.type = 'sine';
    oscillator.frequency.value = 440; // A4 note
    oscillator.connect(_audioContext.destination);
    oscillator.start(_audioContext.currentTime);
    oscillator.stop(_audioContext.currentTime + 0.5);
  } catch (e) {
    // Audio playback failed — visual notification still shows, so this is safe to swallow.
  }
}

/**
 * Writes the current `_remaining` value to `#timer-display`.
 */
function _renderTimerDisplay() {
  const display = document.getElementById('timer-display');
  if (display) display.textContent = formatTimer(_remaining);
}

/**
 * Enables/disables the three timer buttons to match `_timerState`.
 *
 * Button states:
 *   STOPPED → Start=enabled, Stop=disabled,  Reset=enabled
 *   RUNNING → Start=disabled, Stop=enabled,  Reset=disabled
 *   PAUSED  → Start=enabled,  Stop=disabled, Reset=enabled
 */
function _updateTimerButtons() {
  const startBtn = document.getElementById('timer-start');
  const stopBtn  = document.getElementById('timer-stop');
  const resetBtn = document.getElementById('timer-reset');

  if (!startBtn || !stopBtn || !resetBtn) return;

  if (_timerState === 'RUNNING') {
    startBtn.disabled = true;
    stopBtn.disabled  = false;
    resetBtn.disabled = true;
  } else {
    // STOPPED or PAUSED
    startBtn.disabled = false;
    stopBtn.disabled  = true;
    resetBtn.disabled = false;
  }
}

/**
 * Internal tick called every 1 second while RUNNING.
 * Decrements `_remaining`; handles session end when it reaches 0.
 */
function _timerTick() {
  _remaining -= 1;
  _renderTimerDisplay();

  if (_remaining <= 0) {
    _remaining = 0;
    // Stop the interval first.
    clearInterval(_timerIntervalId);
    _timerIntervalId = null;
    _timerState = 'STOPPED';

    // Update buttons to reflect STOPPED state.
    _updateTimerButtons();

    // Audible alert (stub — full implementation in task 7.4).
    _playTimerAlert();

    // Show the visual notification overlay.
    const notification = document.querySelector('.timer-notification');
    if (notification) notification.classList.add('visible');
  }
}

// --------------- public API -------------------------------------------------

const Timer = {
  /**
   * Loads the persisted duration from Storage, validates it, renders the
   * initial display, and wires all button / input event listeners.
   * Called once from DOMContentLoaded.
   */
  init() {
    // Restore persisted duration, falling back to 25 min on any problem.
    const stored = Storage.get(KEYS.DURATION);
    const parsed = stored !== null ? parseInt(stored, 10) : NaN;
    _duration  = validateDuration(parsed) ? parsed : 25;
    _remaining = _duration * 60;

    // Initial render.
    _renderTimerDisplay();
    _updateTimerButtons();

    // Pre-fill the duration input with the active duration.
    const durationInput = document.getElementById('timer-duration');
    if (durationInput) {
      durationInput.value = _duration;

      // Apply the new duration when the user changes the input value.
      durationInput.addEventListener('change', () => {
        Timer.setDuration(parseInt(durationInput.value, 10));
      });
      durationInput.addEventListener('blur', () => {
        Timer.setDuration(parseInt(durationInput.value, 10));
      });
    }

    // Wire Start button.
    const startBtn = document.getElementById('timer-start');
    if (startBtn) {
      startBtn.addEventListener('click', () => Timer.start());
    }

    // Wire Stop button.
    const stopBtn = document.getElementById('timer-stop');
    if (stopBtn) {
      stopBtn.addEventListener('click', () => Timer.stop());
    }

    // Wire Reset button.
    const resetBtn = document.getElementById('timer-reset');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => Timer.reset());
    }
  },

  /**
   * Starts the countdown.
   * Valid transitions: STOPPED → RUNNING, PAUSED → RUNNING.
   * No-op if already RUNNING.
   */
  start() {
    if (_timerState === 'RUNNING') return;

    // Initialise AudioContext on this user gesture so the alert is allowed
    // by browser autoplay policies when the session later completes.
    _initAudioContext();

    // Dismiss the notification overlay if visible (re-starting after session end).
    const notification = document.querySelector('.timer-notification');
    if (notification) notification.classList.remove('visible');

    _timerState = 'RUNNING';
    _updateTimerButtons();

    // Guard against double-start.
    if (_timerIntervalId !== null) clearInterval(_timerIntervalId);
    _timerIntervalId = setInterval(_timerTick, 1_000);
  },

  /**
   * Pauses the countdown.
   * Valid transition: RUNNING → PAUSED.
   * No-op if not currently RUNNING.
   */
  stop() {
    if (_timerState !== 'RUNNING') return;

    clearInterval(_timerIntervalId);
    _timerIntervalId = null;
    _timerState = 'PAUSED';
    _updateTimerButtons();
  },

  /**
   * Resets the timer to the current (or pending) duration.
   * Valid transitions: RUNNING → STOPPED (also stops tick), PAUSED → STOPPED,
   * STOPPED → STOPPED.
   */
  reset() {
    // Stop any running tick.
    if (_timerIntervalId !== null) {
      clearInterval(_timerIntervalId);
      _timerIntervalId = null;
    }

    // Apply a queued duration change if there is one.
    if (_pendingDuration !== null) {
      _duration = _pendingDuration;
      _pendingDuration = null;

      // Sync the duration input to the newly applied value.
      const durationInput = document.getElementById('timer-duration');
      if (durationInput) durationInput.value = _duration;
    }

    _timerState = 'STOPPED';
    _remaining  = _duration * 60;

    // Dismiss the notification overlay.
    const notification = document.querySelector('.timer-notification');
    if (notification) notification.classList.remove('visible');

    _renderTimerDisplay();
    _updateTimerButtons();
  },

  /**
   * Validates and applies (or queues) a new Pomodoro duration.
   *
   * - If the timer is NOT running: applies immediately, resets the display.
   * - If the timer IS running: stores as `_pendingDuration`; applied on next Reset.
   * - Always persists to Storage.
   * - Rejects invalid values, shows `#timer-duration-error`, restores input.
   *
   * @param {number} mins — new duration in minutes
   */
  setDuration(mins) {
    const errEl = document.getElementById('timer-duration-error');
    const durationInput = document.getElementById('timer-duration');

    if (!validateDuration(mins)) {
      const msg = 'Duration must be a whole number between 1 and 120 minutes.';
      if (errEl) errEl.textContent = msg;
      // Restore the input to the current valid duration.
      if (durationInput) durationInput.value = _duration;
      return;
    }

    // Clear any previous error.
    if (errEl) errEl.textContent = '';

    // Persist the new value.
    const ok = Storage.set(KEYS.DURATION, String(mins));
    if (!ok) {
      const banner = document.getElementById('storage-banner');
      if (banner) banner.classList.add('visible');
    }

    if (_timerState === 'RUNNING') {
      // Queue the change — apply when the session ends and timer resets.
      _pendingDuration = mins;
    } else {
      // Apply immediately and reset the display.
      _duration  = mins;
      _remaining = _duration * 60;
      _pendingDuration = null;
      _renderTimerDisplay();
    }
  },
};

// =============================================================================
// Node.js export guard — allows pure helpers to be imported in test files
// while the file continues to work as a plain browser <script>.
// =============================================================================
if (typeof module !== 'undefined') {
  module.exports = {
    ...(module.exports || {}),
    Storage,
    KEYS,
    Utils,
    // Task helpers
    validateTaskTitle,
    isDuplicate,
    createTask,
    toggleTask,
    editTask,
    deleteTask,
    sortTasks,
    serializeTasks,
    deserializeTasks,
    // Link helpers
    serializeLinks,
    deserializeLinks,
    // Theme helpers
    resolveTheme,
    Theme,
    // Greeting helpers
    formatTime,
    formatDate,
    getGreeting,
    buildGreetingMessage,
    // Timer helpers
    formatTimer,
    validateDuration,
  };
}
