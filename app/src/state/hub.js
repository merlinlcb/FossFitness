// Account, sync, leaderboard, chat and celebrations (the HealthHub server).
// Everything here is optional: with no account the app works exactly as before.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { useStore } from './store';
import { api, normalizeServer } from '../lib/api';
import { buildPush, applyPull, emptyMeta, pendingCount, metaForNewAccount } from '../lib/sync';
import { computeGame, publicStats, newAchievements, badgeById } from '../lib/game';
import { dayKey } from '../lib/dates';

const HUB_KEY = 'healthtracker:hub';
// From the build (app.config.js → HT_DEFAULT_SERVER). May be empty: then people type their server.
export const DEFAULT_SERVER = Constants.expoConfig?.extra?.defaultServer || '';
const APP_VERSION_CODE = Constants.expoConfig?.android?.versionCode || 0;
// Off in F-Droid builds: F-Droid delivers updates itself (app.config.js → FF_DISTRIBUTION).
const IN_APP_UPDATES = Constants.expoConfig?.extra?.inAppUpdates !== false;

const HubContext = createContext(null);

const emptyHub = () => ({ auth: null, meta: emptyMeta(), seen: null, chatSeenId: 0 });

export function HubProvider({ children, activeTab }) {
  const { state, dispatch, ready } = useStore();
  const [hub, setHub] = useState(null); // null until loaded
  const [status, setStatus] = useState({ busy: false, error: null });
  const [people, setPeople] = useState(null);
  const [messages, setMessages] = useState([]);
  const [celebration, setCelebration] = useState(null); // { levelUp, title, badges: [id] } shown as a medal pop-up
  const [chatError, setChatError] = useState('');
  const [update, setUpdate] = useState(null);
  const [minute, setMinute] = useState(() => Math.floor(Date.now() / 60000));

  const stateRef = useRef(state);
  stateRef.current = state;
  const hubRef = useRef(hub);
  hubRef.current = hub;
  const tabRef = useRef(activeTab);
  tabRef.current = activeTab;
  const syncing = useRef(false);
  const chatBusy = useRef(false);
  const lastMsgId = useRef(0);
  const silentRef = useRef(false);
  const gameRef = useRef(null);

  // ── load / save the hub record ───────────────────────────────────────────
  useEffect(() => {
    AsyncStorage.getItem(HUB_KEY)
      .then((json) => {
        const saved = json ? JSON.parse(json) : {};
        setHub({ ...emptyHub(), ...saved, meta: { ...emptyMeta(), ...(saved.meta || {}) } });
      })
      .catch(() => setHub(emptyHub()));
  }, []);
  useEffect(() => {
    if (!hub) return;
    const id = setTimeout(() => AsyncStorage.setItem(HUB_KEY, JSON.stringify(hub)).catch(() => {}), 200);
    return () => clearTimeout(id);
  }, [hub]);

  const patchHub = useCallback((fn) => setHub((h) => (h ? fn(h) : h)), []);

  // ── game ─────────────────────────────────────────────────────────────────
  const game = useMemo(() => computeGame(state, dayKey(), Date.now()), [state, minute]);
  gameRef.current = game;

  // ── sync ─────────────────────────────────────────────────────────────────
  const signOutLocally = useCallback((message) => {
    patchHub((h) => ({ ...h, auth: null }));
    setPeople(null);
    setMessages([]);
    if (message) Alert.alert('Signed out', message);
  }, [patchHub]);

  const syncNow = useCallback(async () => {
    const h = hubRef.current;
    if (!h || !h.auth || syncing.current || !ready) return;
    syncing.current = true;
    setStatus({ busy: true, error: null });
    const { server, token } = h.auth;
    try {
      const meta = h.meta;
      const plan = buildPush(stateRef.current, meta);
      const res = await api(server, '/api/sync', {
        method: 'POST',
        token,
        body: {
          since: meta.rev || 0,
          push: plan.push,
          profile: plan.settings,
          stats: gameRef.current ? publicStats(gameRef.current, stateRef.current.fasting.active) : undefined,
        },
      });
      if (!hubRef.current || !hubRef.current.auth || hubRef.current.auth.token !== token) return;
      if ((res.entries || []).length) silentRef.current = true; // restored history is not a new achievement
      const result = applyPull(stateRef.current, meta, plan, res);
      if (result.state !== stateRef.current) dispatch({ type: 'SYNC_APPLY', apply: (s) => applyPull(s, meta, plan, res).state });
      patchHub((x) => ({ ...x, meta: result.meta, auth: x.auth ? { ...x.auth, user: res.user || x.auth.user } : x.auth }));
      setStatus({ busy: false, error: null });
      api(server, '/api/friends', { token }).then((f) => setPeople(f.people)).catch(() => {});
    } catch (e) {
      setStatus({ busy: false, error: e.message });
      if (e.status === 401) signOutLocally('Your sign-in is no longer valid. Sign in again in Settings → App settings → Cloud sync.');
    } finally {
      syncing.current = false;
    }
  }, [dispatch, patchHub, ready, signOutLocally]);

  // ── chat ─────────────────────────────────────────────────────────────────
  const pollChat = useCallback(async () => {
    const h = hubRef.current;
    if (!h || !h.auth || chatBusy.current) return;
    chatBusy.current = true;
    const { server, token } = h.auth;
    try {
      const firstLoad = lastMsgId.current === 0;
      const res = await api(server, `/api/chat?since=${lastMsgId.current}`, { token });
      if (res.messages.length && hubRef.current?.auth?.token === token) {
        lastMsgId.current = res.messages[res.messages.length - 1].id;
        setMessages((prev) => [...prev, ...res.messages].slice(-500));
        const incoming = res.messages.filter((m) => !m.mine && m.kind === 'msg');
        if (!firstLoad && incoming.length && tabRef.current !== 'chat' && (stateRef.current.reminders.chat || {}).enabled !== false) {
          const m = incoming[incoming.length - 1];
          Notifications.scheduleNotificationAsync({
            content: { title: m.name, body: m.body, data: { kind: 'chat' } },
            trigger: { channelId: 'chat' },
          }).catch(() => {});
        }
      }
      setChatError('');
    } catch (e) {
      if (e.status !== 401) setChatError(e.message);
    } finally {
      chatBusy.current = false;
    }
  }, []);

  const postChat = useCallback(async (body, kind = 'msg') => {
    const h = hubRef.current;
    if (!h || !h.auth) return false;
    try {
      await api(h.auth.server, '/api/chat', { method: 'POST', token: h.auth.token, body: { body, kind } });
      pollChat();
      return true;
    } catch (e) {
      if (kind !== 'event') setChatError(e.message);
      return false;
    }
  }, [pollChat]);

  // ── updates ──────────────────────────────────────────────────────────────
  // The server offers the newest build; a signed-in app downloads it through a
  // short-lived link (no invite code), and Android's installer does the rest.
  const downloadUpdate = useCallback(async () => {
    const h = hubRef.current;
    const server = h && h.auth ? h.auth.server : DEFAULT_SERVER;
    try {
      if (!h || !h.auth) throw new Error('not signed in');
      const r = await api(server, '/api/app/link', { method: 'POST', token: h.auth.token, body: {} });
      await Linking.openURL(`${server}${r.url}`);
    } catch {
      if (server) Linking.openURL(`${server}/get`).catch(() => {});
    }
  }, []);

  const checkUpdate = useCallback(() => {
    const h = hubRef.current;
    const server = h && h.auth ? h.auth.server : DEFAULT_SERVER;
    if (!server || !IN_APP_UPDATES) return;
    api(server, '/api/app', { timeout: 8000 })
      .then((a) => setUpdate(a.available && a.versionCode > APP_VERSION_CODE ? { ...a, server } : null))
      .catch(() => {});
  }, []);

  // Ask about a new version once per launch, unless that version was skipped.
  // "Not now" asks again next time the app is started; the Settings → App settings → Cloud sync card always offers it.
  const askedThisLaunch = useRef(null);
  useEffect(() => {
    if (!update || !hub || hub.updateSkipped === update.versionCode || askedThisLaunch.current === update.versionCode) return;
    askedThisLaunch.current = update.versionCode;
    Alert.alert(
      'Update available',
      `FossFitness ${update.versionName} is ready. Download and install it now? Your data is kept.`,
      [
        { text: 'Skip this version', onPress: () => patchHub((h) => ({ ...h, updateSkipped: update.versionCode })) },
        { text: 'Not now', style: 'cancel' },
        { text: 'Download', onPress: downloadUpdate },
      ],
      { cancelable: true }
    );
  }, [update, hub && hub.updateSkipped]);

  // ── sign in / out ────────────────────────────────────────────────────────
  const signIn = useCallback(async ({ mode, server, username, password, invite, displayName }) => {
    const srv = normalizeServer(server);
    const res = await api(srv, mode === 'register' ? '/api/register' : '/api/login', {
      method: 'POST',
      body: mode === 'register'
        ? { username, password, invite, displayName, device: 'android' }
        : { username, password, device: 'android' },
    });
    const userKey = `${srv}|${res.user.id}`;
    patchHub((h) => {
      if (h.meta.userKey === userKey) return { ...h, auth: { server: srv, token: res.token, user: res.user } };
      return { ...h, auth: { server: srv, token: res.token, user: res.user }, meta: metaForNewAccount(stateRef.current, userKey) };
    });
  }, [patchHub]);

  const signOut = useCallback(async () => {
    const h = hubRef.current;
    if (h && h.auth) api(h.auth.server, '/api/logout', { method: 'POST', token: h.auth.token, body: {} }).catch(() => {});
    signOutLocally(null);
  }, [signOutLocally]);

  // ── timers and triggers ──────────────────────────────────────────────────
  const authKey = hub && hub.auth ? `${hub.auth.server}|${hub.auth.token}` : '';

  useEffect(() => {
    Notifications.setNotificationChannelAsync('chat', {
      name: 'Chat',
      description: 'Messages from the other people on your server',
      importance: Notifications.AndroidImportance.HIGH,
    }).catch(() => {});
  }, []);

  // On start and whenever the account changes.
  useEffect(() => {
    if (!hub || !ready) return;
    lastMsgId.current = 0;
    setMessages([]);
    setPeople(null);
    setChatError('');
    if (authKey) {
      syncNow();
      pollChat();
    }
    checkUpdate();
  }, [authKey, hub === null, ready]);

  // Upload a few seconds after anything changes.
  const pending = useMemo(() => (hub && hub.auth ? pendingCount(state, hub.meta) : 0), [state, hub]);
  useEffect(() => {
    if (!authKey || !pending) return;
    const id = setTimeout(syncNow, 3000);
    return () => clearTimeout(id);
  }, [authKey, pending, state]);

  // Once a minute: refresh the clock-based game, retry uploads, refresh the leaderboard.
  useEffect(() => {
    const id = setInterval(() => {
      setMinute(Math.floor(Date.now() / 60000));
      syncNow();
    }, 60000);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') {
        setMinute(Math.floor(Date.now() / 60000));
        syncNow();
        pollChat();
        checkUpdate();
      }
    });
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [syncNow, pollChat, checkUpdate]);

  // Chat: often while it is open, occasionally otherwise.
  useEffect(() => {
    if (!authKey) return;
    if (activeTab === 'chat') pollChat();
    const id = setInterval(pollChat, activeTab === 'chat' ? 4000 : 30000);
    return () => clearInterval(id);
  }, [authKey, activeTab, pollChat]);

  const lastMessageId = messages.length ? messages[messages.length - 1].id : 0;
  const chatSeenId = hub ? hub.chatSeenId || 0 : 0;
  const unread = messages.filter((m) => !m.mine && m.kind === 'msg' && m.id > chatSeenId).length;
  useEffect(() => {
    if (activeTab === 'chat' && lastMessageId > chatSeenId) patchHub((h) => ({ ...h, chatSeenId: lastMessageId }));
  }, [activeTab, lastMessageId, chatSeenId, patchHub]);

  // ── celebrate new levels and badges exactly once ─────────────────────────
  useEffect(() => {
    if (!hub || !ready || !state.profile.onboarded) return;
    const silent = silentRef.current;
    silentRef.current = false;
    const r = newAchievements(game, hub.seen);
    const unchanged = hub.seen && r.seen.level === hub.seen.level && r.seen.badges.length === (hub.seen.badges || []).length && r.seen.v === hub.seen.v;
    if (unchanged) return;
    patchHub((h) => ({ ...h, seen: r.seen }));
    if (silent || (!r.levelUp && !r.badges.length)) return;
    const events = [];
    const who = hub.auth ? hub.auth.user.displayName : 'You';
    if (r.levelUp) events.push(`⬆️ ${who} reached level ${r.levelUp} (${game.title})`);
    for (const id of r.badges) {
      const b = badgeById(id);
      if (b) events.push(`${b.icon} ${who} earned ${b.name}`);
    }
    setCelebration({ levelUp: r.levelUp, title: game.title, badges: r.badges.filter((id) => badgeById(id)) });
    if (hub.auth) postChat(events.join('\n'), 'event');
  }, [game, hub && hub.seen, ready]);

  const value = useMemo(
    () => ({
      loaded: !!hub,
      auth: hub ? hub.auth : null,
      meta: hub ? hub.meta : emptyMeta(),
      status, pending, people, messages, chatError, unread, update, game,
      signIn, signOut, syncNow, postChat, downloadUpdate,
      celebration, dismissCelebration: () => setCelebration(null),
    }),
    [hub, status, pending, people, messages, chatError, unread, update, game, signIn, signOut, syncNow, postChat, downloadUpdate, celebration]
  );
  return <HubContext.Provider value={value}>{children}</HubContext.Provider>;
}

export function useHub() {
  const ctx = useContext(HubContext);
  if (!ctx) throw new Error('useHub must be used inside HubProvider');
  return ctx;
}
