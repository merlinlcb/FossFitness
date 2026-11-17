// Saved meals UI: the "My meals" card at the bottom of the Nutrition page, the meal logger
// (pick a meal → choose the slot and servings → add every food at once) and the meal editor.
import React, { useMemo, useState } from 'react';
import { View, Pressable, Alert, Text } from 'react-native';
import { useStore } from '../state/store';
import { useHub } from '../state/hub';
import { useTheme } from '../theme';
import { Card, Txt, Button, Sheet, ChipRow, Stepper, TextField, Empty } from './ui';
import { FOODS, customToFood, MEALS } from '../lib/foods';
import { mealTotals, mealEntries, itemFromEntry, itemNutrition, mealSlotLabel } from '../lib/meals';
import { uid } from '../lib/dates';
import { FoodPicker, PortionEditor, CustomFoodForm, entryTime } from '../screens/FoodScreen';

// Every food the user can pick: their custom foods (and the group's) plus the built-in catalogue.
function useFoodIndex() {
  const { state } = useStore();
  const allFoods = useMemo(() => [...state.customFoods.map(customToFood), ...FOODS], [state.customFoods]);
  const byId = useMemo(() => Object.fromEntries(allFoods.map((f) => [f.id, f])), [allFoods]);
  return { allFoods, byId };
}

const slotOptions = MEALS.map((x) => ({ key: x.key, label: `${x.icon} ${x.label}` }));
const summary = (meal, byId) => {
  const n = mealTotals(meal, byId);
  const k = (meal.items || []).length;
  return `${mealSlotLabel(meal.meal)} · ${k} food${k === 1 ? '' : 's'} · ${n.kcal.toLocaleString()} kcal`;
};

// One meal in a list (the food picker's My foods, and the My meals card).
export function MealRow({ meal, byId, onPress, right }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: 0.5, borderBottomColor: t.border }}>
      <Text style={{ fontSize: 20, width: 30 }}>🍱</Text>
      <View style={{ flex: 1 }}>
        <Txt size={15} weight="600">{meal.name}</Txt>
        <Txt faint size={12} numberOfLines={1}>{summary(meal, byId)}</Txt>
        <Txt faint size={12} numberOfLines={1}>{(meal.items || []).map((i) => i.name).join(', ')}</Txt>
      </View>
      {right}
    </Pressable>
  );
}

// Bottom of the Nutrition page: the saved meals, with one-tap logging into each meal's slot.
export function MyMealsCard({ day, onOpen }) {
  const t = useTheme();
  const { state, dispatch } = useStore();
  const { byId } = useFoodIndex();
  const [editing, setEditing] = useState(null); // meal object, or {} for a new one
  const add = (ml) => {
    const entries = mealEntries(ml, byId, ml.meal);
    if (!entries.length) return;
    dispatch({ type: 'ADD_FOODS', day, entries, t: entryTime(day) });
    Alert.alert(`Added ${ml.name}`, `${entries.length} food${entries.length === 1 ? '' : 's'} added to ${mealSlotLabel(ml.meal).toLowerCase()}.`);
  };
  return (
    <>
      <Card title="🍱 My meals" right={<Button small variant="ghost" title="＋ New meal" onPress={() => setEditing({})} />} style={{ marginTop: 14 }}>
        {state.meals.length ? (
          state.meals.map((ml) => (
            <MealRow
              key={ml.id}
              meal={ml}
              byId={byId}
              onPress={() => onOpen(ml)}
              right={
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <Button small variant="secondary" title="✎" onPress={() => setEditing(ml)} />
                  <Button small color={t.food} title="＋ Add" onPress={() => add(ml)} />
                </View>
              }
            />
          ))
        ) : (
          <Txt dim size={14} style={{ lineHeight: 20 }}>
            Save foods you eat together as a meal, like “Thanksgiving dinner” = turkey, mashed potatoes and candied yams. Then add the whole meal to your log in one tap.
          </Txt>
        )}
        {state.meals.length ? (
          <Txt faint size={12} style={{ marginTop: 8 }}>
            ＋ Add puts the meal in its usual slot. Tap a meal to change the slot or servings first. Meals are also under My foods when you log food.
          </Txt>
        ) : (
          <Button color={t.food} title="＋ Create a meal" style={{ marginTop: 12 }} onPress={() => setEditing({})} />
        )}
      </Card>
      {editing ? <MealEditorSheet meal={editing} onClose={() => setEditing(null)} /> : null}
    </>
  );
}

// Inside the Log food sheet: log a saved meal, choosing the slot and how many servings.
export function MealLogger({ mealId, day, byId, onBack, onLogged }) {
  const t = useTheme();
  const { state, dispatch } = useStore();
  const meal = state.meals.find((m) => m.id === mealId);
  const [slot, setSlot] = useState((meal && meal.meal) || 'dinner');
  const [servings, setServings] = useState(1);
  const [editing, setEditing] = useState(false);
  if (!meal) return <Empty>This meal was deleted.</Empty>;
  const n = mealTotals(meal, byId, servings);
  return (
    <View>
      <Txt dim size={13} weight="600" style={{ marginBottom: 6 }}>Add to</Txt>
      <ChipRow scroll options={slotOptions} value={slot} onChange={setSlot} color={t.food} />
      <Txt dim size={13} weight="600" style={{ marginTop: 14, marginBottom: 6 }}>Servings</Txt>
      <View style={{ alignItems: 'center' }}>
        <Stepper value={servings} onChange={setServings} step={0.5} min={0.5} max={10} format={(v) => `${v} ×`} />
      </View>
      <View style={{ backgroundColor: t.cardAlt, borderRadius: 14, padding: 14, marginTop: 14 }}>
        {(meal.items || []).map((it, i) => {
          const x = itemNutrition(it, byId, servings);
          return (
            <View key={i} style={{ flexDirection: 'row', paddingVertical: 4 }}>
              <Txt size={14} style={{ flex: 1 }} numberOfLines={1}>{x.food ? x.food.name : it.name}</Txt>
              <Txt size={14} dim>{x.kcal} kcal</Txt>
            </View>
          );
        })}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 8, paddingTop: 8, borderTopWidth: 0.5, borderTopColor: t.border }}>
          <Txt size={13} dim>P {n.protein}g · C {n.carbs}g · F {n.fat}g</Txt>
          <Txt size={22} weight="800" color={t.food}>{n.kcal} kcal</Txt>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
        {onBack ? <Button variant="secondary" title="‹ Back" onPress={onBack} /> : null}
        <Button variant="secondary" title="✎ Edit meal" onPress={() => setEditing(true)} />
        <Button
          style={{ flex: 1 }}
          color={t.food}
          title="Add to log"
          disabled={!(meal.items || []).length}
          onPress={() => {
            dispatch({ type: 'ADD_FOODS', day, entries: mealEntries(meal, byId, slot, servings), t: entryTime(day) });
            onLogged();
          }}
        />
      </View>
      {editing ? <MealEditorSheet meal={meal} onClose={() => setEditing(false)} /> : null}
    </View>
  );
}

// Create or edit a meal: name, usual slot, and its foods (from the catalogue, or new foods,
// which are also added to the catalogue).
export function MealEditorSheet({ meal, onClose }) {
  const t = useTheme();
  const { state, dispatch } = useStore();
  const { auth } = useHub();
  const { allFoods, byId } = useFoodIndex();
  const isNew = !meal.id;
  const [name, setName] = useState(meal.name || '');
  const [slot, setSlot] = useState(meal.meal || 'dinner');
  const [items, setItems] = useState(meal.items || []);
  const [view, setView] = useState('main'); // main | pick | portion | create
  const [food, setFood] = useState(null);
  const [editIndex, setEditIndex] = useState(null);
  const draft = { name, meal: slot, items };
  const n = mealTotals(draft, byId);

  const save = () => {
    dispatch({ type: 'SAVE_MEAL', meal: { ...(meal.id ? { id: meal.id } : {}), name: name.trim(), meal: slot, items } });
    onClose();
  };
  const remove = () =>
    Alert.alert(`Delete ${meal.name}?`, 'Food you already logged stays in your log.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          dispatch({ type: 'REMOVE_MEAL', id: meal.id });
          onClose();
        },
      },
    ]);

  const title = view === 'pick' ? 'Add a food' : view === 'create' ? 'New food' : view === 'portion' && food ? food.name : isNew ? 'New meal' : 'Edit meal';

  return (
    <Sheet visible onClose={onClose} title={title}>
      {view === 'main' && (
        <View>
          <TextField label="Meal name" value={name} onChangeText={setName} placeholder="e.g. Thanksgiving dinner" />
          <Txt dim size={13} weight="600" style={{ marginBottom: 6 }}>Usually eaten as</Txt>
          <ChipRow scroll options={slotOptions} value={slot} onChange={setSlot} color={t.food} />
          <Txt dim size={13} weight="600" style={{ marginTop: 14, marginBottom: 4 }}>Foods</Txt>
          {items.length ? (
            items.map((it, i) => {
              const x = itemNutrition(it, byId);
              return (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 0.5, borderBottomColor: t.border }}>
                  <Pressable
                    style={{ flex: 1 }}
                    onPress={() => {
                      if (!x.food) return;
                      setFood(x.food);
                      setEditIndex(i);
                      setView('portion');
                    }}
                  >
                    <Txt size={15}>{x.food ? x.food.name : it.name}</Txt>
                    <Txt faint size={12}>{it.portion} · {x.kcal} kcal{x.food ? '' : ' · food deleted, saved values used'}</Txt>
                  </Pressable>
                  <Pressable hitSlop={10} onPress={() => setItems(items.filter((_, j) => j !== i))} accessibilityLabel={`Remove ${it.name}`}>
                    <Txt color={t.danger} size={18}>✕</Txt>
                  </Pressable>
                </View>
              );
            })
          ) : (
            <Txt faint size={13} style={{ marginBottom: 4 }}>No foods yet. Add the foods this meal is made of.</Txt>
          )}
          <Button variant="secondary" color={t.food} title="＋ Add a food" style={{ marginTop: 10 }} onPress={() => setView('pick')} />
          {items.length ? (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 12 }}>
              <Txt size={13} dim>P {n.protein}g · C {n.carbs}g · F {n.fat}g</Txt>
              <Txt size={20} weight="800" color={t.food}>{n.kcal} kcal</Txt>
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
            {!isNew ? <Button variant="danger" title="Delete" onPress={remove} /> : null}
            <Button style={{ flex: 1 }} color={t.food} title={isNew ? 'Save meal' : 'Save changes'} disabled={!name.trim() || !items.length} onPress={save} />
          </View>
          {!name.trim() || !items.length ? (
            <Txt faint size={12} center style={{ marginTop: 6 }}>Give it a name and at least one food.</Txt>
          ) : null}
        </View>
      )}
      {view === 'pick' && (
        <View>
          <Button small variant="ghost" title="‹ Back to the meal" style={{ alignSelf: 'flex-start', paddingHorizontal: 0, marginBottom: 6 }} onPress={() => setView('main')} />
          <FoodPicker
            allFoods={allFoods}
            byId={byId}
            onPick={(f) => {
              setFood(f);
              setEditIndex(null);
              setView('portion');
            }}
            onCustom={() => setView('create')}
          />
        </View>
      )}
      {view === 'portion' && food && (
        <PortionEditor
          food={food}
          meal={slot}
          setMeal={() => {}}
          hideMeal
          saveLabel={editIndex === null ? 'Add to meal' : 'Save portion'}
          editing={editIndex === null ? null : items[editIndex]}
          recent={state.recentFoods.find((r) => r.foodId === food.id)}
          favorite={state.favorites.includes(food.id)}
          onToggleFav={() => dispatch({ type: 'TOGGLE_FAVORITE', foodId: food.id })}
          onBack={() => setView(editIndex === null ? 'pick' : 'main')}
          onSave={(entry) => {
            const item = itemFromEntry(entry);
            setItems(editIndex === null ? [...items, item] : items.map((x, j) => (j === editIndex ? item : x)));
            setEditIndex(null);
            setView('main');
          }}
        />
      )}
      {view === 'create' && (
        <CustomFoodForm
          onBack={() => setView('pick')}
          onSave={(cf) => {
            // New foods made here also join the food catalogue (and are shared like any custom food).
            const made = { ...cf, id: `my-${uid()}`, ...(auth ? { by: auth.user.id } : {}) };
            dispatch({ type: 'ADD_CUSTOM_FOOD', food: made });
            setFood(customToFood(made));
            setEditIndex(null);
            setView('portion');
          }}
        />
      )}
    </Sheet>
  );
}
