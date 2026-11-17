// Keeps Health Connect data fresh: reads it when the app opens or comes back to the
// front (at most every 5 minutes), and on "Sync now".
import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { hcRead } from '../lib/healthConnect';

const MIN_GAP_MS = 5 * 60 * 1000;

export async function syncHealthConnect(state, dispatch) {
  const settings = state.healthConnect;
  try {
    const payload = await hcRead(settings, state.profile.weightKg);
    dispatch({ type: 'HC_IMPORT', payload });
    dispatch({ type: 'SET_HEALTH_CONNECT', patch: { lastSync: Date.now(), lastError: null } });
    return { ok: true };
  } catch (e) {
    const message = String((e && e.message) || e);
    dispatch({ type: 'SET_HEALTH_CONNECT', patch: { lastError: message } });
    return { ok: false, message };
  }
}

export function useHealthConnectSync(state, dispatch, ready) {
  const stateRef = useRef(state);
  stateRef.current = state;
  const busy = useRef(false);

  const maybeSync = useCallback(async () => {
    const s = stateRef.current;
    const hc = s.healthConnect || {};
    if (!hc.enabled || busy.current) return;
    if (hc.lastSync && Date.now() - hc.lastSync < MIN_GAP_MS) return;
    busy.current = true;
    try {
      await syncHealthConnect(s, dispatch);
    } finally {
      busy.current = false;
    }
  }, [dispatch]);

  useEffect(() => {
    if (ready) maybeSync();
  }, [ready, maybeSync]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') maybeSync();
    });
    return () => sub.remove();
  }, [maybeSync]);
}
