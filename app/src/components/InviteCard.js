// Settings (under the menu): make a one-time invite code for someone new, share it, and see
// which codes are open or were used. Codes work once, for 7 days, both to download the
// app from <server>/get and to create an account.
import React, { useCallback, useEffect, useState } from 'react';
import { View, Share, Alert } from 'react-native';
import { useHub } from '../state/hub';
import { useTheme } from '../theme';
import { Card, Txt, Button } from './ui';
import { api } from '../lib/api';

const shortDate = (ms) => new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

export default function InviteCard() {
  const t = useTheme();
  const { auth } = useHub();
  const [invites, setInvites] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const call = useCallback(
    (path, method = 'GET', body) => api(auth.server, path, { method, token: auth.token, ...(body ? { body } : method === 'POST' ? { body: {} } : {}) }),
    [auth]
  );

  useEffect(() => {
    if (!auth) return;
    call('/api/invites')
      .then((r) => setInvites(r.invites))
      .catch((e) => setError(e.message));
  }, [auth, call]);

  if (!auth) return null;
  const share = (code) => {
    const server = auth.server.replace(/\/+$/, '');
    Share.share({
      message:
        `Join me on FossFitness!\n\n` +
        `1. Get the app: ${server}/get and enter the code ${code}\n` +
        `2. In the app: Settings → App settings → Cloud sync → Create account, server ${server.replace(/^https?:\/\//, '')}, invite code ${code}\n\n` +
        `The code works once and expires in 7 days.`,
    }).catch(() => {});
  };

  const create = async () => {
    setBusy(true);
    setError('');
    try {
      const r = await call('/api/invites', 'POST');
      setInvites(r.invites);
      share(r.code);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const cancel = (code) =>
    Alert.alert(`Cancel ${code}?`, 'Nobody will be able to use it.', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Cancel code',
        style: 'destructive',
        onPress: () =>
          call('/api/invites/cancel', 'POST', { code })
            .then((r) => setInvites(r.invites))
            .catch((e) => setError(e.message)),
      },
    ]);

  const open = (invites || []).filter((i) => !i.usedBy);
  const used = (invites || []).filter((i) => i.usedBy);

  return (
    <Card title="✉️ Invite someone">
      <Txt dim size={13} style={{ marginBottom: 10, lineHeight: 19 }}>
        Make a one-time code for a friend. It lets them download the app and create an account, works once, and expires after 7 days.
      </Txt>
      <Button title={busy ? 'Making a code…' : 'Create an invite code'} disabled={busy} onPress={create} />
      {error ? <Txt color={t.danger} size={13} style={{ marginTop: 8 }}>{error}</Txt> : null}
      {open.map((i) => (
        <View key={i.code} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: t.border }}>
          <View style={{ flex: 1 }}>
            <Txt size={18} weight="800" style={{ letterSpacing: 1.5, fontVariant: ['tabular-nums'] }} selectable>{i.code}</Txt>
            <Txt faint size={12}>Unused · expires {shortDate(i.expires)}</Txt>
          </View>
          <Button small variant="secondary" title="Share" onPress={() => share(i.code)} />
          <Button small variant="ghost" color={t.danger} title="✕" onPress={() => cancel(i.code)} />
        </View>
      ))}
      {used.length > 0 && (
        <Txt faint size={12} style={{ marginTop: 10 }}>
          Used: {used.map((i) => `${i.code} by ${i.usedBy} (${shortDate(i.usedAt)})`).join(' · ')}
        </Txt>
      )}
    </Card>
  );
}
