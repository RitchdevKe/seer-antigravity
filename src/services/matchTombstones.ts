import { supabase } from '../lib/supabase';
import { getStableMatchId } from '../utils/matchId';
import type { Match } from '../types';

// -----------------------------------------------------------------------------
// Match tombstones
//
// Once a user deletes a match, we insert its stable id into a persistent
// tombstone table. All match loaders filter this set on read, so deleted
// matches never resurrect from embedded JSON, RAW_MATCHES, or a re-sync of
// uploaded/live/precalculated tables.
// -----------------------------------------------------------------------------

const LOCAL_KEY = 'prm_match_tombstones_v1';
let memory: Set<string> | null = null;
let hydrated = false;
let hydratePromise: Promise<void> | null = null;

function loadLocal(): Set<string> {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(LOCAL_KEY) : null;
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch { return new Set(); }
}

function saveLocal(set: Set<string>) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(Array.from(set)));
    }
  } catch { /* quota */ }
}

export async function hydrateTombstones(): Promise<Set<string>> {
  if (hydrated && memory) return memory;
  if (hydratePromise) { await hydratePromise; return memory ?? new Set(); }

  hydratePromise = (async () => {
    const local = loadLocal();
    const combined = new Set<string>(local);
    try {
      let from = 0;
      const step = 1000;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { data, error } = await supabase
          .from('deleted_match_tombstones')
          .select('stable_id')
          .range(from, from + step - 1);
        if (error) { console.warn('[tombstones] load failed', error); break; }
        if (!data || data.length === 0) break;
        for (const row of data) combined.add(String((row as any).stable_id));
        if (data.length < step) break;
        from += step;
      }
    } catch (e) {
      console.warn('[tombstones] hydrate error', e);
    }
    memory = combined;
    hydrated = true;
    saveLocal(combined);
  })();
  await hydratePromise;
  return memory ?? new Set();
}

export function getTombstoneSet(): Set<string> {
  if (!memory) memory = loadLocal();
  return memory;
}

export async function addTombstones(items: Array<string | number | Match>): Promise<void> {
  const set = getTombstoneSet();
  const newIds: string[] = [];
  for (const it of items) {
    const ids: string[] = [];
    if (it && typeof it === 'object') {
      ids.push(String((it as Match).id));
      try { ids.push(getStableMatchId(it as Match)); } catch { /* noop */ }
    } else {
      ids.push(String(it));
    }
    for (const id of ids) {
      if (id && !set.has(id)) { set.add(id); newIds.push(id); }
    }
  }
  if (newIds.length === 0) return;
  saveLocal(set);

  // Best-effort background persistence to Supabase.
  try {
    const rows = newIds.map(stable_id => ({ stable_id }));
    // chunk to avoid huge single requests
    for (let i = 0; i < rows.length; i += 200) {
      const chunk = rows.slice(i, i + 200);
      const { error } = await supabase
        .from('deleted_match_tombstones')
        .upsert(chunk, { onConflict: 'stable_id' });
      if (error) console.warn('[tombstones] upsert failed', error);
    }
  } catch (e) {
    console.warn('[tombstones] persist error', e);
  }
}

export async function removeTombstones(items: Array<string | number | Match>): Promise<void> {
  const set = getTombstoneSet();
  const idsToRemove: string[] = [];
  for (const it of items) {
    const ids: string[] = [];
    if (it && typeof it === 'object') {
      ids.push(String((it as Match).id));
      try { ids.push(getStableMatchId(it as Match)); } catch { /* noop */ }
    } else {
      ids.push(String(it));
    }
    for (const id of ids) {
      if (id && set.has(id)) { set.delete(id); idsToRemove.push(id); }
    }
  }
  if (idsToRemove.length === 0) return;
  saveLocal(set);

  // Background delete from Supabase
  try {
    // Note: since our shim might not support .in() deletes properly if we send 200 items,
    // we just let it sync or run a delete.
    // We'll chunk the deletes if needed.
    for (let i = 0; i < idsToRemove.length; i += 50) {
      const chunk = idsToRemove.slice(i, i + 50);
      await supabase
        .from('deleted_match_tombstones')
        .delete()
        .in('stable_id', chunk);
    }
  } catch (e) {
    console.warn('[tombstones] delete persist error', e);
  }
}

export function filterTombstoned<T extends { id: string | number }>(list: T[]): T[] {
  const set = getTombstoneSet();
  if (set.size === 0) return list;
  return list.filter(m => {
    if (set.has(String(m.id))) return false;
    try {
      const sid = getStableMatchId(m as unknown as Match);
      if (sid && set.has(sid)) return false;
    } catch { /* noop */ }
    return true;
  });
}

