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
// Full implementations are provided in task 9.1; these stubs satisfy the
// Node.js export guard so property tests can import and exercise them.
// =============================================================================

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
 * Returns [] on any parse error.
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
// Node.js export guard — allows pure helpers to be imported in test files
// while the file continues to work as a plain browser <script>.
// =============================================================================
if (typeof module !== 'undefined') {
  module.exports = {
    ...(module.exports || {}),
    Storage,
    KEYS,
    Utils,
    serializeTasks,
    deserializeTasks,
    serializeLinks,
    deserializeLinks,
    resolveTheme,
    Theme,
    formatTime,
    formatDate,
    getGreeting,
    buildGreetingMessage,
  };
}
