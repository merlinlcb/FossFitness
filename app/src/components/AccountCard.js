import React, { useState } from 'react';
import { View, Alert, Linking, TextInput } from 'react-native';
import { useHub, DEFAULT_SERVER } from '../state/hub';
import { useTheme } from '../theme';
import { Card, Txt, Button, TextField, Segmented } from './ui';
import { normalizeServer } from '../lib/api';

const when = (ms) => {
  if (!ms) return 'not yet';
  const m = Math.round((Date.now() - ms) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  return new Date(ms).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};

export default function AccountCard() {
  const t = useTheme();
  const { auth, meta, status, pending, update, signIn, signOut, syncNow, downloadUpdate } = useHub();
  const [mode, setMode] = useState('login');
  const [server, setServer] = useState(DEFAULT_SERVER);
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [invite, setInvite] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (busy) return;
    if (!normalizeServer(server) || !username.trim() || !password) {
      setError('Fill in the server, username and password.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await signIn({ mode, server, username: username.trim().toLowerCase(), password, invite: invite.trim(), displayName: displayName.trim() });
      setPassword('');
      setInvite('');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const confirmSignOut = () =>
    Alert.alert(
      'Sign out?',
      pending > 0
        ? `${pending} change${pending === 1 ? ' has' : 's have'} not been uploaded yet. Everything stays on this phone and uploads when you sign in again.`
        : 'Your data stays on this phone.',
      [{ text: 'Cancel', style: 'cancel' }, { text: 'Sign out', style: 'destructive', onPress: signOut }]
    );

  return (
    <Card>
      {auth ? (
        <>
          <Txt size={15}>
            Signed in as <Txt weight="800">{auth.user.displayName}</Txt>
          </Txt>
          <Txt faint size={13} style={{ marginTop: 2 }}>{auth.server.replace(/^https?:\/\//, '')}</Txt>
          <Txt dim size={13} style={{ marginTop: 6 }} color={status.error ? t.warn : undefined}>
            {status.busy ? 'Syncing…' : status.error ? `Sync problem: ${status.error}` : `Last synced ${when(meta.lastSyncAt)}`}
            {pending > 0 && !status.busy ? ` · ${pending} waiting to upload` : ''}
          </Txt>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <Button small style={{ flex: 1 }} title="Sync now" onPress={syncNow} />
            <Button small variant="secondary" style={{ flex: 1 }} title="Sign out" onPress={confirmSignOut} />
          </View>
          <Button small variant="ghost" title="Open the trends dashboard" style={{ marginTop: 6 }} onPress={() => Linking.openURL(auth.server)} />
        </>
      ) : (
        <>
          <Txt dim size={13} style={{ marginBottom: 12, lineHeight: 19 }}>
            Optional. Sign in to back up your history to your own server, race each other on weekly XP and chat.
          </Txt>
          <Segmented
            options={[{ key: 'login', label: 'Sign in' }, { key: 'register', label: 'Create account' }]}
            value={mode}
            onChange={(v) => {
              setMode(v);
              setError('');
            }}
          />
          <View style={{ height: 12 }} />
          <TextField label="Server" value={server} onChangeText={setServer} placeholder="https://health.example.com" />
          <TextField label="Username" value={username} onChangeText={setUsername} />
          {mode === 'register' ? <TextField label="Name others in your group see" value={displayName} onChangeText={setDisplayName} placeholder="e.g. Alex" /> : null}
          <PasswordField label={mode === 'register' ? 'Password (8+ characters)' : 'Password'} value={password} onChangeText={setPassword} />
          {mode === 'register' ? <TextField label="Invite code" value={invite} onChangeText={setInvite} /> : null}
          {error ? <Txt color={t.danger} size={13} style={{ marginBottom: 8 }}>{error}</Txt> : null}
          <Button title={busy ? 'Please wait…' : mode === 'register' ? 'Create account' : 'Sign in'} disabled={busy} onPress={submit} />
          <Txt faint size={12} style={{ marginTop: 10, lineHeight: 17 }}>
            Signing in uploads what this phone has logged to that server. What others in the group can see is listed
            above.
          </Txt>
        </>
      )}
      {update ? (
        <View style={{ marginTop: 14, padding: 12, borderRadius: 12, backgroundColor: t.cardAlt }}>
          <Txt weight="700">Update available: version {update.versionName}</Txt>
          <Button small title="Download and install" style={{ marginTop: 8 }} onPress={downloadUpdate} />
          <Txt faint size={12} style={{ marginTop: 6 }}>
            Opens the download in your browser; tap the finished download to install. Your data is kept.
          </Txt>
        </View>
      ) : null}
    </Card>
  );
}

// TextField has no secure mode, so this is a small local variant.
function PasswordField({ label, value, onChangeText }) {
  const t = useTheme();
  return (
    <View style={{ marginBottom: 12 }}>
      <Txt dim size={13} weight="600" style={{ marginBottom: 6 }}>{label}</Txt>
      <View style={{ borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, borderColor: t.border, backgroundColor: t.cardAlt }}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          style={{ color: t.text, fontSize: 16, paddingVertical: 10 }}
        />
      </View>
    </View>
  );
}
