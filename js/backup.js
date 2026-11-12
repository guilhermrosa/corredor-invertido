// Backup of everything the game keeps on this device (record, stats, achievements, options):
// a text code the player copies before reinstalling the app or changing phones, and pastes back.
// Only keys starting with 'ci-' are taken and restored.

const PREFIX = 'CI1:';

export function makeBackup() {
  const data = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('ci-') && k !== 'ci-debug') data[k] = localStorage.getItem(k);
  }
  const json = JSON.stringify({ v: 1, at: new Date().toISOString(), data });
  return PREFIX + btoa(String.fromCharCode(...new TextEncoder().encode(json)));
}

// Writes a backup back. Returns how many entries were restored; throws if the code is not valid.
export function restoreBackup(text) {
  const code = String(text).replace(/\s+/g, '');
  if (!code.startsWith(PREFIX)) throw new Error('not a backup');
  const bytes = Uint8Array.from(atob(code.slice(PREFIX.length)), c => c.charCodeAt(0));
  const { data } = JSON.parse(new TextDecoder().decode(bytes));
  const entries = Object.entries(data || {}).filter(([k, v]) => k.startsWith('ci-') && typeof v === 'string');
  if (!entries.length) throw new Error('empty backup');
  for (const [k, v] of entries) localStorage.setItem(k, v);
  return entries.length;
}
