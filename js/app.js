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
  };
}
