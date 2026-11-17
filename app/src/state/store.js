import React, { createContext, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { reducer } from './reducer';
import { DEFAULT_STATE, STORAGE_KEY } from './defaults';

const StoreContext = createContext(null);

// Daily logs are stored one key per month so no single stored value grows too large
// (Android's SQLite-backed AsyncStorage struggles with values over ~2 MB).
const CORE_KEY = `${STORAGE_KEY}:core`;
const MONTH_PREFIX = `${STORAGE_KEY}:days:`;

const monthOf = (dayKey) => dayKey.slice(0, 7);

function groupByMonth(days) {
  const out = {};
  for (const [k, v] of Object.entries(days)) {
    const m = monthOf(k);
    (out[m] = out[m] || {})[k] = v;
  }
  return out;
}

async function loadState() {
  const keys = await AsyncStorage.getAllKeys();
  const monthKeys = keys.filter((k) => k.startsWith(MONTH_PREFIX));
  const pairs = await AsyncStorage.multiGet([CORE_KEY, STORAGE_KEY, ...monthKeys]);
  const map = Object.fromEntries(pairs);
  let core = map[CORE_KEY] ? JSON.parse(map[CORE_KEY]) : null;
  // Older single-blob format
  if (!core && map[STORAGE_KEY]) core = JSON.parse(map[STORAGE_KEY]);
  if (!core) return { state: null, months: [] };
  const days = { ...(core.days || {}) };
  for (const k of monthKeys) {
    if (map[k]) Object.assign(days, JSON.parse(map[k]));
  }
  return { state: { ...core, days }, months: monthKeys.map((k) => k.slice(MONTH_PREFIX.length)) };
}

// All data lives only on this device (AsyncStorage). Nothing is sent anywhere.
export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, DEFAULT_STATE);
  const [ready, setReady] = useState(false);
  const saveTimer = useRef(null);
  const saved = useRef({ days: null, months: new Set() });

  useEffect(() => {
    (async () => {
      try {
        const { state: loaded, months } = await loadState();
        saved.current.months = new Set(months);
        if (loaded) dispatch({ type: 'LOADED', state: loaded });
      } catch (e) {
        console.warn('Failed to load saved data', e);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!ready) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        const { days, ...core } = state;
        const prevDays = saved.current.days;
        const byMonth = groupByMonth(days);

        // Only rewrite months whose day objects changed since the last save.
        const dirty = new Set();
        if (!prevDays) Object.keys(byMonth).forEach((m) => dirty.add(m));
        else {
          for (const k of Object.keys(days)) if (days[k] !== prevDays[k]) dirty.add(monthOf(k));
          for (const k of Object.keys(prevDays)) if (!(k in days)) dirty.add(monthOf(k));
        }
        const writes = [[CORE_KEY, JSON.stringify(core)]];
        const removals = [];
        for (const m of dirty) {
          if (byMonth[m]) writes.push([MONTH_PREFIX + m, JSON.stringify(byMonth[m])]);
          else removals.push(MONTH_PREFIX + m);
        }
        // Months that were stored previously but no longer exist (e.g. after reset/import)
        for (const m of saved.current.months) if (!byMonth[m] && !dirty.has(m)) removals.push(MONTH_PREFIX + m);

        await AsyncStorage.multiSet(writes);
        if (removals.length) await AsyncStorage.multiRemove(removals);
        await AsyncStorage.removeItem(STORAGE_KEY); // drop legacy single blob if present
        saved.current = { days, months: new Set(Object.keys(byMonth)) };
      } catch (e) {
        console.warn('Save failed', e);
      }
    }, 300);
    return () => clearTimeout(saveTimer.current);
  }, [state, ready]);

  const value = useMemo(() => ({ state, dispatch, ready }), [state, ready]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}
