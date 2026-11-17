import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, areaColor, AREA_ICONS } from '../theme';
import { formatTime12 } from '../lib/dates';

export function Card({ title, right, children, style, onPress }) {
  const t = useTheme();
  const Wrapper = onPress ? Pressable : View;
  return (
    <Wrapper onPress={onPress} style={[styles.card, { backgroundColor: t.card, borderColor: t.border }, style]}>
      {(title || right) && (
        <View style={styles.cardHeader}>
          {title ? <Text style={[styles.cardTitle, { color: t.text }]}>{title}</Text> : <View />}
          {right}
        </View>
      )}
      {children}
    </Wrapper>
  );
}

export function SectionTitle({ children, right }) {
  const t = useTheme();
  return (
    <View style={styles.sectionRow}>
      <Text style={[styles.sectionTitle, { color: t.textDim }]}>{children}</Text>
      {right}
    </View>
  );
}

export function Txt({ children, dim, faint, size = 15, weight, color, style, center, numberOfLines, selectable }) {
  const t = useTheme();
  return (
    <Text
      numberOfLines={numberOfLines}
      selectable={selectable}
      style={[
        { color: color || (faint ? t.textFaint : dim ? t.textDim : t.text), fontSize: size, fontWeight: weight },
        center && { textAlign: 'center' },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export function Button({ title, onPress, variant = 'primary', small, color, disabled, style, icon }) {
  const t = useTheme();
  const bg =
    variant === 'primary' ? color || t.primary : variant === 'danger' ? t.danger : variant === 'secondary' ? t.cardAlt : 'transparent';
  const fg = variant === 'primary' || variant === 'danger' ? t.primaryText : color || t.primary;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        { backgroundColor: bg, opacity: disabled ? 0.45 : pressed ? 0.8 : 1 },
        variant === 'outline' && { borderWidth: 1.5, borderColor: color || t.primary },
        style,
      ]}
    >
      <Text style={[styles.buttonText, small && { fontSize: 14 }, { color: fg }]}>
        {icon ? `${icon} ` : ''}
        {title}
      </Text>
    </Pressable>
  );
}

export function Chip({ label, selected, onPress, color, style }) {
  const t = useTheme();
  const c = color || t.primary;
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        { borderColor: selected ? c : t.border, backgroundColor: selected ? c + '22' : t.card },
        style,
      ]}
    >
      <Text style={{ color: selected ? c : t.text, fontWeight: selected ? '700' : '500', fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}

export function ChipRow({ options, value, onChange, color, scroll }) {
  const content = options.map((o) => (
    <Chip key={String(o.key)} label={o.label} selected={value === o.key} onPress={() => onChange(o.key)} color={color} />
  ));
  if (scroll) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {content}
      </ScrollView>
    );
  }
  return <View style={[styles.chipRow, { flexWrap: 'wrap' }]}>{content}</View>;
}

export function ProgressBar({ value, max, color, height = 10, style }) {
  const t = useTheme();
  const pct = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const over = max > 0 && value > max;
  return (
    <View style={[{ height, backgroundColor: t.track, borderRadius: height / 2, overflow: 'hidden' }, style]}>
      <View style={{ width: `${pct * 100}%`, height: '100%', backgroundColor: over ? t.warn : color || t.primary, borderRadius: height / 2 }} />
    </View>
  );
}

export function Ring({ value, max, size = 120, stroke = 12, color, children }) {
  const t = useTheme();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={t.track} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color || t.primary}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={c * (1 - pct)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {children}
    </View>
  );
}

// − value + control. Tap the value (or ⌨) to type a number instead of pressing + over and over.
export function Stepper({ value, onChange, step = 1, min = 0, max = 99999, format, bigStep }) {
  const t = useTheme();
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState('');
  const decimals = step % 1 !== 0;
  const set = (v) => onChange(Math.min(max, Math.max(min, Math.round(v * 1000) / 1000)));
  const startTyping = () => {
    setText(value ? String(value) : '');
    setTyping(true);
  };
  const commit = () => {
    const n = parseFloat(text.replace(',', '.'));
    if (!Number.isNaN(n)) set(decimals ? n : Math.round(n));
    setTyping(false);
  };
  const Btn = ({ label, delta }) => (
    <Pressable
      onPress={() => set(value + delta)}
      style={({ pressed }) => [styles.stepBtn, { backgroundColor: t.cardAlt, opacity: pressed ? 0.7 : 1 }]}
    >
      <Text style={{ color: t.primary, fontSize: 18, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
  if (typing) {
    return (
      <View style={styles.stepper}>
        <View style={[styles.inputWrap, { borderColor: t.primary, backgroundColor: t.cardAlt, width: 130, flex: 0 }]}>
          <TextInput
            value={text}
            autoFocus
            selectTextOnFocus
            onChangeText={(s2) => setText(s2.replace(decimals ? /[^0-9.,]/g : /[^0-9]/g, ''))}
            onSubmitEditing={commit}
            onBlur={commit}
            keyboardType={decimals ? 'decimal-pad' : 'number-pad'}
            returnKeyType="done"
            style={[styles.input, { color: t.text, textAlign: 'center' }]}
            accessibilityLabel="Type a number"
          />
        </View>
        <Pressable onPress={commit} style={({ pressed }) => [styles.stepBtn, { backgroundColor: t.primary, opacity: pressed ? 0.7 : 1, width: 56 }]}>
          <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>OK</Text>
        </Pressable>
      </View>
    );
  }
  return (
    <View style={styles.stepper}>
      {bigStep ? <Btn label={`−${bigStep}`} delta={-bigStep} /> : null}
      <Btn label="−" delta={-step} />
      <Pressable onPress={startTyping} hitSlop={6} accessibilityRole="button" accessibilityLabel="Tap to type a number">
        <Text style={[styles.stepValue, { color: t.text, textDecorationLine: 'underline', textDecorationStyle: 'dotted', textDecorationColor: t.textFaint }]}>
          {format ? format(value) : value}
        </Text>
      </Pressable>
      <Btn label="+" delta={step} />
      {bigStep ? <Btn label={`+${bigStep}`} delta={bigStep} /> : null}
      <Pressable onPress={startTyping} hitSlop={6} style={({ pressed }) => [styles.stepBtn, { backgroundColor: t.cardAlt, opacity: pressed ? 0.7 : 1 }]} accessibilityLabel="Type a number">
        <Text style={{ fontSize: 16 }}>⌨️</Text>
      </Pressable>
    </View>
  );
}

// Numeric text input that keeps its own text while editing (so "1." or "" is allowed),
// and only resyncs when the parent changes the value to something we didn't emit.
export function NumberField({ label, value, onChange, suffix, placeholder, style, autoFocus, decimals = true, width }) {
  const t = useTheme();
  const [text, setText] = useState(value == null || Number.isNaN(value) ? '' : String(value));
  const lastEmitted = useRef(value);
  useEffect(() => {
    if (value !== lastEmitted.current) {
      lastEmitted.current = value;
      setText(value == null || Number.isNaN(value) ? '' : String(value));
    }
  }, [value]);
  return (
    <View style={[styles.fieldRow, style]}>
      {label ? <Text style={[styles.fieldLabel, { color: t.textDim }]}>{label}</Text> : null}
      <View style={[styles.inputWrap, { borderColor: t.border, backgroundColor: t.cardAlt }, width && { width, flex: 0 }]}>
        <TextInput
          value={text}
          autoFocus={autoFocus}
          onChangeText={(s) => {
            const clean = s.replace(',', '.').replace(decimals ? /[^0-9.]/g : /[^0-9]/g, '');
            setText(clean);
            const n = parseFloat(clean);
            const next = Number.isNaN(n) ? null : n;
            lastEmitted.current = next;
            onChange(next);
          }}
          keyboardType={decimals ? 'decimal-pad' : 'number-pad'}
          placeholder={placeholder}
          placeholderTextColor={t.textFaint}
          style={[styles.input, { color: t.text }]}
        />
        {suffix ? <Text style={{ color: t.textDim, marginLeft: 6 }}>{suffix}</Text> : null}
      </View>
    </View>
  );
}

export function TextField({ label, value, onChangeText, placeholder, style, autoFocus }) {
  const t = useTheme();
  return (
    <View style={[styles.fieldRow, style]}>
      {label ? <Text style={[styles.fieldLabel, { color: t.textDim }]}>{label}</Text> : null}
      <View style={[styles.inputWrap, { borderColor: t.border, backgroundColor: t.cardAlt }]}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          autoFocus={autoFocus}
          placeholderTextColor={t.textFaint}
          style={[styles.input, { color: t.text }]}
        />
      </View>
    </View>
  );
}

export function Row({ label, value, onPress, right, sub }) {
  const t = useTheme();
  const Wrapper = onPress ? Pressable : View;
  return (
    <Wrapper onPress={onPress} style={[styles.row, { borderBottomColor: t.border }]}>
      <View style={{ flex: 1, paddingRight: 8 }}>
        <Text style={{ color: t.text, fontSize: 15 }}>{label}</Text>
        {sub ? <Text style={{ color: t.textFaint, fontSize: 12, marginTop: 2 }}>{sub}</Text> : null}
      </View>
      {right || (value != null ? <Text style={{ color: onPress ? t.primary : t.textDim, fontSize: 15, fontWeight: '600' }}>{value}</Text> : null)}
    </Wrapper>
  );
}

export function Sheet({ visible, onClose, title, children, footer }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: t.overlay }]} onPress={onClose} />
        <View style={{ flex: 1 }} pointerEvents="box-none" />
        <View style={[styles.sheet, { backgroundColor: t.card, paddingBottom: Math.max(insets.bottom, 12) }]}>
          <View style={styles.sheetHeader}>
            <Text style={[styles.sheetTitle, { color: t.text }]}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Text style={{ color: t.textDim, fontSize: 22 }}>✕</Text>
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" style={{ flexGrow: 0 }} contentContainerStyle={{ paddingBottom: 8 }}>
            {children}
          </ScrollView>
          {footer ? <View style={{ paddingTop: 8 }}>{footer}</View> : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 15, 30, 45];

export function TimePickerSheet({ visible, value, onChange, onClose, title = 'Pick a time' }) {
  const t = useTheme();
  const [h, m] = (value || '12:00').split(':').map(Number);
  const set = (hh, mm) => onChange(`${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`);
  return (
    <Sheet visible={visible} onClose={onClose} title={title} footer={<Button title={`Done · ${formatTime12(value)}`} onPress={onClose} />}>
      <Txt dim size={13} style={{ marginBottom: 8 }}>
        Hour
      </Txt>
      <View style={[styles.chipRow, { flexWrap: 'wrap' }]}>
        {HOURS.map((hh) => (
          <Chip
            key={hh}
            label={`${hh % 12 === 0 ? 12 : hh % 12}${hh < 12 ? 'a' : 'p'}`}
            selected={hh === h}
            onPress={() => set(hh, m)}
            style={{ minWidth: 52, alignItems: 'center' }}
          />
        ))}
      </View>
      <Txt dim size={13} style={{ marginVertical: 8 }}>
        Minute
      </Txt>
      <View style={styles.chipRow}>
        {MINUTES.map((mm) => (
          <Chip key={mm} label={`:${String(mm).padStart(2, '0')}`} selected={mm === m} onPress={() => set(h, mm)} style={{ minWidth: 60, alignItems: 'center' }} />
        ))}
      </View>
      <View style={{ height: 4, backgroundColor: t.card }} />
    </Sheet>
  );
}

export function TimeRow({ label, value, onChange, sub }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Row label={label} sub={sub} value={formatTime12(value)} onPress={() => setOpen(true)} />
      <TimePickerSheet visible={open} value={value} onChange={onChange} onClose={() => setOpen(false)} title={label} />
    </>
  );
}

export function SuggestionCard({ item }) {
  const t = useTheme();
  const accent = item.level === 'warn' ? t.warn : item.level === 'good' ? t.good : areaColor(t, item.area);
  return (
    <View style={[styles.suggestion, { backgroundColor: t.card, borderColor: t.border, borderLeftColor: accent }]}>
      <Text style={{ fontSize: 20, marginRight: 10 }}>{item.level === 'good' ? '✅' : item.level === 'warn' ? '⚠️' : AREA_ICONS[item.area]}</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ color: t.text, fontWeight: '700', fontSize: 15 }}>{item.title}</Text>
        <Text style={{ color: t.textDim, fontSize: 14, marginTop: 3, lineHeight: 20 }}>{item.body}</Text>
      </View>
    </View>
  );
}

// Simple vertical bar chart built from Views (no native chart dependency).
export function BarChart({ data, color, goal, height = 120, formatValue }) {
  const t = useTheme();
  const maxVal = Math.max(goal || 0, ...data.map((d) => d.value), 1);
  return (
    <View>
      <View style={{ height, flexDirection: 'row', alignItems: 'flex-end' }}>
        {goal ? (
          <View
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: (goal / maxVal) * height,
              borderTopWidth: 1,
              borderStyle: 'dashed',
              borderColor: t.textFaint,
            }}
          />
        ) : null}
        {data.map((d, i) => (
          <View key={i} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height }}>
            {d.value > 0 && formatValue ? (
              <Text style={{ color: t.textFaint, fontSize: 9, marginBottom: 2 }} numberOfLines={1}>
                {formatValue(d.value)}
              </Text>
            ) : null}
            <View
              style={{
                width: '58%',
                height: Math.max(d.value > 0 ? 3 : 0, (d.value / maxVal) * (height - 14)),
                backgroundColor: goal && d.value >= goal ? t.good : color || t.primary,
                borderRadius: 4,
                opacity: d.highlight ? 1 : 0.8,
              }}
            />
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', marginTop: 6 }}>
        {data.map((d, i) => (
          <Text key={i} style={{ flex: 1, textAlign: 'center', color: d.highlight ? t.text : t.textFaint, fontSize: 11, fontWeight: d.highlight ? '700' : '400' }}>
            {d.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

export function Empty({ children }) {
  const t = useTheme();
  return <Text style={{ color: t.textFaint, textAlign: 'center', paddingVertical: 14, fontSize: 14 }}>{children}</Text>;
}

export function Segmented({ options, value, onChange }) {
  const t = useTheme();
  return (
    <View style={[styles.segmented, { backgroundColor: t.cardAlt }]}>
      {options.map((o) => {
        const sel = o.key === value;
        return (
          <Pressable key={String(o.key)} onPress={() => onChange(o.key)} style={[styles.segment, sel && { backgroundColor: t.card, elevation: 1 }]}>
            <Text style={{ color: sel ? t.text : t.textDim, fontWeight: sel ? '700' : '500', fontSize: 14 }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export const styles = StyleSheet.create({
  card: { borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: StyleSheet.hairlineWidth },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  cardTitle: { fontSize: 17, fontWeight: '700' },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, marginBottom: 8, paddingHorizontal: 4 },
  sectionTitle: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  button: { paddingVertical: 13, paddingHorizontal: 18, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  buttonSmall: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10 },
  buttonText: { fontSize: 16, fontWeight: '700' },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1.5 },
  chipRow: { flexDirection: 'row', gap: 8 },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 8 },
  stepBtn: { minWidth: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  stepValue: { fontSize: 20, fontWeight: '700', minWidth: 70, textAlign: 'center' },
  fieldRow: { marginBottom: 12 },
  fieldLabel: { fontSize: 13, marginBottom: 6, fontWeight: '600' },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, flex: 1 },
  input: { flex: 1, fontSize: 16, paddingVertical: 10 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth },
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 18, paddingTop: 14, maxHeight: '90%' },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sheetTitle: { fontSize: 20, fontWeight: '800' },
  suggestion: { flexDirection: 'row', padding: 14, borderRadius: 14, marginBottom: 10, borderWidth: StyleSheet.hairlineWidth, borderLeftWidth: 4 },
  segmented: { flexDirection: 'row', borderRadius: 12, padding: 3 },
  segment: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10 },
});

export function Screen({ children }) {
  const t = useTheme();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.bg }}
      contentContainerStyle={{ padding: 16, paddingTop: 4, paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

// Re-render every `ms` milliseconds (for live timers / "now"-based UI).
export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}
