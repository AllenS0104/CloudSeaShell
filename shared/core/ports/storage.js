/* SHARED CORE — single source of truth, do not edit per-end copies */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) {
    root.CloudSeaPorts = root.CloudSeaPorts || {};
    root.CloudSeaPorts.storage = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  const contract = {
    get: 'get(key) -> value | null',
    set: 'set(key, value) -> void; arrays/objects are JSON serialized by adapters',
    remove: 'remove(key) -> void',
    keys: 'keys() -> string[]',
  };

  const noop = {
    get() { return null; },
    set() {},
    remove() {},
    keys() { return []; },
  };

  return { contract, noop };
});
