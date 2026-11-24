import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, AppState, ActivityIndicator, BackHandler, ScrollView, useWindowDimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StoreProvider, useStore } from './src/state/store';
import { HubProvider, useHub } from './src/state/hub';
import { useTheme, ThemeProvider } from './src/theme';
import { Celebration } from './src/components/Badges';
import * as SystemUI from 'expo-system-ui';
import { setupNotifications, rescheduleAll, addResponseListener } from './src/lib/notifications';
import { fastHoursFor } from './src/lib/fasting';
import { useHealthConnectSync } from './src/state/hcSync';
import TodayScreen from './src/screens/TodayScreen';
import NutritionScreen from './src/screens/NutritionScreen';
import MoveScreen from './src/screens/MoveScreen';
import ProgressScreen from './src/screens/ProgressScreen';
import SettingsScreen, { settingsParent } from './src/screens/SettingsScreen';
import SocialScreen from './src/screens/SocialScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';

// Pages, in swipe order. Swipe left/right, or tap one in the bottom bar.
const PAGES = [
  { key: 'today', label: 'Today', icon: '🏠', Screen: TodayScreen },
  { key: 'nutrition', label: 'Nutrition', icon: '🍽️', Screen: NutritionScreen },
  { key: 'move', label: 'Train', icon: '🏋️', Screen: MoveScreen },
  { key: 'progress', label: 'Progress', icon: '📈', Screen: ProgressScreen },
  { key: 'social', label: 'Social', icon: '💬', Screen: SocialScreen },
  { key: 'settings', label: 'Settings', icon: '⚙️', Screen: SettingsScreen },
];
const indexOf = (key) => Math.max(0, PAGES.findIndex((p) => p.key === key));

// Place names used by links and notifications → [page, sub-view].
const PLACES = {
  food: ['nutrition', 'food'],
  water: ['nutrition', 'water'],
  fast: ['nutrition', 'fast'],
  quests: ['social', 'quests'],
  chat: ['social', 'chat'],
  compare: ['social', 'compare'],
  notes: ['social', 'notes'],
};

function Shell() {
  const [index, setIndex] = useState(0);
  // Per page: { sub, day, gen } — gen bumps when a link opens that page somewhere specific.
  const [pages, setPages] = useState({});
  const page = PAGES[index].key;
  const sub = (pages[page] || {}).sub;
  // The hub polls chat quickly while chat is on screen.
  const activeTab = page === 'social' && (sub || 'quests') === 'chat' ? 'chat' : page;
  return (
    <HubProvider activeTab={activeTab}>
      <ShellInner index={index} setIndex={setIndex} pages={pages} setPages={setPages} />
    </HubProvider>
  );
}

function ShellInner({ index, setIndex, pages, setPages }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { state, dispatch, ready } = useStore();
  const { unread, celebration, dismissCelebration } = useHub();
  const stateRef = useRef(state);
  stateRef.current = state;
  useHealthConnectSync(state, dispatch, ready && state.profile.onboarded);
  const pager = useRef(null);
  const [visited, setVisited] = useState({ 0: true });
  // Settings → "Open the app on": the page shown at launch, and where Back returns to.
  const home = indexOf(state.profile.startPage || 'today');
  const startedOn = useRef(false);

  const show = useCallback(
    (i, animated = true) => {
      setIndex(i);
      setVisited((v) => ({ ...v, [i]: true, [i - 1]: true, [i + 1]: true }));
      if (pager.current) pager.current.scrollTo({ x: i * width, animated });
    },
    [setIndex, width]
  );

  // goTo('water'), goTo('nutrition'), goTo('food', { day: '2026-11-10' }), goTo('social', { sub: 'notes' }) ...
  const goTo = useCallback(
    (place, opts = {}) => {
      const [key, sub] = PLACES[place] || [place, opts.sub || null];
      setPages((p) => ({ ...p, [key]: { sub, day: opts.day || null, gen: ((p[key] || {}).gen || 0) + 1 } }));
      show(indexOf(key));
    },
    [setPages, show]
  );

  // Once saved data has loaded, jump to the chosen start page (only at launch).
  useEffect(() => {
    if (!ready || startedOn.current) return;
    startedOn.current = true;
    // The pager scrolls itself to this page when it first lays out (onLayout below).
    if (home !== 0) show(home, false);
  }, [ready, home, show]);

  // Keep the pager in place if the screen is rotated or resized.
  useEffect(() => {
    if (pager.current) pager.current.scrollTo({ x: index * width, animated: false });
  }, [width]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setupNotifications().catch(() => {});
  }, []);

  // Handle taps on notifications and their action buttons (e.g. "Log a glass").
  useEffect(() => {
    return addResponseListener((resp) => {
      const action = resp.actionIdentifier;
      const s = stateRef.current;
      if (action === 'log-water') {
        const preset = s.waterPresets[0];
        dispatch({ type: 'ADD_WATER', ml: preset ? preset.ml : 240, label: preset ? preset.label : null });
        goTo('water');
      } else if (action === 'start-fast') {
        if (!s.fasting.active) dispatch({ type: 'START_FAST', targetHours: fastHoursFor(s.fasting) });
        goTo('fast');
      } else {
        const kind = resp.notification?.request?.content?.data?.kind;
        const map = { water: 'water', fasting: 'fast', med: 'today', meal: 'food', weight: 'progress', exercise: 'move', workout: 'move', summary: 'today', streak: 'today', chat: 'chat' };
        if (map[kind]) goTo(map[kind]);
      }
    });
  }, [dispatch, goTo]);

  // Re-plan reminders whenever relevant data changes (debounced) and when the app returns to the foreground.
  useEffect(() => {
    if (!ready || !state.profile.onboarded) return;
    const id = setTimeout(() => rescheduleAll(state), 1500);
    return () => clearTimeout(id);
  }, [state, ready]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active' && stateRef.current.profile.onboarded) rescheduleAll(stateRef.current);
    });
    return () => sub.remove();
  }, []);

  // Android back: leave a sub-page first, then go back to the start page, then exit.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      const key = PAGES[index].key;
      const s = (pages[key] || {}).sub;
      if (key === 'nutrition' && s && s !== 'food') {
        goTo('nutrition');
        return true;
      }
      if (key === 'settings' && s) {
        const parent = settingsParent(s);
        goTo('settings', parent ? { sub: parent } : {});
        return true;
      }
      if (index !== home) {
        show(home);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [index, pages, goTo, show, home]);

  if (!ready) {
    return (
      <View style={[styles.center, { backgroundColor: t.bg }]}>
        <ActivityIndicator color={t.primary} />
      </View>
    );
  }

  if (!state.profile.onboarded) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: insets.top }}>
        <OnboardingScreen />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView
        ref={pager}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onLayout={() => {
          if (pager.current) pager.current.scrollTo({ x: index * width, animated: false });
        }}
        onMomentumScrollEnd={(e) => {
          const i = Math.round(e.nativeEvent.contentOffset.x / width);
          if (i !== index) show(i, false);
        }}
        style={{ flex: 1 }}
      >
        {PAGES.map((p, i) => {
          const info = pages[p.key] || {};
          const live = visited[i] || Math.abs(i - index) <= 1;
          return (
            <View key={p.key} style={{ width, flex: 1 }}>
              <PageHeader i={i} insets={insets} />
              <View style={{ flex: 1 }}>
                {live ? (
                  <p.Screen key={info.gen || 0} goTo={goTo} sub={info.sub} day={info.day} openSettings={() => goTo('settings', { sub: 'sync' })} />
                ) : null}
              </View>
            </View>
          );
        })}
      </ScrollView>
      <View style={[styles.tabBar, { backgroundColor: t.tabBar, borderTopColor: t.border, paddingBottom: Math.max(insets.bottom, 8) }]}>
        {PAGES.map((p, i) => {
          const active = i === index;
          const badge = p.key === 'social' ? unread : 0;
          return (
            <Pressable key={p.key} style={styles.tabItem} onPress={() => show(i)} accessibilityRole="button"
              accessibilityLabel={p.label} accessibilityState={{ selected: active }}>
              <Text style={{ fontSize: 20, opacity: active ? 1 : 0.55 }}>{p.icon}</Text>
              {badge ? (
                <View style={[styles.badge, { backgroundColor: t.danger }]}>
                  <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>{badge > 9 ? '9+' : badge}</Text>
                </View>
              ) : null}
              <Text numberOfLines={1} style={{ fontSize: 10, marginTop: 2, color: active ? t.primary : t.textFaint, fontWeight: active ? '700' : '500' }}>
                {p.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Celebration c={celebration} onClose={dismissCelebration} />
    </View>
  );
}

// Each page's header: just its name (the bottom bar shows where you are).
function PageHeader({ i, insets }) {
  const t = useTheme();
  const page = PAGES[i];
  return (
    <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
      <Text style={[styles.title, { color: t.text }]} numberOfLines={1}>
        {page.key === 'today' ? 'FossFitness' : page.label}
      </Text>
    </View>
  );
}

function ThemedStatusBar() {
  const t = useTheme();
  // Match the window background (seen during transitions and behind the keyboard) to the theme.
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(t.bg).catch(() => {});
  }, [t.bg]);
  return <StatusBar style={t.dark ? 'light' : 'dark'} />;
}

// The theme follows Settings → App settings → Appearance (stored in the profile).
function Themed({ children }) {
  const { state } = useStore();
  return <ThemeProvider appearance={state.profile.appearance}>{children}</ThemeProvider>;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <Themed>
          <ThemedStatusBar />
          <Shell />
        </Themed>
      </StoreProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: 18, paddingBottom: 8 },
  title: { fontSize: 26, fontWeight: '800' },
  tabBar: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8 },
  tabItem: { flex: 1, alignItems: 'center' },
  badge: { position: 'absolute', top: -4, right: '18%', minWidth: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
});
