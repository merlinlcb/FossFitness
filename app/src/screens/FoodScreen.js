import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, TextInput, Alert } from 'react-native';
import { useStore } from '../state/store';
import { useHub } from '../state/hub';
import { useTheme } from '../theme';
import {
  Screen,
  Card,
  Txt,
  Button,
  ProgressBar,
  Sheet,
  ChipRow,
  Chip,
  Stepper,
  NumberField,
  TextField,
  Segmented,
  Empty,
} from '../components/ui';
import { dayMetrics } from '../lib/metrics';
import { dayKey, addDays, parseDayKey, formatDayLabel, formatClock } from '../lib/dates';
import { FOODS, customToFood, nutritionFor, searchFoods, MEALS, mealForTime, FOOD_CATEGORIES, isMine } from '../lib/foods';
import { tdee, projectWeight } from '../lib/calc';
import { parseNutritionLabel } from '../lib/label';
import { MICRONUTRIENTS } from '../lib/nutrients';
import FactsLabel from '../components/FactsLabel';
import { formatWeight, formatWeightDelta } from '../lib/units';
import { WaterAndFasting, OffMarkers } from './NutritionScreen';
import { MealRow, MealLogger, MyMealsCard } from '../components/Meals';

const QTY_CHIPS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3];
// A label photo recovered after Android restarted the app (handed to the freshly opened Nutrition page).
let recoveredPhoto = null;
const fmtQty = (q) => {
  const map = { 0.25: '¼', 0.5: '½', 0.75: '¾', 1.5: '1½', 2.5: '2½' };
  return map[q] || String(Math.round(q * 100) / 100);
};

export default function FoodScreen({ goTo, initialDay }) {
  const t = useTheme();
  const { state, dispatch } = useStore();
  const [day, setDay] = useState(initialDay || dayKey());
  const [sheet, setSheet] = useState(null); // { mode, meal, entry? }
  const [review, setReview] = useState(false);
  const m = useMemo(() => dayMetrics(state, day), [state, day]);
  // If Android closed the app while the camera or photo picker was open, the photo comes back
  // here on the next start: carry on reading the label instead of losing it.
  React.useEffect(() => {
    let alive = true;
    if (recoveredPhoto) {
      setSheet({ mode: 'catalogue', pendingUri: recoveredPhoto });
      recoveredPhoto = null;
      return undefined;
    }
    try {
      require('expo-image-picker')
        .getPendingResultAsync()
        .then((r) => {
          const uri = r && !r.canceled && r.assets && r.assets[0] && r.assets[0].uri;
          if (!alive || !uri) return;
          if (goTo) {
            // Opening the Nutrition page starts this screen afresh; it picks the photo up on mount.
            recoveredPhoto = uri;
            goTo('nutrition');
          } else setSheet({ mode: 'catalogue', pendingUri: uri });
        })
        .catch(() => {});
    } catch {
      // picker not available
    }
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const today = dayKey();
  const yesterday = dayKey(addDays(parseDayKey(day), -1));
  const yDay = state.days[yesterday];
  const remaining = m.kcalTarget - m.food.kcal;
  // "Add back exercise calories": shown as its own step in the sum, not hidden in the target.
  const exBonus = m.kcalTarget - m.baseKcalTarget;

  return (
    <Screen>
      {/* Day navigator */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <Button small variant="ghost" title="‹" onPress={() => setDay(dayKey(addDays(parseDayKey(day), -1)))} />
        <Txt size={17} weight="700">
          {formatDayLabel(day, today)}
        </Txt>
        <Button small variant="ghost" title="›" disabled={day >= today} onPress={() => setDay(dayKey(addDays(parseDayKey(day), 1)))} />
      </View>

      {/* Summary */}
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <Stat label="Target" value={m.baseKcalTarget} small={exBonus > 0} />
          {exBonus > 0 && (
            <>
              <Txt dim size={20}>
                +
              </Txt>
              <Stat label="🏃 Exercise" value={exBonus} color={t.exercise} small />
            </>
          )}
          <Txt dim size={20}>
            −
          </Txt>
          <Stat label="Eaten" value={Math.round(m.food.kcal)} color={t.food} small={exBonus > 0} />
          <Txt dim size={20}>
            =
          </Txt>
          <Stat label={remaining >= 0 ? 'Left' : 'Over'} value={Math.abs(Math.round(remaining))} color={remaining >= 0 ? t.good : t.warn} small={exBonus > 0} />
        </View>
        <ProgressBar value={m.food.kcal} max={m.kcalTarget} color={t.food} style={{ marginTop: 14 }} />
        {exBonus > 0 ? (
          <Txt size={13} color={t.exercise} weight="600" style={{ marginTop: 8 }}>
            🏃 +{exBonus} kcal earned back: half of the {m.exKcal} kcal you burned exercising today.
          </Txt>
        ) : state.profile.eatBackExercise && day === today ? (
          <Txt dim size={13} style={{ marginTop: 8 }}>
            🏃 Exercise you log today adds half its calories to your target.
          </Txt>
        ) : null}
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
          <MacroPill label="Protein" value={m.food.protein} goal={m.macros.protein} color={t.protein} />
          <MacroPill label="Carbs" value={m.food.carbs} goal={m.macros.carbs} color={t.carbs} />
          <MacroPill label="Fat" value={m.food.fat} goal={m.macros.fat} color={t.fat} />
        </View>
        {goTo ? <OffMarkers goTo={goTo} /> : null}
        {goTo ? (
          <Button small variant="ghost" title="🔬 Full nutrition facts (vitamins, minerals, sodium…) ›" style={{ alignSelf: 'flex-start', paddingHorizontal: 0, marginTop: 6 }}
            onPress={() => goTo('nutrition', { sub: 'facts', day })} />
        ) : null}
        <Button color={t.food} title="＋ Log food" style={{ marginTop: 14 }} onPress={() => setSheet({ mode: 'pick', meal: day === today ? mealForTime() : 'lunch' })} />
        <Txt faint size={12} center style={{ marginTop: 6 }}>
          {day === today ? `Goes into ${(MEALS.find((x) => x.key === mealForTime()) || MEALS[0]).label.toLowerCase()} (by the time of day); you can change it before adding.` : 'Logging to this day.'}
        </Txt>
      </Card>

      {day === today && goTo ? <WaterAndFasting goTo={goTo} /> : null}

      {MEALS.map((meal) => {
        const entries = m.day.food.filter((f) => f.meal === meal.key);
        const kcal = entries.reduce((a, e) => a + (e.kcal || 0), 0);
        const canCopy = !entries.length && yDay && (yDay.food || []).some((f) => f.meal === meal.key);
        return (
          <Card
            key={meal.key}
            title={`${meal.icon} ${meal.label}`}
            right={
              <Txt dim size={14} weight="600">
                {Math.round(kcal)} kcal
              </Txt>
            }
          >
            {entries.map((e) => (
              <Pressable
                key={e.id}
                onPress={() => setSheet({ mode: e.foodId ? 'portion' : 'quick', meal: meal.key, entry: e })}
                onLongPress={() =>
                  Alert.alert('Delete entry?', e.name, [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: () => dispatch({ type: 'REMOVE_FOOD', day, id: e.id }) },
                  ])
                }
                style={{ flexDirection: 'row', paddingVertical: 9, borderBottomWidth: 0.5, borderBottomColor: t.border }}
              >
                <View style={{ flex: 1 }}>
                  <Txt size={15}>{e.name}</Txt>
                  <Txt faint size={12}>
                    {e.portion ? `${e.portion} · ` : ''}P {Math.round(e.protein || 0)} · C {Math.round(e.carbs || 0)} · F {Math.round(e.fat || 0)} · {formatClock(e.t)}
                  </Txt>
                </View>
                <Txt size={15} weight="600">
                  {Math.round(e.kcal)}
                </Txt>
              </Pressable>
            ))}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: entries.length ? 10 : 0 }}>
              <Button small variant="secondary" color={t.food} title="+ Log food" style={{ flex: 1 }} onPress={() => setSheet({ mode: 'pick', meal: meal.key })} />
              {canCopy && (
                <Button
                  small
                  variant="secondary"
                  title="Copy yesterday"
                  onPress={() => dispatch({ type: 'COPY_MEAL', fromDay: yesterday, toDay: day, meal: meal.key })}
                />
              )}
            </View>
          </Card>
        );
      })}
      <Txt faint size={12} center>
        Tap an entry to change its portion · long-press to delete
      </Txt>

      <Button
        variant="secondary"
        color={t.food}
        title="📚 Add to catalogue"
        style={{ marginTop: 14 }}
        onPress={() => setSheet({ mode: 'catalogue' })}
      />
      <Txt faint size={12} center style={{ marginTop: 6 }}>
        Adds a food to the food list without logging it.
      </Txt>

      <Button
        variant={m.day.completedAt ? 'secondary' : 'outline'}
        title={m.day.completedAt ? '✓ Log completed · see the 5-week outlook' : `✓ Complete ${day === today ? "today's" : "this day's"} log`}
        style={{ marginTop: 14 }}
        onPress={() => {
          if (!m.day.completedAt) dispatch({ type: 'SET_DAY_COMPLETE', day, done: true });
          setReview(true);
        }}
      />

      <MyMealsCard day={day} onOpen={(ml) => setSheet({ mode: 'meal', mealId: ml.id })} />

      {sheet && <AddFoodSheet initial={sheet} day={day} onClose={() => setSheet(null)} />}
      {review && <DayReview m={m} onClose={() => setReview(false)} onUndo={() => { dispatch({ type: 'SET_DAY_COMPLETE', day, done: false }); setReview(false); }} />}
    </Screen>
  );
}

function DayReview({ m, onClose, onUndo }) {
  const t = useTheme();
  const { state } = useStore();
  const p = state.profile;
  const eaten = Math.round(m.food.kcal);
  const r = projectWeight(p, eaten, m.exKcal);
  const losing = r.kgChange < 0;
  return (
    <Sheet visible onClose={onClose} title="Day complete" footer={<Button title="Done" onPress={onClose} />}>
      {eaten === 0 ? (
        <Txt dim>Nothing logged to eat this day, so there's no outlook yet.</Txt>
      ) : (
        <>
          <Txt dim size={14} style={{ lineHeight: 21 }}>
            If you eat and exercise like this every day, in 5 weeks you would weigh about
          </Txt>
          <Txt size={34} weight="800" color={losing ? t.good : t.warn} style={{ marginVertical: 6 }}>
            {formatWeight(r.kg, p.units)}
          </Txt>
          <Txt size={15} weight="600" color={losing ? t.good : t.warn}>
            {formatWeightDelta(r.kgChange, p.units)} from {formatWeight(p.weightKg, p.units)}
          </Txt>
          <View style={{ marginTop: 14, padding: 12, borderRadius: 12, backgroundColor: t.cardAlt }}>
            <Txt size={13}>Eaten: {eaten} kcal</Txt>
            <Txt size={13}>Burned: about {Math.round(r.burn)} kcal ({tdee(p)} everyday + {Math.round(m.exKcal)} exercise)</Txt>
            <Txt size={13} weight="700" style={{ marginTop: 4 }}>
              {r.dailyDelta < 0 ? `${Math.round(-r.dailyDelta)} kcal under` : `${Math.round(r.dailyDelta)} kcal over`} what you burn
            </Txt>
          </View>
          <Txt faint size={12} style={{ marginTop: 10, lineHeight: 17 }}>
            A rough guide: 7,700 kcal ≈ 1 kg (2.2 lb) of body fat, and "everyday" burn is estimated from your profile. Real
            weight also moves with water, salt and food in your system.
          </Txt>
        </>
      )}
      <Button small variant="ghost" title="Mark as not complete" style={{ marginTop: 8 }} onPress={onUndo} />
    </Sheet>
  );
}

function Stat({ label, value, color, small }) {
  const t = useTheme();
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={{ color: color || t.text, fontSize: small ? 20 : 24, fontWeight: '800' }}>{value}</Text>
      <Txt faint size={12}>
        {label}
      </Txt>
    </View>
  );
}

function MacroPill({ label, value, goal, color }) {
  return (
    <View style={{ flex: 1 }}>
      <Txt size={12} dim>
        {label}
      </Txt>
      <Txt size={14} weight="700">
        {Math.round(value)}
        <Txt faint size={12}>
          /{goal}g
        </Txt>
      </Txt>
      <ProgressBar value={value} max={goal} color={color} height={6} style={{ marginTop: 4 }} />
    </View>
  );
}

// One sheet that handles picking, portioning, quick-add and creating custom foods.
// mode 'catalogue': only add a food to the food list (create, or scan a label), no logging.
export function AddFoodSheet({ initial, day, onClose }) {
  const t = useTheme();
  const { state, dispatch } = useStore();
  const { auth } = useHub();
  const catalogue = initial.mode === 'catalogue';
  const [mode, setMode] = useState(initial.mode);
  const [meal, setMeal] = useState(initial.meal || mealForTime());
  const [food, setFood] = useState(null);
  const [scanned, setScanned] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [pickedMeal, setPickedMeal] = useState(initial.mealId ? state.meals.find((x) => x.id === initial.mealId) || null : null);
  const editing = initial.entry || null;

  // Photograph (or pick) a nutrition label, read it on the phone, and pre-fill a new custom food.
  const scan = async (fromCamera) => {
    try {
      const ImagePicker = require('expo-image-picker');
      if (fromCamera) {
        const p = await ImagePicker.requestCameraPermissionsAsync();
        if (!p.granted) {
          Alert.alert('Camera not allowed', 'Allow the camera for FossFitness in Android settings, or pick a photo instead.');
          return;
        }
      }
      const open = () =>
        fromCamera ? ImagePicker.launchCameraAsync({ quality: 0.9 }) : ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
      let res;
      try {
        res = await open();
      } catch {
        // Android sometimes isn't ready to open the camera/picker right after the sheet appears
        // or the app comes back from the background: wait a moment and try once more.
        await new Promise((r) => setTimeout(r, 600));
        res = await open();
      }
      if (res.canceled || !res.assets || !res.assets.length) return;
      await readLabel(res.assets[0].uri);
    } catch (e) {
      scanError(e);
    }
  };

  const readLabel = async (uri) => {
    try {
      setScanning(true);
      // On-device Tesseract OCR (modules/label-ocr): nothing leaves the phone.
      const LabelOcr = require('expo-modules-core').requireNativeModule('LabelOcr');
      const text = await LabelOcr.recognize(uri);
      const parsed = parseNutritionLabel(text);
      if (!parsed.found) {
        Alert.alert("Couldn't read a label", 'Try again with the Nutrition Facts panel filling the photo, flat and in good light.');
        return;
      }
      setScanned(parsed);
      setMode('custom');
    } catch (e) {
      scanError(e);
    } finally {
      setScanning(false);
    }
  };

  // A photo that came back after Android closed the app while the camera was open (see FoodScreen).
  React.useEffect(() => {
    if (initial.pendingUri) readLabel(initial.pendingUri);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const allFoods = useMemo(() => [...state.customFoods.map(customToFood), ...FOODS], [state.customFoods]);
  const byId = useMemo(() => Object.fromEntries(allFoods.map((f) => [f.id, f])), [allFoods]);

  // Edit existing entry: resolve its food
  const editFood = editing && editing.foodId ? byId[editing.foodId] : null;
  // Look the picked food up again so an edit to a custom food shows straight away.
  const activeFood = (food && (byId[food.id] || food)) || editFood;
  const customRaw = activeFood && activeFood.custom ? state.customFoods.find((c) => c.id === activeFood.id) : null;

  // Logging food during an active fast: offer to end the fast.
  const afterAdd = () => {
    if (state.fasting.active && day === dayKey()) {
      Alert.alert('End your fast?', 'You just logged food while a fast is running.', [
        { text: 'Keep fasting', style: 'cancel' },
        { text: 'End fast', onPress: () => dispatch({ type: 'END_FAST' }) },
      ]);
    }
  };

  // Deleting a logged food always asks first.
  const removeEntry = () =>
    Alert.alert(`Delete ${editing.name}?`, `${editing.portion ? `${editing.portion}, ` : ''}${Math.round(editing.kcal || 0)} kcal`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          dispatch({ type: 'REMOVE_FOOD', day, id: editing.id });
          onClose();
        },
      },
    ]);

  const title =
    mode === 'catalogue'
      ? 'Add to catalogue'
      : mode === 'pick'
      ? 'Log food'
      : mode === 'meal'
      ? (pickedMeal ? pickedMeal.name : 'Meal')
      : mode === 'portion'
        ? activeFood
          ? activeFood.name
          : 'Portion'
        : mode === 'quick'
          ? 'Quick add'
          : mode === 'editCustom'
            ? 'Edit food'
            : 'New custom food';

  return (
    <Sheet visible onClose={onClose} title={title}>
      {mode === 'catalogue' && (
        <View>
          <Txt dim size={14} style={{ marginBottom: 12, lineHeight: 20 }}>
            Add a food you eat to the food list so it's ready when you log it. Nothing is added to your meals.
            {auth ? ' Foods you add are shared with your group and show under My foods.' : ' It shows under My foods.'}
          </Txt>
          <Button color={t.food} title="＋ Create food" onPress={() => { setScanned(null); setMode('custom'); }} />
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
            <Button small variant="secondary" title={scanning ? 'Reading label…' : '📷 Scan a label'} disabled={scanning} style={{ flex: 1 }} onPress={() => scan(true)} />
            <Button small variant="secondary" title="🖼️ From a photo" disabled={scanning} style={{ flex: 1 }} onPress={() => scan(false)} />
          </View>
        </View>
      )}
      {mode === 'pick' && (
        <FoodPicker
          allFoods={allFoods}
          byId={byId}
          onPick={(f) => {
            setFood(f);
            setMode('portion');
          }}
          onQuick={() => setMode('quick')}
          onCustom={() => { setScanned(null); setMode('custom'); }}
          onScan={scan}
          scanning={scanning}
          meals={state.meals}
          onPickMeal={(ml) => {
            setPickedMeal(ml);
            setMode('meal');
          }}
        />
      )}
      {mode === 'meal' && pickedMeal && (
        <MealLogger
          mealId={pickedMeal.id}
          day={day}
          byId={byId}
          onBack={initial.mode === 'meal' ? null : () => setMode('pick')}
          onLogged={() => {
            afterAdd();
            onClose();
          }}
        />
      )}
      {mode === 'portion' && activeFood && (
        <PortionEditor
          food={activeFood}
          meal={meal}
          setMeal={setMeal}
          editing={editing && editing.foodId === activeFood.id ? editing : null}
          recent={state.recentFoods.find((r) => r.foodId === activeFood.id)}
          favorite={state.favorites.includes(activeFood.id)}
          onToggleFav={() => dispatch({ type: 'TOGGLE_FAVORITE', foodId: activeFood.id })}
          onEditFood={customRaw ? () => setMode('editCustom') : null}
          onBack={editing ? null : () => setMode('pick')}
          onSave={(entry) => {
            if (editing) dispatch({ type: 'UPDATE_FOOD', day, id: editing.id, patch: entry });
            else {
              dispatch({ type: 'ADD_FOOD', day, entry: { ...entry, t: entryTime(day) } });
              afterAdd();
            }
            onClose();
          }}
          onDelete={editing ? removeEntry : null}
        />
      )}
      {mode === 'portion' && !activeFood && editing && (
        // Food no longer exists (custom food deleted): allow scaling the stored values.
        <QuickAdd meal={meal} setMeal={setMeal} editing={editing} onSave={(entry) => {
          dispatch({ type: 'UPDATE_FOOD', day, id: editing.id, patch: entry });
          onClose();
        }} onDelete={removeEntry} />
      )}
      {mode === 'quick' && (
        <QuickAdd
          meal={meal}
          setMeal={setMeal}
          editing={editing}
          onBack={editing ? null : () => setMode('pick')}
          onSave={(entry) => {
            if (editing) dispatch({ type: 'UPDATE_FOOD', day, id: editing.id, patch: entry });
            else {
              dispatch({ type: 'ADD_FOOD', day, entry: { ...entry, t: entryTime(day) } });
              afterAdd();
            }
            onClose();
          }}
          onDelete={editing ? removeEntry : null}
        />
      )}
      {mode === 'editCustom' && customRaw && (
        <CustomFoodForm
          food={customRaw}
          onBack={() => setMode('portion')}
          onSave={(cf) => {
            dispatch({ type: 'UPDATE_CUSTOM_FOOD', id: customRaw.id, patch: { ...cf, micro: cf.micro || null } });
            setMode('portion');
          }}
        />
      )}
      {mode === 'custom' && (
        <CustomFoodForm
          initial={scanned}
          onBack={() => setMode(catalogue ? 'catalogue' : 'pick')}
          onSave={(cf) => {
            // Tagged with who made it, so My foods shows only your own.
            dispatch({ type: 'ADD_CUSTOM_FOOD', food: auth ? { ...cf, by: auth.user.id } : cf });
            if (catalogue) {
              Alert.alert('Added to the catalogue', `${cf.name} is in the food list now. Find it under My foods when you log food.`);
              onClose();
            } else setMode('pick');
          }}
        />
      )}
    </Sheet>
  );
}

// Scan errors say which build they came from, so a screenshot is enough to track them down.
function scanError(e) {
  const Constants = require('expo-constants').default;
  const build = (Constants.expoConfig && Constants.expoConfig.android && Constants.expoConfig.android.versionCode) || '?';
  Alert.alert('Scan failed', `${String((e && e.message) || e)}\n\n(build ${build}) Try again; if it keeps happening, send a screenshot of this.`);
}

// Log to the selected day: use "now" for today, noon for past days.
export function entryTime(day) {
  if (day === dayKey()) return new Date().toISOString();
  const d = parseDayKey(day);
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
}

export function FoodPicker({ allFoods, byId, onPick, onQuick, onCustom, onScan, scanning, meals, onPickMeal }) {
  const t = useTheme();
  const { state, dispatch } = useStore();
  const { auth } = useHub();
  const [q, setQ] = useState('');
  const [tab, setTab] = useState(state.recentFoods.length ? 'recent' : 'all');
  const [cat, setCat] = useState(null);

  // Saved meals show at the top of My foods, and in search when their name matches.
  const query = q.trim().toLowerCase();
  const shownMeals = !meals || !onPickMeal ? [] : query ? meals.filter((m) => m.name.toLowerCase().includes(query)) : tab === 'mine' ? meals : [];
  let list;
  if (q.trim()) list = searchFoods(q, allFoods);
  else if (tab === 'recent') list = state.recentFoods.map((r) => byId[r.foodId]).filter(Boolean);
  else if (tab === 'fav') list = state.favorites.map((id) => byId[id]).filter(Boolean);
  else if (tab === 'mine') list = allFoods.filter((f) => f.custom && isMine(f, auth));
  else list = allFoods.filter((f) => !cat || f.category === cat);

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: t.border, borderRadius: 12, paddingHorizontal: 12, backgroundColor: t.cardAlt, marginBottom: 10 }}>
        <Text style={{ marginRight: 6 }}>🔎</Text>
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search foods (e.g. chicken, rice, latte)"
          placeholderTextColor={t.textFaint}
          style={{ flex: 1, color: t.text, fontSize: 16, paddingVertical: 10 }}
        />
      </View>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
        {onQuick ? <Button small variant="secondary" title="⚡ Quick add kcal" style={{ flex: 1 }} onPress={onQuick} /> : null}
        <Button small variant="secondary" title="＋ Create food" style={{ flex: 1 }} onPress={onCustom} />
      </View>
      {onScan && (
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
          <Button small variant="secondary" title={scanning ? 'Reading label…' : '📷 Scan a label'} disabled={scanning} style={{ flex: 1 }} onPress={() => onScan(true)} />
          <Button small variant="secondary" title="🖼️ From a photo" disabled={scanning} style={{ flex: 1 }} onPress={() => onScan(false)} />
        </View>
      )}
      {!q.trim() && (
        <Segmented
          options={[
            { key: 'recent', label: 'Recent' },
            { key: 'fav', label: '★ Saved' },
            { key: 'mine', label: 'My foods' },
            { key: 'all', label: 'All' },
          ]}
          value={tab}
          onChange={setTab}
        />
      )}
      {!q.trim() && tab === 'all' && (
        <View style={{ marginTop: 10 }}>
          <ChipRow scroll options={[{ key: null, label: 'All' }, ...FOOD_CATEGORIES.map((c) => ({ key: c, label: c }))]} value={cat} onChange={setCat} />
        </View>
      )}
      <View style={{ marginTop: 8 }}>
        {shownMeals.length ? (
          <View style={{ marginBottom: 6 }}>
            <Txt dim size={12} weight="800" style={{ marginTop: 4 }}>🍱 MEALS</Txt>
            {shownMeals.map((ml) => (
              <MealRow key={ml.id} meal={ml} byId={byId} onPress={() => onPickMeal(ml)} />
            ))}
            {list.length ? <Txt dim size={12} weight="800" style={{ marginTop: 12 }}>FOODS</Txt> : null}
          </View>
        ) : null}
        {list.length === 0 && !shownMeals.length && (
          <Empty>
            {q.trim()
              ? 'No match. Use "Create food" to add it with nutrition from the label.'
              : tab === 'recent'
              ? 'Foods you log will show up here.'
              : tab === 'fav'
              ? 'Tap ☆ on a food to save it here.'
              : tab === 'mine'
              ? 'Foods and meals you create show up here (from nutrition labels or recipes). Foods others in your group add are under All. Save meals at the bottom of the Nutrition page.'
              : 'Nothing here.'}
          </Empty>
        )}
        {list.slice(0, 80).map((f) => {
          const s = f.servings[0];
          const n = nutritionFor(f, s.g);
          const fav = state.favorites.includes(f.id);
          return (
            <Pressable key={f.id} onPress={() => onPick(f)} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: 0.5, borderBottomColor: t.border }}>
              <View style={{ flex: 1 }}>
                <Txt size={15}>{f.name}</Txt>
                <Txt faint size={12}>
                  {s.label} · {n.kcal} kcal · P {Math.round(n.protein)}g
                </Txt>
              </View>
              <Pressable hitSlop={10} onPress={() => dispatch({ type: 'TOGGLE_FAVORITE', foodId: f.id })}>
                <Text style={{ fontSize: 20, color: fav ? t.star : t.textFaint }}>{fav ? '★' : '☆'}</Text>
              </Pressable>
            </Pressable>
          );
        })}
        {list.length > 80 && (
          <Txt faint size={12} center style={{ paddingVertical: 12 }}>
            Showing the top 80 of {list.length >= 200 && q.trim() ? '200+' : list.length.toLocaleString()} foods. Type more words to narrow it down
            (e.g. "chicken breast grilled").
          </Txt>
        )}
      </View>
    </View>
  );
}

export function PortionEditor({ food, meal, setMeal, editing, recent, favorite, onToggleFav, onEditFood, onBack, onSave, onDelete, hideMeal, saveLabel }) {
  const t = useTheme();
  const [showFacts, setShowFacts] = useState(false);
  const startServing = (editing && editing.servingLabel) || (recent && recent.servingLabel) || food.servings[0].label;
  const [servingLabel, setServingLabel] = useState(food.servings.some((s) => s.label === startServing) || startServing === 'grams' ? startServing : food.servings[0].label);
  const [qty, setQty] = useState((editing && editing.qty) || (recent && recent.qty) || 1);
  const [grams, setGrams] = useState((editing && editing.servingLabel === 'grams' && editing.grams) || 100);

  const isGrams = servingLabel === 'grams';
  const serving = food.servings.find((s) => s.label === servingLabel) || food.servings[0];
  const totalGrams = isGrams ? grams || 0 : serving.g * qty;
  const n = nutritionFor(food, totalGrams);
  const portion = isGrams ? `${Math.round(grams || 0)} ${food.liquid ? 'ml' : 'g'}` : `${fmtQty(qty)} × ${serving.label}`;

  const servingOptions = food.custom || food.perServing ? food.servings : [...food.servings.filter((s) => s.label !== '100 g' && s.label !== '100 ml'), { label: 'grams', g: 1 }];

  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <Txt dim size={13}>
          {food.category}
        </Txt>
        {onEditFood && (
          <Pressable onPress={onEditFood} hitSlop={10} style={{ marginLeft: 'auto', marginRight: 16 }}>
            <Text style={{ color: t.primary, fontSize: 15, fontWeight: '600' }}>✎ Edit food</Text>
          </Pressable>
        )}
        <Pressable onPress={onToggleFav} hitSlop={10}>
          <Text style={{ color: favorite ? t.star : t.textDim, fontSize: 15, fontWeight: '600' }}>{favorite ? '★ Saved' : '☆ Save'}</Text>
        </Pressable>
      </View>

      <Txt dim size={13} weight="600" style={{ marginBottom: 6 }}>
        Portion size
      </Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        {servingOptions.map((s) => (
          <Chip
            key={s.label}
            label={s.label === 'grams' ? (food.liquid ? 'ml' : 'grams') : s.label}
            selected={servingLabel === s.label}
            color={t.food}
            onPress={() => setServingLabel(s.label)}
          />
        ))}
      </View>

      {isGrams ? (
        <NumberField label={food.liquid ? 'Amount (ml)' : 'Amount (grams)'} value={grams} onChange={setGrams} suffix={food.liquid ? 'ml' : 'g'} />
      ) : (
        <>
          <Txt dim size={13} weight="600" style={{ marginBottom: 6 }}>
            How many?
          </Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
            {QTY_CHIPS.map((q) => (
              <Chip key={q} label={fmtQty(q)} selected={qty === q} color={t.food} onPress={() => setQty(q)} style={{ minWidth: 44, alignItems: 'center' }} />
            ))}
          </View>
          <View style={{ alignItems: 'center', marginBottom: 12 }}>
            <Stepper value={qty} onChange={setQty} step={0.25} min={0.25} max={50} format={(v) => `${fmtQty(v)} ×`} />
          </View>
        </>
      )}

      {!hideMeal && (
        <>
          <Txt dim size={13} weight="600" style={{ marginBottom: 6 }}>
            Meal
          </Txt>
          <ChipRow scroll options={MEALS.map((x) => ({ key: x.key, label: `${x.icon} ${x.label}` }))} value={meal} onChange={setMeal} color={t.food} />
        </>
      )}

      <View style={{ backgroundColor: t.cardAlt, borderRadius: 14, padding: 14, marginTop: 14 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Txt size={14} dim>
            {portion}
            {!isGrams && !food.custom && !food.perServing ? ` (${Math.round(totalGrams)}${food.liquid ? ' ml' : ' g'})` : ''}
          </Txt>
          <Txt size={26} weight="800" color={t.food}>
            {n.kcal} kcal
          </Txt>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
          <Txt size={13}>Protein {n.protein}g</Txt>
          <Txt size={13}>Carbs {n.carbs}g</Txt>
          <Txt size={13}>Fat {n.fat}g</Txt>
          <Txt size={13}>Fiber {n.fiber}g</Txt>
        </View>
        <Pressable onPress={() => setShowFacts((v) => !v)} hitSlop={6} style={{ marginTop: 10 }}>
          <Txt color={t.primary} size={14} weight="700">
            📋 {showFacts ? 'Hide nutrition facts ▲' : 'Full nutrition facts ▼'}
          </Txt>
        </Pressable>
      </View>
      {showFacts && (
        <View style={{ marginTop: 10 }}>
          <FactsLabel
            totals={n}
            micro={n.micro || {}}
            subtitle={`For ${portion}${!isGrams && !food.custom && !food.perServing ? ` (${Math.round(totalGrams)}${food.liquid ? ' ml' : ' g'})` : ''}`}
            note={
              n.micro
                ? null
                : food.custom
                  ? 'No vitamins or minerals saved for this food yet. Tap "✎ Edit food" to add them from the label.'
                  : 'This food has no vitamin and mineral details in the database.'
            }
          />
        </View>
      )}

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
        {onBack && <Button variant="secondary" title="‹ Back" onPress={onBack} />}
        {onDelete && <Button variant="danger" title="Delete" onPress={onDelete} />}
        <Button
          style={{ flex: 1 }}
          color={t.food}
          title={saveLabel || (onDelete ? 'Save changes' : 'Add to log')}
          disabled={totalGrams <= 0}
          onPress={() =>
            onSave({
              foodId: food.id,
              name: food.name,
              meal,
              servingLabel,
              qty: isGrams ? 1 : qty,
              grams: totalGrams,
              portion,
              ...n,
            })
          }
        />
      </View>
    </View>
  );
}

function QuickAdd({ meal, setMeal, editing, onBack, onSave, onDelete }) {
  const t = useTheme();
  const [name, setName] = useState(editing ? editing.name : '');
  const [kcal, setKcal] = useState(editing ? editing.kcal : null);
  const [protein, setProtein] = useState(editing ? editing.protein : null);
  const [carbs, setCarbs] = useState(editing ? editing.carbs : null);
  const [fat, setFat] = useState(editing ? editing.fat : null);
  return (
    <View>
      <TextField label="Name (optional)" value={name} onChangeText={setName} placeholder="e.g. Office birthday cake" />
      <NumberField label="Calories" value={kcal} onChange={setKcal} suffix="kcal" autoFocus={!editing} />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <NumberField style={{ flex: 1 }} label="Protein" value={protein} onChange={setProtein} suffix="g" />
        <NumberField style={{ flex: 1 }} label="Carbs" value={carbs} onChange={setCarbs} suffix="g" />
        <NumberField style={{ flex: 1 }} label="Fat" value={fat} onChange={setFat} suffix="g" />
      </View>
      <ChipRow scroll options={MEALS.map((x) => ({ key: x.key, label: `${x.icon} ${x.label}` }))} value={meal} onChange={setMeal} color={t.food} />
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
        {onBack && <Button variant="secondary" title="‹ Back" onPress={onBack} />}
        {onDelete && <Button variant="danger" title="Delete" onPress={onDelete} />}
        <Button
          style={{ flex: 1 }}
          color={t.food}
          title={editing ? 'Save changes' : 'Add to log'}
          disabled={!kcal && !protein && !carbs && !fat}
          onPress={() => {
            const p = protein || 0;
            const c = carbs || 0;
            const f = fat || 0;
            onSave({
              foodId: null,
              name: name.trim() || 'Quick add',
              meal,
              kcal: Math.round(kcal || p * 4 + c * 4 + f * 9),
              protein: p,
              carbs: c,
              fat: f,
              fiber: editing ? editing.fiber || 0 : 0,
              portion: editing ? editing.portion : null,
            });
          }}
        />
      </View>
    </View>
  );
}

// Label groups for the optional vitamins & minerals section.
const MICRO_GROUPS = [
  { label: 'Fats, sodium and sugars', keys: MICRONUTRIENTS.filter((n) => !n.vitamin && !n.mineral) },
  { label: 'Vitamins', keys: MICRONUTRIENTS.filter((n) => n.vitamin) },
  { label: 'Minerals', keys: MICRONUTRIENTS.filter((n) => n.mineral) },
];

// Create a custom food (from scratch or a scanned label), or edit one (food = the saved custom food).
export function CustomFoodForm({ onBack, onSave, initial, food }) {
  const t = useTheme();
  const i = food || initial || {};
  const [name, setName] = useState(food ? food.name : '');
  const [servingLabel, setServingLabel] = useState(i.servingLabel || '1 serving');
  const [kcal, setKcal] = useState(i.kcal ?? null);
  const [protein, setProtein] = useState(i.protein ?? null);
  const [carbs, setCarbs] = useState(i.carbs ?? null);
  const [fat, setFat] = useState(i.fat ?? null);
  const [fiber, setFiber] = useState(i.fiber ?? null);
  const [micro, setMicro] = useState(() => ({ ...(i.micro || {}) }));
  const microCount = Object.values(micro).filter((v) => v != null).length;
  const [showMicro, setShowMicro] = useState(microCount > 0);
  const cleanMicro = () => {
    const out = Object.fromEntries(Object.entries(micro).filter(([, v]) => v != null && !Number.isNaN(v)));
    return Object.keys(out).length ? out : null;
  };
  return (
    <View>
      {initial && !food ? (
        <Txt color={t.primary} size={13} weight="600" style={{ marginBottom: 8 }}>
          📷 Read from the label{initial.found < 4 ? ` (found ${initial.found} of 4 main values)` : ''}. Give it a name and check the numbers before saving.
        </Txt>
      ) : null}
      {food ? (
        <Txt faint size={12} style={{ marginBottom: 8 }}>Custom foods are shared with everyone in the group, so changes reach them too.</Txt>
      ) : null}
      <Txt faint size={12} style={{ marginBottom: 10 }}>
        Copy the numbers from a nutrition label (per serving). You can log any multiple of the serving later.
      </Txt>
      <TextField label="Food name" value={name} onChangeText={setName} placeholder="e.g. Homemade lasagna" autoFocus={!food} />
      <TextField label="Serving size" value={servingLabel} onChangeText={setServingLabel} placeholder="e.g. 1 cup, 1 bar, 2 pieces" />
      <NumberField label="Calories per serving" value={kcal} onChange={setKcal} suffix="kcal" />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <NumberField style={{ flex: 1 }} label="Protein" value={protein} onChange={setProtein} suffix="g" />
        <NumberField style={{ flex: 1 }} label="Carbs" value={carbs} onChange={setCarbs} suffix="g" />
        <NumberField style={{ flex: 1 }} label="Fat" value={fat} onChange={setFat} suffix="g" />
      </View>
      <NumberField label="Fiber (optional)" value={fiber} onChange={setFiber} suffix="g" />

      <Pressable
        onPress={() => setShowMicro((v) => !v)}
        style={{ paddingVertical: 10, borderTopWidth: 0.5, borderBottomWidth: showMicro ? 0 : 0.5, borderColor: t.border, marginBottom: 6 }}
      >
        <Txt color={t.primary} weight="700">
          {showMicro ? '▲' : '▼'} Vitamins & minerals (optional){microCount ? ` · ${microCount} filled in` : ''}
        </Txt>
        {!showMicro && <Txt faint size={12}>Sodium, sugars, cholesterol, vitamins and minerals from the label, per serving.</Txt>}
      </Pressable>
      {showMicro &&
        MICRO_GROUPS.map((g) => (
          <View key={g.label} style={{ marginBottom: 6 }}>
            <Txt dim size={12} weight="800" style={{ marginBottom: 6 }}>{g.label.toUpperCase()}</Txt>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 8 }}>
              {g.keys.map((n) => (
                <NumberField
                  key={n.key}
                  style={{ width: '48%' }}
                  label={n.label}
                  value={micro[n.key] ?? null}
                  suffix={n.unit}
                  onChange={(v) => setMicro((m) => ({ ...m, [n.key]: v }))}
                />
              ))}
            </View>
          </View>
        ))}
      {showMicro && <Txt faint size={12} style={{ marginBottom: 8 }}>Leave anything you don't know empty. Labels often list vitamins as % Daily Value; the label's amount in mg or µg goes here.</Txt>}

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
        <Button variant="secondary" title="‹ Back" onPress={onBack} />
        <Button
          style={{ flex: 1 }}
          color={t.food}
          title={food ? 'Save changes' : 'Save food'}
          disabled={!name.trim() || kcal == null}
          onPress={() => {
            const m = cleanMicro();
            onSave({
              name: name.trim(),
              servingLabel: servingLabel.trim() || '1 serving',
              kcal: kcal || 0,
              protein: protein || 0,
              carbs: carbs || 0,
              fat: fat || 0,
              fiber: fiber || 0,
              ...(m ? { micro: m } : {}),
            });
          }}
        />
      </View>
    </View>
  );
}
