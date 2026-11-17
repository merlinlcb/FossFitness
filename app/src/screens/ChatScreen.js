import React, { useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useHub } from '../state/hub';
import { useTheme } from '../theme';
import { Txt, Button } from '../components/ui';
import { dayKey, formatDayLabel, formatClock } from '../lib/dates';

export default function ChatScreen({ openSettings }) {
  const t = useTheme();
  const { auth, messages, chatError, postChat } = useHub();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const scroll = useRef(null);

  if (!auth) {
    return (
      <View style={[s.empty, { backgroundColor: t.bg }]}>
        <Txt size={21} weight="800" style={{ marginBottom: 8 }}>Chat</Txt>
        <Txt dim center style={{ marginBottom: 16, lineHeight: 21 }}>
          Sign in to chat with each other. Level-ups and new badges show up here too.
        </Txt>
        <Button title="Set up account" onPress={openSettings} />
      </View>
    );
  }

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    const ok = await postChat(body, 'msg');
    setSending(false);
    if (ok) setText('');
  };

  let lastDay = null;
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        ref={scroll}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 12, paddingBottom: 16 }}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => scroll.current && scroll.current.scrollToEnd({ animated: false })}
      >
        {!messages.length ? <Txt faint center style={{ marginTop: 40 }}>No messages yet. Say hi.</Txt> : null}
        {messages.map((m) => {
          const k = dayKey(m.ts);
          const showDay = k !== lastDay;
          lastDay = k;
          return (
            <View key={m.id}>
              {showDay ? <Txt faint size={12} center style={{ marginVertical: 10 }}>{formatDayLabel(k)}</Txt> : null}
              {m.kind === 'event' ? (
                <Text style={[s.event, { color: t.textDim, backgroundColor: t.cardAlt }]}>
                  {m.body} · {formatClock(m.ts)}
                </Text>
              ) : (
                <View style={[s.row, { justifyContent: m.mine ? 'flex-end' : 'flex-start' }]}>
                  <View
                    style={[
                      s.bubble,
                      m.mine
                        ? { backgroundColor: t.primary, borderBottomRightRadius: 4 }
                        : { backgroundColor: t.card, borderColor: t.border, borderWidth: 1, borderBottomLeftRadius: 4 },
                    ]}
                  >
                    {!m.mine ? <Text style={{ color: t.primary, fontSize: 12, fontWeight: '800', marginBottom: 2 }}>{m.name}</Text> : null}
                    <Text style={{ color: m.mine ? t.primaryText : t.text, fontSize: 15, lineHeight: 20 }}>{m.body}</Text>
                    <Text style={{ color: m.mine ? t.primaryText : t.textFaint, opacity: m.mine ? 0.7 : 1, fontSize: 10, marginTop: 3, textAlign: 'right' }}>
                      {formatClock(m.ts)}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
      {chatError ? <Txt faint size={12} center style={{ paddingVertical: 4 }}>{chatError}</Txt> : null}
      <View style={[s.inputRow, { backgroundColor: t.tabBar, borderTopColor: t.border }]}>
        <TextInput
          style={[s.input, { backgroundColor: t.cardAlt, borderColor: t.border, color: t.text }]}
          placeholder="Message"
          placeholderTextColor={t.textFaint}
          value={text}
          onChangeText={setText}
          multiline
          maxLength={2000}
        />
        <Pressable
          onPress={send}
          disabled={!text.trim() || sending}
          style={[s.send, { backgroundColor: text.trim() && !sending ? t.primary : t.cardAlt }]}
        >
          <Text style={{ color: text.trim() && !sending ? t.primaryText : t.textFaint, fontWeight: '800' }}>{sending ? '…' : 'Send'}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  event: { alignSelf: 'center', fontSize: 12, paddingVertical: 5, paddingHorizontal: 12, borderRadius: 12, overflow: 'hidden', marginVertical: 4, textAlign: 'center' },
  row: { flexDirection: 'row', marginVertical: 3 },
  bubble: { maxWidth: '82%', borderRadius: 16, paddingVertical: 8, paddingHorizontal: 12 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 8, borderTopWidth: StyleSheet.hairlineWidth },
  input: { flex: 1, borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, fontSize: 15, maxHeight: 110 },
  send: { borderRadius: 20, paddingVertical: 11, paddingHorizontal: 18 },
});
