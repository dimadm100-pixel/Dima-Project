// Per-build identity.
//
// Copies of this app can be served from the same origin (e.g. the site root
// and /brother on the same GitHub Pages site), and browser storage is shared
// across an origin. Every storage key is namespaced by APP_ID so one copy can
// never read or overwrite another's data. Changing APP_ID makes a build
// completely independent.

export const APP_ID = "dilmurod";
export const APP_NAME = "Dilmurod Finance";

// Keys used before namespacing existed. Only the original build adopts them,
// so a second copy on the same origin never inherits the first one's data.
export const LEGACY_KEYS = {
  data_v1: "pft_data_v1",
  apiKey: "pft_anthropic_key",
  model: "pft_anthropic_model",
  lastAccount: "pft_last_account"
};

export const storageKey = (name) => `pft_${APP_ID}_${name}`;

/**
 * Reads a namespaced key, adopting the pre-namespacing value the first time
 * if this build owns it. Without this, adding the namespace would make an
 * existing install look wiped.
 */
export function readWithLegacy(name) {
  const key = storageKey(name);
  const current = localStorage.getItem(key);
  if (current !== null) return current;

  const legacy = LEGACY_KEYS[name] ? localStorage.getItem(LEGACY_KEYS[name]) : null;
  if (legacy !== null) {
    localStorage.setItem(key, legacy);
    return legacy;
  }
  return null;
}
