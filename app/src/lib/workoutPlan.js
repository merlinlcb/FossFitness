// Training data: the exercise library, the suggested weekly plans (home or gym),
// "My own" free logging, tips and motivational messages. Pure data + helpers (no native imports).

import { dayKey, parseDayKey } from './dates';

const yt = (q) => `https://www.youtube.com/results?search_query=${q}`;

export const TRAINING_TIPS = [
  'Warm up for 5 minutes first: a brisk walk or a light set of your first exercise.',
  'Use a weight you can lift with good form, ending each set with 2–3 reps left in the tank.',
  'Add weight or reps only when every set hits the top of the rep range with good form.',
  'Rest 1–2 minutes between sets of big lifts, less for small ones.',
  'Stop any exercise that causes sharp pain.',
]

// No equipment needed: everything uses your body weight plus a floor, wall, sturdy chair or countertop.
// kind: 'bodyweight' (log reps, or seconds when unit === 'sec'), 'cardio' (log minutes).
// progression: the next step once every set hits the top of the rep range.
export const EXERCISES = [
  // Upper body
  { id: 'wall-pushup', name: 'Wall push-up', group: 'upper', kind: 'bodyweight', sets: 3, repMin: 10, repMax: 15, notes: 'Hands on a wall at shoulder height. Body in one straight line, with no sagging at the hips', progression: 'Move to countertop push-ups', video: yt('wall+push+up+proper+form') },
  { id: 'counter-pushup', name: 'Countertop (incline) push-up', group: 'upper', kind: 'bodyweight', sets: 3, repMin: 8, repMax: 12, notes: 'Hands on a sturdy counter or table edge. Squeeze your glutes so your lower back stays neutral', progression: 'Slow the lowering to 3 seconds, or add reps', video: yt('incline+push+up+countertop+form') },
  { id: 'close-wall-pushup', name: 'Close-grip wall push-up (triceps)', group: 'upper', kind: 'bodyweight', sets: 2, repMin: 12, repMax: 15, notes: 'Hands close together on the wall, elbows tucked to your sides', progression: 'Step your feet farther from the wall', video: yt('close+grip+wall+push+up+triceps') },
  { id: 'wall-angel', name: 'Wall angels', group: 'upper', kind: 'bodyweight', sets: 2, repMin: 10, repMax: 12, notes: 'Back and head against the wall, knees soft. Slide your arms up and down slowly. Strengthens the upper back and posture', progression: 'Pause 2 seconds at the top', video: yt('wall+angels+exercise+proper+form') },
  { id: 'doorframe-row', name: 'Doorframe isometric row', group: 'upper', kind: 'bodyweight', unit: 'sec', sets: 3, repMin: 15, repMax: 30, notes: 'Stand tall in a doorway, grip the frame and pull your shoulder blades back as if rowing. Hold the squeeze; your body stays upright', progression: 'Hold longer, up to 45 seconds', video: yt('isometric+doorway+row+exercise') },
  { id: 'prone-y-raise', name: 'Prone Y-T raises', group: 'upper', kind: 'bodyweight', sets: 2, repMin: 8, repMax: 12, notes: 'Lie face down, forehead on a folded towel. Lift only your arms a few inches; keep your chest and lower back relaxed', progression: 'Hold each lift for 2 seconds', video: yt('prone+y+t+raise+proper+form') },

  // Lower body (no squats, no lunges, no jumping)
  { id: 'side-leg-raise', name: 'Side-lying leg raise', group: 'lower', kind: 'bodyweight', sets: 2, repMin: 12, repMax: 20, perSide: true, notes: 'Lie on your side, bottom knee bent for support. Lift the top leg slowly with your toes pointing forward', progression: 'Pause 2 seconds at the top', video: yt('side+lying+leg+raise+form') },
  { id: 'inner-thigh-raise', name: 'Side-lying inner-thigh raise', group: 'lower', kind: 'bodyweight', sets: 2, repMin: 12, repMax: 20, perSide: true, notes: 'Top leg bent in front of you, lift the bottom leg a few inches', progression: 'Pause 2 seconds at the top', video: yt('side+lying+inner+thigh+raise') },
  { id: 'clamshell', name: 'Clamshells', group: 'lower', kind: 'bodyweight', sets: 2, repMin: 15, repMax: 20, perSide: true, notes: "Lie on your side, knees bent, feet together. Open the top knee without rolling your hips back", progression: 'Pause 2 seconds at the top', video: yt('clamshell+exercise+proper+form') },
  { id: 'seated-knee-ext', name: 'Seated knee extension', group: 'lower', kind: 'bodyweight', sets: 3, repMin: 12, repMax: 15, perSide: true, notes: 'Sit tall in a sturdy chair, back supported. Straighten one leg and squeeze your thigh for 2 seconds', progression: 'Hold 5 seconds at the top', video: yt('seated+knee+extension+exercise') },
  { id: 'standing-ham-curl', name: 'Standing hamstring curl', group: 'lower', kind: 'bodyweight', sets: 3, repMin: 12, repMax: 15, perSide: true, notes: 'Hold a counter or chair back, stand tall and bring your heel toward your butt. No leaning forward', progression: 'Slow 3-second lowering', video: yt('standing+hamstring+curl+bodyweight') },
  { id: 'standing-hip-ext', name: 'Standing hip extension', group: 'lower', kind: 'bodyweight', sets: 2, repMin: 12, repMax: 15, perSide: true, notes: 'Hold a counter, squeeze your glute and move one straight leg slightly back. Small range, without arching your lower back', progression: 'Pause 2 seconds at the back', video: yt('standing+hip+extension+exercise') },
  { id: 'calf-raise', name: 'Standing calf raise', group: 'lower', kind: 'bodyweight', sets: 3, repMin: 15, repMax: 20, notes: 'Hold a counter for balance, rise onto your toes slowly and lower slowly', progression: 'One leg at a time', video: yt('standing+calf+raise+bodyweight') },
  { id: 'glute-bridge', name: 'Glute bridge', group: 'lower', kind: 'bodyweight', sets: 2, repMin: 10, repMax: 15, notes: "Lie on your back, knees bent. Squeeze your glutes to lift your hips. Don't over-arch at the top", progression: 'Pause 3 seconds at the top', video: yt('glute+bridge+proper+form') },

  // Core stability
  { id: 'bird-dog', name: 'Bird dog', group: 'core', kind: 'bodyweight', sets: 2, repMin: 8, repMax: 8, perSide: true, notes: 'Slow, keep hips level', progression: 'Hold each rep 3–5 seconds', video: yt('bird+dog+exercise+proper+form') },
  { id: 'dead-bug', name: 'Dead bug', group: 'core', kind: 'bodyweight', sets: 2, repMin: 8, repMax: 8, perSide: true, notes: 'Lower back stays gently on the floor', progression: 'Slower, with a 2-second hold', video: yt('dead+bug+exercise+proper+form') },
  { id: 'wall-plank', name: 'Incline plank (wall or counter)', group: 'core', kind: 'bodyweight', unit: 'sec', sets: 2, repMin: 20, repMax: 40, notes: 'Forearms on a wall or counter, body straight, breathe normally. Stop if your back aches', progression: 'Lower surface (counter → sturdy chair)', video: yt('incline+plank+wall+beginner') },

  // Cardio (activity = key in exercise.js ACTIVITIES, used to count active minutes)
  { id: 'walk', name: 'Walking', group: 'cardio', kind: 'cardio', minutes: 10, maxMinutes: 20, activity: 'walk', notes: 'Supportive shoes. Start with 10–20 min and add a few minutes each week', video: null },
  { id: 'march', name: 'Marching in place (indoor walk)', group: 'cardio', kind: 'cardio', minutes: 10, maxMinutes: 20, activity: 'walk', notes: 'For bad weather. Stand tall and lift your knees at a comfortable height, holding a counter if needed', video: yt('indoor+walking+workout+low+impact+beginner') },
  { id: 'pool', name: 'Pool walking / water aerobics', group: 'cardio', kind: 'cardio', minutes: 20, maxMinutes: 30, activity: 'swim', notes: 'Optional, if you have pool access. Easy on your joints', video: yt('pool+walking+exercise+for+beginners') },
];

// Gym / general exercises for building your own plan ("My own plan").
// kind: 'strength' (log weight × reps), 'bodyweight' (log reps, or seconds when unit === 'sec'), 'cardio' (minutes).
const g = (id, name, group, kind, sets, repMin, repMax, notes, extra = {}) => ({
  id, name, group, kind, sets, repMin, repMax, notes, gym: true, video: yt(`${name.replace(/[()]/g, '')} proper form`.replace(/\s+/g, '+')), ...extra,
});
const c = (id, name, activity, minutes, maxMinutes, notes) => ({
  id, name, group: 'cardio', kind: 'cardio', minutes, maxMinutes, activity, notes, gym: true, video: null,
});
export const GYM_EXERCISES = [
  // Upper body
  g('bench-press', 'Bench press', 'upper', 'strength', 3, 6, 10, 'Feet planted, shoulder blades squeezed, bar to mid-chest'),
  g('incline-bench', 'Incline bench press', 'upper', 'strength', 3, 8, 12, 'Bench at 30–45°, bar or dumbbells to upper chest'),
  g('db-bench', 'Dumbbell bench press', 'upper', 'strength', 3, 8, 12, 'Lower slowly, press up and slightly in'),
  g('pushup', 'Push-ups', 'upper', 'bodyweight', 3, 10, 20, 'Body in one straight line, chest close to the floor'),
  g('dips', 'Dips (or assisted dips)', 'upper', 'strength', 3, 6, 12, 'Log the added or assisting weight. Lean slightly forward'),
  g('assisted-pullup', 'Assisted pull-up', 'upper', 'strength', 3, 6, 10, 'Log the assistance weight; less assistance = progress'),
  g('pullup', 'Pull-up / chin-up', 'upper', 'bodyweight', 3, 3, 10, 'Full hang to chin over the bar'),
  g('lat-pulldown', 'Lat pulldown', 'upper', 'strength', 3, 8, 12, 'Pull the bar to your upper chest, elbows down'),
  g('cable-row', 'Seated cable row', 'upper', 'strength', 3, 8, 12, 'Chest up, pull to your stomach, squeeze shoulder blades'),
  g('db-row', 'Dumbbell row', 'upper', 'strength', 3, 8, 12, 'Hand and knee on a bench, pull the dumbbell to your hip', { perSide: true }),
  g('ohp', 'Overhead press', 'upper', 'strength', 3, 6, 10, 'Brace your core, press straight up, no leaning back'),
  g('lateral-raise', 'Lateral raise', 'upper', 'strength', 3, 10, 15, 'Light weight, raise to shoulder height'),
  g('biceps-curl', 'Biceps curl', 'upper', 'strength', 3, 8, 12, 'Elbows at your sides, no swinging'),
  g('hammer-curl', 'Hammer curl', 'upper', 'strength', 3, 8, 12, 'Palms facing each other'),
  g('triceps-pushdown', 'Triceps pushdown', 'upper', 'strength', 3, 10, 15, 'Elbows pinned to your sides'),
  g('skull-crusher', 'Skull crusher', 'upper', 'strength', 3, 8, 12, 'Lower the bar to your forehead slowly'),
  // Lower body
  g('squat', 'Squats', 'lower', 'strength', 3, 6, 10, 'Chest up, knees track over toes, hips to at least parallel'),
  g('goblet-squat', 'Goblet squat', 'lower', 'strength', 3, 8, 12, 'Hold a dumbbell at your chest, sit between your heels'),
  g('leg-press', 'Leg press', 'lower', 'strength', 3, 8, 12, "Don't let your lower back lift off the pad"),
  g('deadlift', 'Deadlift', 'lower', 'strength', 3, 5, 8, 'Flat back, bar close to your legs, push the floor away'),
  g('rdl', 'Romanian deadlift', 'lower', 'strength', 3, 8, 12, 'Hinge at the hips, slight knee bend, feel the hamstrings'),
  g('lunge', 'Lunges', 'lower', 'strength', 3, 8, 12, 'Long step, back knee toward the floor', { perSide: true }),
  g('leg-extension', 'Leg extension', 'lower', 'strength', 3, 10, 15, 'Pause at the top'),
  g('leg-curl', 'Leg curl', 'lower', 'strength', 3, 10, 15, 'Control the way back'),
  g('hip-thrust', 'Hip thrust', 'lower', 'strength', 3, 8, 12, 'Upper back on a bench, squeeze your glutes at the top'),
  g('gym-calf-raise', 'Calf raise (weighted)', 'lower', 'strength', 3, 10, 15, 'Full stretch at the bottom, pause at the top'),
  // Core
  g('situp', 'Sit-ups', 'core', 'bodyweight', 3, 15, 25, 'Feet anchored, controlled on the way down'),
  g('crunch', 'Crunches', 'core', 'bodyweight', 3, 15, 25, 'Lift your shoulders, not your neck'),
  g('plank', 'Plank', 'core', 'bodyweight', 3, 30, 60, 'Straight line from head to heels', { unit: 'sec' }),
  g('hanging-knee-raise', 'Hanging knee raise', 'core', 'bodyweight', 3, 8, 15, 'No swinging'),
  g('cable-crunch', 'Cable crunch', 'core', 'strength', 3, 10, 15, 'Curl your ribs toward your hips'),
  // Cardio
  c('rowing-machine', 'Rowing machine', 'row', 10, 20, 'Legs, then body, then arms; reverse on the way back'),
  c('treadmill', 'Treadmill', 'brisk_walk', 15, 30, 'Walk or jog; an incline makes walking harder'),
  c('stationary-bike', 'Stationary bike', 'cycle', 15, 30, 'Seat at hip height, steady pace'),
  c('elliptical-machine', 'Elliptical', 'elliptical', 15, 30, 'Steady pace, stand tall'),
  c('stair-climber', 'Stair climber', 'stairs', 10, 20, 'Light grip on the rails'),
  c('run', 'Running', 'run', 15, 30, 'Easy pace you could still talk at'),
  c('walking', 'Walking', 'walk', 15, 45, 'Brisk enough to breathe a little harder'),
  { ...c('swim-laps', 'Swimming (laps)', 'swim', 15, 30, 'Log the time and how many laps you swam'), laps: true },
  // ---- More exercises (sub = category in Settings → My exercises) ----
  // Chest
  g('decline-bench', 'Decline bench press', 'upper', 'strength', 3, 6, 10, 'Bench declined; bar to lower chest', { sub: 'chest' }),
  g('db-incline', 'Incline dumbbell press', 'upper', 'strength', 3, 8, 12, 'Bench at 30–45°, press up and slightly in', { sub: 'chest' }),
  g('chest-fly', 'Dumbbell fly', 'upper', 'strength', 3, 10, 15, 'Slight bend in the elbows, stretch wide, squeeze together', { sub: 'chest' }),
  g('cable-fly', 'Cable fly', 'upper', 'strength', 3, 10, 15, 'Hug a big tree; control the way back', { sub: 'chest' }),
  g('pec-deck', 'Pec deck (machine fly)', 'upper', 'strength', 3, 10, 15, 'Elbows soft, pause when the pads meet', { sub: 'chest' }),
  g('machine-chest-press', 'Machine chest press', 'upper', 'strength', 3, 8, 12, 'Handles at mid-chest height', { sub: 'chest' }),
  g('smith-bench', 'Smith machine bench press', 'upper', 'strength', 3, 6, 10, 'Bar path straight to mid-chest', { sub: 'chest' }),
  g('diamond-pushup', 'Diamond push-ups', 'upper', 'bodyweight', 3, 8, 15, 'Hands together under the chest; works triceps too', { sub: 'chest' }),
  g('decline-pushup', 'Decline push-ups', 'upper', 'bodyweight', 3, 8, 15, 'Feet on a bench, body straight', { sub: 'chest' }),
  // Back
  g('barbell-row', 'Barbell row', 'upper', 'strength', 3, 6, 10, 'Hinge forward, flat back, pull to the stomach', { sub: 'back' }),
  g('t-bar-row', 'T-bar row', 'upper', 'strength', 3, 8, 12, 'Chest up, pull with the elbows', { sub: 'back' }),
  g('machine-row', 'Seated machine row', 'upper', 'strength', 3, 8, 12, 'Chest on the pad, squeeze shoulder blades', { sub: 'back' }),
  g('chinup', 'Chin-up', 'upper', 'bodyweight', 3, 3, 10, 'Palms facing you, chin over the bar', { sub: 'back' }),
  g('inverted-row', 'Inverted row', 'upper', 'bodyweight', 3, 6, 12, 'Under a bar or table edge, body straight', { sub: 'back' }),
  g('straight-arm-pulldown', 'Straight-arm pulldown', 'upper', 'strength', 3, 10, 15, 'Arms long, sweep the bar to the thighs', { sub: 'back' }),
  g('back-extension', 'Back extension', 'upper', 'bodyweight', 3, 10, 15, 'Hinge at the hips; no over-arching at the top', { sub: 'back' }),
  g('rack-pull', 'Rack pull', 'upper', 'strength', 3, 5, 8, 'Deadlift from just below the knees', { sub: 'back' }),
  g('shrug', 'Shrugs', 'upper', 'strength', 3, 10, 15, 'Lift the shoulders straight up, pause', { sub: 'back' }),
  g('single-arm-pulldown', 'Single-arm cable pulldown', 'upper', 'strength', 3, 10, 12, 'Pull the elbow to your side', { sub: 'back', perSide: true }),
  // Shoulders
  g('db-shoulder-press', 'Dumbbell shoulder press', 'upper', 'strength', 3, 8, 12, 'Seated or standing, press overhead', { sub: 'shoulders' }),
  g('arnold-press', 'Arnold press', 'upper', 'strength', 3, 8, 12, 'Rotate palms out as you press', { sub: 'shoulders' }),
  g('machine-shoulder-press', 'Machine shoulder press', 'upper', 'strength', 3, 8, 12, 'Handles start at shoulder height', { sub: 'shoulders' }),
  g('front-raise', 'Front raise', 'upper', 'strength', 3, 10, 15, 'Raise to eye level, no swinging', { sub: 'shoulders' }),
  g('rear-delt-fly', 'Reverse fly (rear delts)', 'upper', 'strength', 3, 12, 15, 'Bent over or on the pec deck reversed', { sub: 'shoulders' }),
  g('face-pull', 'Face pull', 'upper', 'strength', 3, 12, 15, 'Rope to the forehead, elbows high', { sub: 'shoulders' }),
  g('upright-row', 'Upright row', 'upper', 'strength', 3, 10, 12, 'Wide grip, elbows lead, stop at chest height', { sub: 'shoulders' }),
  g('cable-lateral-raise', 'Cable lateral raise', 'upper', 'strength', 3, 12, 15, 'Light weight, lead with the elbow', { sub: 'shoulders', perSide: true }),
  g('pike-pushup', 'Pike push-ups', 'upper', 'bodyweight', 3, 6, 12, 'Hips high, head toward the floor', { sub: 'shoulders' }),
  // Arms
  g('ez-curl', 'EZ-bar curl', 'upper', 'strength', 3, 8, 12, 'Elbows still, full range', { sub: 'arms' }),
  g('preacher-curl', 'Preacher curl', 'upper', 'strength', 3, 8, 12, 'Upper arm on the pad, lower slowly', { sub: 'arms' }),
  g('concentration-curl', 'Concentration curl', 'upper', 'strength', 3, 10, 12, 'Elbow on the inner thigh', { sub: 'arms', perSide: true }),
  g('cable-curl', 'Cable curl', 'upper', 'strength', 3, 10, 15, 'Constant tension, squeeze at the top', { sub: 'arms' }),
  g('incline-db-curl', 'Incline dumbbell curl', 'upper', 'strength', 3, 8, 12, 'Lie back on an incline bench, arms hanging', { sub: 'arms' }),
  g('overhead-triceps', 'Overhead triceps extension', 'upper', 'strength', 3, 10, 12, 'Elbows point up, lower behind the head', { sub: 'arms' }),
  g('triceps-kickback', 'Triceps kickback', 'upper', 'strength', 3, 10, 15, 'Upper arm still, straighten fully', { sub: 'arms', perSide: true }),
  g('close-grip-bench', 'Close-grip bench press', 'upper', 'strength', 3, 6, 10, 'Hands shoulder-width, elbows tucked', { sub: 'arms' }),
  g('bench-dips', 'Bench dips', 'upper', 'bodyweight', 3, 10, 15, 'Hands on a bench behind you', { sub: 'arms' }),
  g('wrist-curl', 'Wrist curl', 'upper', 'strength', 3, 12, 20, 'Forearms on the bench, curl the wrist', { sub: 'arms' }),
  // Legs & glutes
  g('front-squat', 'Front squat', 'lower', 'strength', 3, 5, 8, 'Bar on the front of the shoulders, elbows high', { sub: 'legs' }),
  g('hack-squat', 'Hack squat', 'lower', 'strength', 3, 8, 12, 'Machine; feet mid-platform', { sub: 'legs' }),
  g('smith-squat', 'Smith machine squat', 'lower', 'strength', 3, 8, 12, 'Feet slightly forward of the bar', { sub: 'legs' }),
  g('belt-squat', 'Belt squat', 'lower', 'strength', 3, 8, 12, 'Load at the hips, spine stays free', { sub: 'legs' }),
  g('bulgarian-split-squat', 'Bulgarian split squat', 'lower', 'strength', 3, 8, 12, 'Rear foot on a bench', { sub: 'legs', perSide: true }),
  g('walking-lunge', 'Walking lunges', 'lower', 'strength', 3, 10, 16, 'Long steps, upright torso', { sub: 'legs', perSide: true }),
  g('step-up', 'Step-ups', 'lower', 'strength', 3, 8, 12, 'Drive through the top foot', { sub: 'legs', perSide: true }),
  g('sumo-deadlift', 'Sumo deadlift', 'lower', 'strength', 3, 5, 8, 'Wide stance, hands inside the knees', { sub: 'legs' }),
  g('good-morning', 'Good morning', 'lower', 'strength', 3, 8, 12, 'Light bar, hinge with a flat back', { sub: 'legs' }),
  g('hip-abduction', 'Hip abduction machine', 'lower', 'strength', 3, 12, 20, 'Push the pads out, pause', { sub: 'legs' }),
  g('hip-adduction', 'Hip adduction machine', 'lower', 'strength', 3, 12, 20, 'Squeeze the pads together', { sub: 'legs' }),
  g('seated-calf-raise', 'Seated calf raise', 'lower', 'strength', 3, 12, 20, 'Full stretch at the bottom', { sub: 'legs' }),
  g('kettlebell-swing', 'Kettlebell swing', 'lower', 'strength', 3, 12, 20, 'Snap the hips; arms just guide the bell', { sub: 'legs' }),
  g('cable-kickback', 'Cable glute kickback', 'lower', 'strength', 3, 12, 15, 'Kick straight back, squeeze the glute', { sub: 'legs', perSide: true }),
  g('bodyweight-squat', 'Bodyweight squats', 'lower', 'bodyweight', 3, 15, 25, 'Sit back, chest up', { sub: 'legs' }),
  g('wall-sit', 'Wall sit', 'lower', 'bodyweight', 3, 30, 60, 'Thighs parallel, back on the wall', { sub: 'legs', unit: 'sec' }),
  g('box-jump', 'Box jumps', 'lower', 'bodyweight', 3, 5, 10, 'Land softly, step down', { sub: 'legs' }),
  g('single-leg-rdl', 'Single-leg Romanian deadlift', 'lower', 'strength', 3, 8, 12, 'Hinge on one leg, hips square', { sub: 'legs', perSide: true }),
  // Core
  g('russian-twist', 'Russian twist', 'core', 'bodyweight', 3, 16, 30, 'Lean back, rotate side to side', { sub: 'core' }),
  g('leg-raise', 'Lying leg raise', 'core', 'bodyweight', 3, 10, 15, 'Lower back pressed down', { sub: 'core' }),
  g('hanging-leg-raise', 'Hanging leg raise', 'core', 'bodyweight', 3, 6, 12, 'Straight legs up, no swinging', { sub: 'core' }),
  g('bicycle-crunch', 'Bicycle crunch', 'core', 'bodyweight', 3, 16, 30, 'Elbow to opposite knee, slow', { sub: 'core' }),
  g('mountain-climber', 'Mountain climbers', 'core', 'bodyweight', 3, 20, 40, 'Plank position, knees drive in', { sub: 'core' }),
  g('side-plank', 'Side plank', 'core', 'bodyweight', 3, 20, 45, 'Hips high, body straight', { sub: 'core', unit: 'sec', perSide: true }),
  g('ab-wheel', 'Ab wheel rollout', 'core', 'bodyweight', 3, 6, 12, 'Roll out only as far as you can control', { sub: 'core' }),
  g('pallof-press', 'Pallof press', 'core', 'strength', 3, 10, 12, 'Press the cable out, resist the twist', { sub: 'core', perSide: true }),
  g('v-up', 'V-ups', 'core', 'bodyweight', 3, 8, 15, 'Hands meet feet at the top', { sub: 'core' }),
  g('flutter-kick', 'Flutter kicks', 'core', 'bodyweight', 3, 20, 40, 'Small fast kicks, lower back down', { sub: 'core', unit: 'sec' }),
  g('weighted-situp', 'Decline sit-ups', 'core', 'strength', 3, 10, 15, 'On a decline bench; hold a plate for more', { sub: 'core' }),
  // Cardio, sports and classes
  c('recumbent-bike', 'Recumbent bike', 'cycle', 15, 30, 'Back supported, steady pace'),
  c('spin-class', 'Spin class', 'cycle', 30, 45, 'Indoor cycling class'),
  c('cycling', 'Cycling (outdoor)', 'cycle', 20, 60, 'Road, trail or commute'),
  c('incline-walk', 'Incline treadmill walk', 'brisk_walk', 15, 40, 'Steep incline, no holding the rails'),
  c('jog', 'Jogging', 'jog', 15, 40, 'Comfortable pace'),
  c('hike', 'Hiking', 'hike', 30, 120, 'Trails and hills'),
  c('jump-rope', 'Jump rope', 'hiit', 5, 15, 'Short rounds with rests'),
  c('hiit', 'HIIT / circuit', 'hiit', 15, 30, 'Hard intervals with short rests'),
  c('boxing', 'Boxing / kickboxing', 'hiit', 20, 60, 'Bag work, pads or a class'),
  c('rower-outdoor', 'Rowing / kayaking (outdoor)', 'row', 20, 60, 'On the water'),
  c('stairs-real', 'Stair climbing (stairs)', 'stairs', 10, 30, 'Real stairs or stadium steps'),
  c('swimming', 'Swimming (time)', 'swim', 20, 45, 'Any stroke, steady'),
  c('yoga', 'Yoga', 'yoga', 20, 60, 'Flow, stretch or class'),
  c('pilates', 'Pilates', 'yoga', 20, 60, 'Mat or reformer'),
  c('stretching', 'Stretching / mobility', 'stretch', 10, 30, 'Gentle full-body stretch'),
  c('dance', 'Dancing', 'dance', 20, 60, 'Class or just for fun'),
  c('basketball', 'Basketball', 'sports', 30, 90, 'Pickup game or practice'),
  c('soccer', 'Soccer', 'sports', 30, 90, 'Game or practice'),
  c('tennis', 'Tennis', 'sports', 30, 90, 'Singles or doubles'),
  c('pickleball', 'Pickleball', 'sports', 30, 90, 'Rally on'),
  c('martial-arts', 'Martial arts', 'sports', 30, 90, 'Class or sparring'),
  c('climbing', 'Rock climbing / bouldering', 'sports', 30, 90, 'Gym or outdoor'),
  c('golf-walk', 'Golf (walking)', 'walk', 60, 240, 'Carry or push the bag'),
  c('yard-work', 'Yard work', 'chores', 20, 90, 'Mowing, raking, digging'),
];

// Exercises from earlier versions of the plan, so old logs still show a name.
const RETIRED = {
  'chest-press': 'Seated machine chest press',
  'chest-row': 'Chest-supported row',
  'lat-pulldown': 'Lat pulldown',
  'cable-row': 'Seated cable row',
  'biceps-curl': 'Seated biceps curl',
  'triceps-pushdown': 'Cable triceps pushdown',
  'leg-extension': 'Leg extension',
  'leg-curl': 'Leg curl',
};

export const GROUPS = [
  { key: 'upper', label: 'Upper body' },
  { key: 'lower', label: 'Lower body' },
  { key: 'core', label: 'Core stability' },
  { key: 'cardio', label: 'Cardio' },
  { key: 'other', label: 'Misc' },
];

const byId = Object.fromEntries([...GYM_EXERCISES, ...EXERCISES].map((e) => [e.id, e]));
const customList = (plan) => (plan && Array.isArray(plan.customExercises) ? plan.customExercises : []);
// Every exercise available for "My own plan": gym list, your own, and the home (no equipment) ones.
export const allExercises = (plan) => [...GYM_EXERCISES, ...customList(plan), ...EXERCISES];
export const exerciseById = (id, plan) => byId[id] || customList(plan).find((e) => e.id === id);
export const exerciseName = (id, plan) => {
  const e = exerciseById(id, plan);
  return e ? e.name : RETIRED[id] || id;
};
export const isCustomPlan = (plan) => !!plan && plan.mode === 'custom';

// Sub-categories for the "My exercises" list in Settings.
export const SUBGROUPS = [
  { key: 'chest', label: 'Chest', group: 'upper' },
  { key: 'back', label: 'Back', group: 'upper' },
  { key: 'shoulders', label: 'Shoulders', group: 'upper' },
  { key: 'arms', label: 'Arms', group: 'upper' },
  { key: 'legs', label: 'Legs & glutes', group: 'lower' },
  { key: 'core', label: 'Core', group: 'core' },
  { key: 'misc', label: 'Misc', group: 'other' },
  { key: 'cardio', label: 'Cardio', group: 'cardio' },
  { key: 'home', label: 'Home (no equipment)', group: null },
];
const SUB_OF = {
  'bench-press': 'chest', 'incline-bench': 'chest', 'db-bench': 'chest', pushup: 'chest', dips: 'chest',
  'assisted-pullup': 'back', pullup: 'back', 'lat-pulldown': 'back', 'cable-row': 'back', 'db-row': 'back', deadlift: 'back',
  ohp: 'shoulders', 'lateral-raise': 'shoulders',
  'biceps-curl': 'arms', 'hammer-curl': 'arms', 'triceps-pushdown': 'arms', 'skull-crusher': 'arms',
};
export function subgroupOf(ex) {
  if (!ex) return 'core';
  if (ex.sub) return ex.sub;
  if (SUB_OF[ex.id]) return SUB_OF[ex.id];
  if (!ex.gym && !ex.custom) return 'home';
  return { upper: 'arms', lower: 'legs', core: 'core', cardio: 'cardio' }[ex.group] || 'core';
}

// The exercises switched on in Settings → Training → My exercises. Before that list existed,
// the ones used in the weekly plan count as switched on.
export function myExerciseIds(plan) {
  if (plan && Array.isArray(plan.myExercises)) return plan.myExercises.filter((id) => exerciseById(id, plan));
  const fromWeek = Object.values((plan && plan.week) || {}).flat();
  return [...new Set(fromWeek)].filter((id) => exerciseById(id, plan));
}

// For "Use yesterday's exercises": the most recent earlier day with exercises logged (within two weeks).
export function previousWorkout(days, beforeKey) {
  const keys = Object.keys(days || {}).filter((k) => k < beforeKey).sort().reverse().slice(0, 14);
  for (const k of keys) {
    const w = days[k] && days[k].workout;
    if (w && Array.isArray(w.items) && w.items.length) return { day: k, workout: w };
  }
  return null;
}

// A logged cardio entry: { minutes, intensity, laps }. Older logs stored just minutes.
export function cardioLog(v) {
  if (v && typeof v === 'object') return { minutes: Number(v.minutes) || 0, intensity: v.intensity || 'moderate', laps: Number(v.laps) || 0 };
  return { minutes: Number(v) || 0, intensity: 'moderate', laps: 0 };
}
const ofGroup = (g) => EXERCISES.filter((e) => e.group === g).map((e) => e.id);

// ----- Suggested plan: home (no equipment) -----
// A session option: title + exercise ids.
const UPPER = { key: 'upper', title: 'Upper body + 10 min walk', items: [...ofGroup('upper'), 'walk'], strength: true };
const LOWER = { key: 'lower', title: 'Lower body + 10 min walk', items: [...ofGroup('lower'), 'walk'], strength: true };
const LOWER_ONLY = { key: 'lower', title: 'Lower body', items: ofGroup('lower'), strength: true };
const WALK_CORE = { key: 'walk-core', title: 'Walk + core', items: ['walk', ...ofGroup('core')] };
const MARCH_CORE = { key: 'march-core', title: 'Indoor march + core', items: ['march', ...ofGroup('core')] };
const POOL_CORE = { key: 'pool-core', title: 'Pool + core', items: ['pool', ...ofGroup('core')] };
const POOL = { key: 'pool', title: 'Pool session', items: ['pool'] };
const EASY_WALK = { key: 'easy-walk', title: 'Easy walk', items: ['walk'] };
const REST = { key: 'rest', title: 'Rest day', items: [], rest: true };

// index = Date.getDay() (0 = Sunday)
export const WEEKLY_SCHEDULE = [
  { day: 'Sunday', title: 'Easy walk or rest', options: [EASY_WALK, REST] },
  { day: 'Monday', title: 'Upper body + 10 min walk', options: [UPPER] },
  { day: 'Tuesday', title: 'Walk or pool + core', options: [WALK_CORE, MARCH_CORE, POOL_CORE] },
  { day: 'Wednesday', title: 'Lower body + 10 min walk', options: [LOWER] },
  { day: 'Thursday', title: 'Walk or pool + core', options: [WALK_CORE, MARCH_CORE, POOL_CORE] },
  { day: 'Friday', title: 'Upper body + 10 min walk', options: [UPPER] },
  { day: 'Saturday', title: 'Lower body or pool session', options: [LOWER_ONLY, POOL] },
];

// ----- Suggested plan: gym (upper/lower split, two cardio days) -----
const GYM_UPPER_A = { key: 'gym-upper-a', title: 'Upper body A', items: ['bench-press', 'lat-pulldown', 'ohp', 'cable-row', 'biceps-curl', 'triceps-pushdown'], strength: true };
const GYM_LOWER_A = { key: 'gym-lower-a', title: 'Lower body A', items: ['squat', 'rdl', 'leg-curl', 'gym-calf-raise', 'plank'], strength: true };
const GYM_UPPER_B = { key: 'gym-upper-b', title: 'Upper body B', items: ['incline-bench', 'assisted-pullup', 'db-row', 'lateral-raise', 'hammer-curl', 'skull-crusher'], strength: true };
const GYM_LOWER_B = { key: 'gym-lower-b', title: 'Lower body B', items: ['leg-press', 'hip-thrust', 'leg-extension', 'lunge', 'hanging-knee-raise'], strength: true };
const GYM_CARDIO = [
  { key: 'gym-treadmill', title: 'Treadmill', items: ['treadmill'] },
  { key: 'gym-bike', title: 'Bike', items: ['stationary-bike'] },
  { key: 'gym-row', title: 'Rowing machine', items: ['rowing-machine'] },
  { key: 'gym-elliptical', title: 'Elliptical', items: ['elliptical-machine'] },
];
const GYM_WEEKEND = [{ key: 'gym-run', title: 'Run', items: ['run'] }, { key: 'gym-swim', title: 'Swim', items: ['swim-laps'] }, ...GYM_CARDIO];

export const GYM_SCHEDULE = [
  { day: 'Sunday', title: 'Easy walk or rest', options: [{ key: 'gym-walk', title: 'Easy walk', items: ['walking'] }, REST] },
  { day: 'Monday', title: 'Upper body A', options: [GYM_UPPER_A] },
  { day: 'Tuesday', title: 'Lower body A', options: [GYM_LOWER_A] },
  { day: 'Wednesday', title: 'Cardio or rest', options: [...GYM_CARDIO, REST] },
  { day: 'Thursday', title: 'Upper body B', options: [GYM_UPPER_B] },
  { day: 'Friday', title: 'Lower body B', options: [GYM_LOWER_B] },
  { day: 'Saturday', title: 'Cardio', options: GYM_WEEKEND },
];

// The two suggested plans (Settings → Training).
export const SUGGESTED_PLANS = [
  { key: 'home', label: 'Home', desc: 'No equipment: a floor, a wall, a chair and a counter. Upper and lower body days, walks and core.' },
  { key: 'gym', label: 'Gym', desc: 'Free weights and machines. Upper and lower body twice a week each, plus cardio days.' },
];
export const suggestedKind = (plan) => (plan && plan.suggested === 'gym' ? 'gym' : 'home');
const suggestedSchedule = (plan) => (suggestedKind(plan) === 'gym' ? GYM_SCHEDULE : WEEKLY_SCHEDULE);
// Exercises used by the suggested plan, for its library.
export function suggestedExercises(plan) {
  const ids = new Set(suggestedSchedule(plan).flatMap((d) => d.options.flatMap((o) => o.items)));
  return [...ids].map((id) => byId[id]).filter(Boolean);
}

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Title for a day of "My own plan" from what is in it, e.g. "Upper body + Cardio".
export function customDayTitle(ids, plan) {
  const exs = (ids || []).map((id) => exerciseById(id, plan)).filter(Boolean);
  if (!exs.length) return 'Rest day';
  if (exs.length === 1) return exs[0].name;
  const groups = GROUPS.filter((gr) => exs.some((e) => e.group === gr.key)).map((gr) => (gr.key === 'core' ? 'Core' : gr.label));
  return groups.join(' + ');
}

// "My own plan" is a free log: no schedule, you pick what you did each day.
function customSchedule(dow) {
  return { day: DAY_NAMES[dow], title: 'Your workout', options: [{ key: 'custom', title: 'Your workout', items: [], free: true }] };
}

// `plan` is state.workoutPlan; without it the suggested home plan is used.
export function scheduleForDate(date = new Date(), plan) {
  const d = typeof date === 'string' ? parseDayKey(date) : new Date(date);
  if (isCustomPlan(plan)) return customSchedule(d.getDay());
  return suggestedSchedule(plan)[d.getDay()];
}

export const weeklySchedule = (plan) => [0, 1, 2, 3, 4, 5, 6].map((dow) => (isCustomPlan(plan) ? customSchedule(dow) : suggestedSchedule(plan)[dow]));

// The chosen option for a day (user can switch, e.g. walk vs. pool).
export function sessionFor(date, workoutLog, plan) {
  if (isCustomPlan(plan)) {
    const items = ((workoutLog && workoutLog.items) || []).filter((id) => exerciseById(id, plan));
    return { key: 'custom', title: items.length ? customDayTitle(items, plan) : 'Your workout', items, free: true,
      strength: items.some((id) => exerciseById(id, plan).kind !== 'cardio') };
  }
  const sched = scheduleForDate(date, plan);
  const choice = workoutLog && workoutLog.choice;
  return sched.options.find((o) => o.key === choice) || sched.options[0];
}

export const DAILY_GOALS = {
  proteinMin: 160,
  proteinMax: 200,
  sleepHours: 7,
  stepsWeeklyIncrease: 500,
};

// Target steps: baseline + 500 per full week since the plan started.
export function stepGoal(stepPlan, date = new Date()) {
  if (!stepPlan || !stepPlan.baseline) return null;
  const start = parseDayKey(stepPlan.startDate || dayKey(date));
  const weeks = Math.max(0, Math.floor((parseDayKey(dayKey(date)) - start) / (7 * 86400000)));
  return stepPlan.baseline + weeks * DAILY_GOALS.stepsWeeklyIncrease;
}

export const MOTIVATION = [
  'Small session today beats a perfect plan tomorrow.',
  "You don't have to be perfect. You just have to not quit.",
  'Your future self is counting on today\'s you.',
  'Show up for yourself today. Consistency beats intensity.',
  'The hardest part is starting. Start small.',
  'Every rep counts, even on the days that feel slow.',
  'Progress, not perfection.',
  'Strong body, clear head. Get a little of both today.',
  "Discipline is choosing what you want most over what you want right now.",
  'One good day at a time adds up faster than you think.',
]

// Rotates by calendar day, so consecutive days always get different messages.
export function motivationFor(date = new Date()) {
  const d = parseDayKey(dayKey(date));
  const dayNumber = Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
  return MOTIVATION[((dayNumber % MOTIVATION.length) + MOTIVATION.length) % MOTIVATION.length];
}

// ----- Progress helpers -----

// All logged sessions for an exercise, oldest first: [{ date, sets: [{kg, reps}] }]
export function exerciseHistory(days, exerciseId) {
  return Object.keys(days)
    .sort()
    .map((k) => {
      const w = days[k] && days[k].workout;
      const sets = w && w.sets && w.sets[exerciseId];
      const done = sets ? sets.filter((s) => s && s.reps > 0) : [];
      return done.length ? { date: k, sets: done } : null;
    })
    .filter(Boolean);
}

export function lastSession(days, exerciseId, beforeKey) {
  const h = exerciseHistory(days, exerciseId).filter((s) => !beforeKey || s.date < beforeKey);
  return h.length ? h[h.length - 1] : null;
}

// The most recent earlier day with minutes logged for a cardio exercise: { day, minutes, intensity, laps }.
export function lastCardio(days, exerciseId, beforeKey) {
  const keys = Object.keys(days || {}).filter((k) => !beforeKey || k < beforeKey).sort().reverse();
  for (const k of keys) {
    const v = days[k] && days[k].workout && days[k].workout.cardio && days[k].workout.cardio[exerciseId];
    const c = cardioLog(v);
    if (c.minutes > 0) return { day: k, ...c };
  }
  return null;
}

// Ready to add weight when every planned set hit the top of the rep range at the same weight.
export function readyToProgress(ex, session) {
  if (!session || ex.kind === 'cardio') return false;
  const sets = session.sets.slice(0, ex.sets);
  if (sets.length < ex.sets) return false;
  return sets.every((s) => s.reps >= ex.repMax);
}

export function bestSet(session) {
  if (!session) return null;
  return session.sets.reduce((best, s) => (!best || (s.kg || 0) > (best.kg || 0) || ((s.kg || 0) === (best.kg || 0) && s.reps > best.reps) ? s : best), null);
}

// Workout adherence over the last 7 days: planned (non-rest) sessions vs completed.
export function weekAdherence(days, keys, plan) {
  let planned = 0;
  let done = 0;
  for (const k of keys) {
    const log = days[k] && days[k].workout;
    const s = sessionFor(k, log, plan);
    if (s.free) {
      // Free log: every day you logged exercises (or marked done) counts.
      if (s.items.length || (log && log.done)) {
        planned++;
        if (log && log.done) done++;
      }
      continue;
    }
    if (s.rest) continue;
    if (scheduleForDate(k, plan).options.some((o) => o.rest) && !(log && log.done)) continue; // optional day
    planned++;
    if (log && log.done) done++;
  }
  return { planned, done };
}

export function sessionSummary(session, plan) {
  if (session.rest) return 'Rest and recover';
  if (session.free && !session.items.length) return 'Nothing logged yet. Open Train to log what you did.';
  return session.items
    .map((id) => exerciseById(id, plan))
    .filter(Boolean)
    .map((e) => e.name)
    .join(' · ');
}

// A user-made exercise for "My own plan".
export function makeCustomExercise({ name, group, sub, kind, sets, repMin, repMax, minutes, maxMinutes, unit }, id) {
  const base = { id: id || `cx-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, name: String(name).trim(), group: group || 'upper', ...(sub ? { sub } : {}), kind: kind || 'strength', custom: true, notes: '', video: yt(`${String(name).trim()} proper form`.replace(/\s+/g, '+')) };
  if (base.kind === 'cardio') {
    const lo = Math.max(1, Math.round(minutes || 10));
    return { ...base, group: 'cardio', minutes: lo, maxMinutes: Math.max(lo, Math.round(maxMinutes || lo * 2)), activity: 'other' };
  }
  const lo = Math.max(1, Math.round(repMin || 8));
  return { ...base, sets: Math.max(1, Math.round(sets || 3)), repMin: lo, repMax: Math.max(lo, Math.round(repMax || lo + 4)), ...(unit === 'sec' ? { unit: 'sec' } : {}) };
}
