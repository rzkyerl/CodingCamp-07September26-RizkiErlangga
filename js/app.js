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
// =============================================================================

/**
 * Validates a link submission.
 * Rules:
 *   - name.trim().length must be >= 1 and <= 50
 *   - url must begin with "http://" or "https://" (case-insensitive)
 *   - url.length must be <= 2048
 *   - currentCount must be < 20 (capacity check)
 * @param {string} name
 * @param {string} url
 * @param {number} currentCount
 * @returns {{ valid: boolean, errors: { name?: string, url?: string, capacity?: string } }}
 */
function validateLink(name, url, currentCount) {
  const errors = {};

  // Capacity check (checked first so we can reject before field validation)
  if (currentCount >= 20) {
    errors.capacity = 'Maximum of 20 links reached.';
  }

  // Name validation
  const trimmedName = (name || '').trim();
  if (trimmedName.length === 0) {
    errors.name = 'Name is required.';
  } else if (trimmedName.length > 50) {
    errors.name = 'Name must be 50 characters or fewer.';
  }

  // URL validation
  const trimmedUrl = (url || '');
  if (!/^https?:\/\//i.test(trimmedUrl)) {
    errors.url = 'URL must begin with http:// or https://';
  } else if (trimmedUrl.length > 2048) {
    errors.url = 'URL must be 2048 characters or fewer.';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Creates a new Link object from a name and URL string.
 * @param {string} name
 * @param {string} url
 * @returns {{ id: string, name: string, url: string }}
 */
function createLink(name, url) {
  return {
    id:   Utils.generateId(),
    name: name.trim(),
    url,
  };
}

/**
 * Returns a new array that excludes the link whose `.id` matches `id`.
 * Does not mutate the input array.
 * @param {Object[]} links
 * @param {string} id
 * @returns {Object[]}
 */
function deleteLink(links, id) {
  return links.filter(l => l.id !== id);
}

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
// Tasks Module
// Manages the task list: CRUD operations, sorting, persistence, and DOM
// rendering.  All DOM access is null-guarded so the module does not crash
// when running inside the Node.js test harness.
// =============================================================================

// --------------- module-scoped state ----------------------------------------

/** @type {Array<{id:string, title:string, completed:boolean, createdAt:number}>} */
let _tasks = [];

/** @type {'default'|'az'|'za'} */
let _sort = 'default';

/**
 * The id of the task currently being edited, or null when none.
 * @type {string|null}
 */
let _editingId = null;

// --------------- private helpers --------------------------------------------

/**
 * Shows the storage-unavailable banner when a Storage.set call returns false.
 */
function _showStorageBanner() {
  const banner = document.getElementById('storage-banner');
  if (banner) banner.classList.add('visible');
}

/**
 * Persists the current `_tasks` array to localStorage.
 * Shows the storage banner if the write fails.
 */
function _saveTasks() {
  const ok = Storage.set(KEYS.TASKS, serializeTasks(_tasks));
  if (!ok) _showStorageBanner();
}

/**
 * Escapes a string for safe insertion into HTML attribute values and text.
 * Prevents XSS when task titles or link names are inserted into innerHTML.
 * @param {string} str
 * @returns {string}
 */
function _escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Returns the HTML string for a single task row in read mode.
 * @param {{id:string, title:string, completed:boolean, createdAt:number}} task
 * @returns {string}
 */
function _renderTaskItemReadMode(task) {
  const completedClass = task.completed ? ' task-completed' : '';
  const checkedAttr    = task.completed ? ' checked' : '';
  const escapedTitle   = _escapeHtml(task.title);
  const escapedId      = _escapeHtml(task.id);

  return `
    <li class="task-item${completedClass}" data-id="${escapedId}">
      <label class="task-checkbox-label">
        <input
          type="checkbox"
          class="task-toggle"
          ${checkedAttr}
          aria-label="Mark '${escapedTitle}' as ${task.completed ? 'incomplete' : 'complete'}"
        >
      </label>
      <span class="task-title">${escapedTitle}</span>
      <div class="task-actions">
        <button
          type="button"
          class="task-edit"
          aria-label="Edit task: ${escapedTitle}"
        >✎</button>
        <button
          type="button"
          class="task-delete"
          aria-label="Delete task: ${escapedTitle}"
        >✕</button>
      </div>
    </li>`.trim();
}

/**
 * Returns the HTML string for a single task row in edit mode.
 * @param {{id:string, title:string, completed:boolean, createdAt:number}} task
 * @returns {string}
 */
function _renderTaskItemEditMode(task) {
  const escapedTitle = _escapeHtml(task.title);
  const escapedId    = _escapeHtml(task.id);

  return `
    <li class="task-item task-item--editing" data-id="${escapedId}">
      <div class="task-edit-group">
        <input
          type="text"
          class="task-edit-input"
          value="${escapedTitle}"
          maxlength="200"
          aria-label="Edit task title"
          aria-describedby="task-edit-error-${escapedId}"
        >
        <span class="error-msg task-edit-error" id="task-edit-error-${escapedId}" role="alert"></span>
      </div>
      <div class="task-actions">
        <button
          type="button"
          class="task-save"
          aria-label="Save edit"
        >Save</button>
        <button
          type="button"
          class="task-cancel"
          aria-label="Cancel edit"
        >Cancel</button>
      </div>
    </li>`.trim();
}

/**
 * Returns the HTML string for a task row.
 * Delegates to read-mode or edit-mode based on `_editingId`.
 * @param {{id:string, title:string, completed:boolean, createdAt:number}} task
 * @returns {string}
 */
function _renderTaskItem(task) {
  return task.id === _editingId
    ? _renderTaskItemEditMode(task)
    : _renderTaskItemReadMode(task);
}

/**
 * Re-renders the full task list.
 * Calls sortTasks, maps through _renderTaskItem, and writes to #task-list.
 * Also syncs the sort <select> value to match _sort.
 */
function _renderTaskList() {
  const listEl = document.getElementById('task-list');
  if (!listEl) return;

  const sorted = sortTasks(_tasks, _sort);
  listEl.innerHTML = sorted.map(_renderTaskItem).join('');

  // Focus the edit input if we just switched a row into edit mode.
  if (_editingId !== null) {
    const editInput = listEl.querySelector('.task-item--editing .task-edit-input');
    if (editInput) {
      editInput.focus();
      // Move caret to end of existing text.
      const len = editInput.value.length;
      editInput.setSelectionRange(len, len);
    }
  }

  // Sync sort control value.
  const sortSelect = document.getElementById('task-sort');
  if (sortSelect && sortSelect.value !== _sort) {
    sortSelect.value = _sort;
  }
}

/**
 * Shows an inline error on the add-task input.
 * @param {string} message
 */
function _showAddError(message) {
  const errEl = document.getElementById('task-input-error');
  if (errEl) errEl.textContent = message;
}

/**
 * Clears the inline error on the add-task input.
 */
function _clearAddError() {
  const errEl = document.getElementById('task-input-error');
  if (errEl) errEl.textContent = '';
}

/**
 * Shows an inline error inside the currently-editing task row.
 * @param {string} id   — id of the task being edited
 * @param {string} message
 */
function _showEditError(id, message) {
  const errEl = document.getElementById(`task-edit-error-${id}`);
  if (errEl) errEl.textContent = message;
}

// --------------- public API -------------------------------------------------

const Tasks = {
  /**
   * Initialises the Tasks module.
   * Loads tasks and sort preference from Storage, renders the list,
   * and wires all event listeners.
   */
  init() {
    // Restore tasks from Storage.
    const storedTasks = Storage.get(KEYS.TASKS);
    _tasks = deserializeTasks(storedTasks);

    // Restore sort preference, defaulting to 'default'.
    const storedSort = Storage.get(KEYS.SORT);
    _sort = (storedSort === 'az' || storedSort === 'za') ? storedSort : 'default';

    // Render the initial list.
    _renderTaskList();

    // Pre-set the sort <select> to the loaded value.
    const sortSelect = document.getElementById('task-sort');
    if (sortSelect) {
      sortSelect.value = _sort;
      sortSelect.addEventListener('change', () => {
        Tasks.setSort(sortSelect.value);
      });
    }

    // Add-task form (supports both Enter and button click via 'submit').
    const taskForm = document.getElementById('task-form');
    if (taskForm) {
      taskForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = document.getElementById('task-input');
        if (input) Tasks.addTask(input.value);
      });
    }

    // Clear add-error on any input to the task title field.
    const taskInput = document.getElementById('task-input');
    if (taskInput) {
      taskInput.addEventListener('input', _clearAddError);
    }

    // Single delegated click listener on #task-list.
    const listEl = document.getElementById('task-list');
    if (listEl) {
      listEl.addEventListener('click', (e) => {
        // Find the closest ancestor (or self) with a data-id attribute.
        const item = e.target.closest('[data-id]');
        if (!item) return;
        const id = item.dataset.id;

        if (e.target.closest('.task-toggle')) {
          Tasks.toggleTask(id);
        } else if (e.target.closest('.task-edit')) {
          Tasks.startEdit(id);
        } else if (e.target.closest('.task-delete')) {
          Tasks.deleteTask(id);
        } else if (e.target.closest('.task-save')) {
          const editInput = item.querySelector('.task-edit-input');
          const newTitle  = editInput ? editInput.value : '';
          Tasks.saveEdit(id, newTitle);
        } else if (e.target.closest('.task-cancel')) {
          Tasks.cancelEdit(id);
        }
      });

      // Clear edit-error on input inside the task list (edit mode input).
      listEl.addEventListener('input', (e) => {
        if (e.target.classList.contains('task-edit-input')) {
          const item  = e.target.closest('[data-id]');
          if (!item) return;
          const errEl = document.getElementById(`task-edit-error-${item.dataset.id}`);
          if (errEl) errEl.textContent = '';
        }
      });
    }
  },

  /**
   * Validates a title, checks capacity and duplicates, creates the task,
   * saves, re-renders, and clears the input.  Shows inline errors on failure.
   * @param {string} title
   */
  addTask(title) {
    // Validation
    const v = validateTaskTitle(title);
    if (!v.valid) {
      _showAddError(v.error);
      const input = document.getElementById('task-input');
      if (input) input.focus();
      return;
    }

    // Capacity check (max 100 tasks)
    if (_tasks.length >= 100) {
      _showAddError('Maximum of 100 tasks reached.');
      const input = document.getElementById('task-input');
      if (input) input.focus();
      return;
    }

    // Duplicate check (case-insensitive, trim-invariant)
    if (isDuplicate(_tasks, title)) {
      _showAddError('A task with this title already exists.');
      const input = document.getElementById('task-input');
      if (input) input.focus();
      return;
    }

    // Create and append
    const task = createTask(title);
    _tasks.push(task);

    // Persist
    _saveTasks();

    // Clear input and error, then re-render
    const input = document.getElementById('task-input');
    if (input) input.value = '';
    _clearAddError();

    _editingId = null;
    _renderTaskList();
  },

  /**
   * Flips the completion state of the task with the given id, saves, and re-renders.
   * @param {string} id
   */
  toggleTask(id) {
    _tasks = _tasks.map(t => t.id === id ? toggleTask(t) : t);
    _saveTasks();
    _renderTaskList();
  },

  /**
   * Puts the task row with the given id into edit mode and re-renders.
   * @param {string} id
   */
  startEdit(id) {
    _editingId = id;
    _renderTaskList();
  },

  /**
   * Validates newTitle, updates the task, saves, and returns to read mode.
   * Shows an inline error inside the edit row on failure.
   * @param {string} id
   * @param {string} newTitle
   */
  saveEdit(id, newTitle) {
    const v = validateTaskTitle(newTitle);
    if (!v.valid) {
      _showEditError(id, v.error);
      return;
    }

    // Duplicate check — exclude the task being edited from the comparison.
    const otherTasks = _tasks.filter(t => t.id !== id);
    if (isDuplicate(otherTasks, newTitle)) {
      _showEditError(id, 'A task with this title already exists.');
      return;
    }

    _tasks = _tasks.map(t => t.id === id ? editTask(t, newTitle) : t);
    _editingId = null;
    _saveTasks();
    _renderTaskList();
  },

  /**
   * Cancels the in-progress edit and returns the row to read mode.
   * @param {string} id
   */
  cancelEdit(id) {
    if (_editingId === id) _editingId = null;
    _renderTaskList();
  },

  /**
   * Removes the task with the given id, saves, and re-renders.
   * @param {string} id
   */
  deleteTask(id) {
    if (_editingId === id) _editingId = null;
    _tasks = deleteTask(_tasks, id);
    _saveTasks();
    _renderTaskList();
  },

  /**
   * Persists the new sort option and re-renders the task list.
   * @param {'default'|'az'|'za'} option
   */
  setSort(option) {
    _sort = option;
    const ok = Storage.set(KEYS.SORT, option);
    if (!ok) _showStorageBanner();
    _renderTaskList();
  },
};

// =============================================================================
// Links Module
// Manages the Quick Links panel: loads saved links from Storage, renders
// clickable link buttons, supports adding and deleting links.
// All DOM access is null-guarded so the module does not crash when running
// inside the Node.js test harness.
// =============================================================================

/** Module-scoped state: in-memory links array. */
let _links = [];

/**
 * Renders the link list by rewriting the #link-list element's innerHTML.
 * Each link is a <li> containing:
 *   - an <a> (opens URL in new tab) acting as the link button
 *   - a <button class="link-delete"> carrying data-id for delegation
 * If there are no links, shows a placeholder message.
 */
function _renderLinkList() {
  const listEl = document.getElementById('link-list');
  if (!listEl) return;

  if (_links.length === 0) {
    listEl.innerHTML =
      '<li class="link-list__empty">No links saved yet. Add one above.</li>';
    return;
  }

  listEl.innerHTML = _links.map(link => {
    // Escape attribute values to prevent HTML injection.
    const safeName = link.name
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    const safeUrl = link.url
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    return `<li class="link-item" data-id="${link.id}">
  <a
    class="link-btn"
    href="${safeUrl}"
    target="_blank"
    rel="noopener noreferrer"
    aria-label="Open ${safeName} in a new tab"
  >${safeName}</a>
  <button
    class="link-delete"
    data-id="${link.id}"
    aria-label="Delete link ${safeName}"
    type="button"
  >×</button>
</li>`;
  }).join('');
}

/**
 * Shows the storage-unavailable banner.
 */
function _showLinkStorageBanner() {
  const banner = document.getElementById('storage-banner');
  if (banner) banner.classList.add('visible');
}

/**
 * Clears inline error messages on the add-link form.
 */
function _clearLinkErrors() {
  const nameErr     = document.getElementById('link-name-error');
  const urlErr      = document.getElementById('link-url-error');
  const capacityErr = document.getElementById('link-capacity-error');
  if (nameErr)     nameErr.textContent     = '';
  if (urlErr)      urlErr.textContent      = '';
  if (capacityErr) capacityErr.textContent = '';
}

const Links = {
  /**
   * Initialises the Quick Links panel.
   *
   * - Loads links from Storage via deserializeLinks(Storage.get('tld_links')).
   * - If Storage.get returns null (storage blocked/unavailable), shows Req 9.8
   *   error in #link-load-error.
   * - Renders the panel.
   * - Attaches the add-link form submit listener and the delegated click
   *   listener on #link-list.
   */
  init() {
    const raw = Storage.get(KEYS.LINKS);

    if (raw === null) {
      // null could mean: nothing saved yet (first run) OR storage unavailable.
      // We treat a completely absent entry as first-run (empty list) and only
      // show the load-error when we have evidence storage is broken — i.e.
      // Storage.set returns false for a no-op test write.
      const testOk = Storage.set(KEYS.LINKS, Storage.get(KEYS.LINKS) ?? '[]');
      if (!testOk) {
        // Storage is genuinely unavailable — show Req 9.8 error.
        const loadErrEl = document.getElementById('link-load-error');
        if (loadErrEl) {
          loadErrEl.textContent = 'Saved links could not be restored — storage is unavailable.';
          loadErrEl.removeAttribute('hidden');
        }
      }
      _links = [];
    } else {
      _links = deserializeLinks(raw);
    }

    _renderLinkList();

    // ---- Wire the add-link form submit listener ----
    const form = document.getElementById('link-add-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const nameInput = document.getElementById('link-name-input');
        const urlInput  = document.getElementById('link-url-input');
        const name = nameInput ? nameInput.value : '';
        const url  = urlInput  ? urlInput.value  : '';
        Links.addLink(name, url);
      });
    }

    // ---- Wire input events to clear errors on user re-type ----
    const nameInput = document.getElementById('link-name-input');
    const urlInput  = document.getElementById('link-url-input');

    if (nameInput) {
      nameInput.addEventListener('input', () => {
        const errEl = document.getElementById('link-name-error');
        if (errEl) errEl.textContent = '';
      });
    }

    if (urlInput) {
      urlInput.addEventListener('input', () => {
        const errEl = document.getElementById('link-url-error');
        if (errEl) errEl.textContent = '';
      });
    }

    // ---- Wire delegated click listener on #link-list ----
    const listEl = document.getElementById('link-list');
    if (listEl) {
      listEl.addEventListener('click', (e) => {
        const deleteBtn = e.target.closest('.link-delete');
        if (deleteBtn) {
          const id = deleteBtn.dataset.id;
          if (id) Links.deleteLink(id);
          return;
        }
        // Clicks on the <a> element are handled natively by the browser
        // (href + target="_blank").  No additional JS needed here.
      });
    }
  },

  /**
   * Validates and adds a new link.
   * On success: pushes to _links, persists, re-renders, clears inputs.
   * On failure: shows field-level inline errors.
   *
   * @param {string} name
   * @param {string} url
   */
  addLink(name, url) {
    _clearLinkErrors();

    const result = validateLink(name, url, _links.length);

    if (!result.valid) {
      if (result.errors.capacity) {
        const capacityErr = document.getElementById('link-capacity-error');
        if (capacityErr) capacityErr.textContent = result.errors.capacity;
      }
      if (result.errors.name) {
        const nameErr = document.getElementById('link-name-error');
        if (nameErr) nameErr.textContent = result.errors.name;
        const nameInput = document.getElementById('link-name-input');
        if (nameInput) nameInput.focus();
      }
      if (result.errors.url) {
        const urlErr = document.getElementById('link-url-error');
        if (urlErr) urlErr.textContent = result.errors.url;
        // Only move focus to URL input if name was valid (don't override name focus).
        if (!result.errors.name) {
          const urlInput = document.getElementById('link-url-input');
          if (urlInput) urlInput.focus();
        }
      }
      return;
    }

    // Create and append the new link.
    const link = createLink(name, url);
    _links.push(link);

    // Persist — show banner on storage failure.
    const ok = Storage.set(KEYS.LINKS, serializeLinks(_links));
    if (!ok) _showLinkStorageBanner();

    // Re-render and clear inputs.
    _renderLinkList();

    const nameInput = document.getElementById('link-name-input');
    const urlInput  = document.getElementById('link-url-input');
    if (nameInput) { nameInput.value = ''; nameInput.focus(); }
    if (urlInput)  urlInput.value = '';
  },

  /**
   * Removes the link with the given id and re-renders.
   *
   * @param {string} id
   */
  deleteLink(id) {
    _links = deleteLink(_links, id);

    const ok = Storage.set(KEYS.LINKS, serializeLinks(_links));
    if (!ok) _showLinkStorageBanner();

    _renderLinkList();
  },
};

// =============================================================================
// Node.js export guard — allows pure helpers to be imported in test files
// while the file continues to work as a plain browser <script>.
// =============================================================================
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    Theme.init();
    Greeting.init();
    Timer.init();
    Tasks.init();
    Links.init();

    const banner = document.getElementById('storage-banner');
    const closeBanner = document.querySelector('.banner-close');
    if (banner && closeBanner) {
      closeBanner.addEventListener('click', () => banner.classList.remove('visible'));
    }
  });
}

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
    validateLink,
    createLink,
    deleteLink,
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
    // Tasks module
    Tasks,
    // Task helpers are already exported above (validateTaskTitle, isDuplicate, etc.)
    // Links module
    Links,
  };
}
