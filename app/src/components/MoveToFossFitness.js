// Shown only in the old "Health Tracker" app (built under its old id): moves the person to FossFitness.
// See lib/migration.js for how the move works and why.
import React, { useCallback, useEffect, useState } from 'react';
import { View, Alert, AppState, Linking } from 'react-native';
import { useStore } from '../state/store';
import { useHub } from '../state/hub';
import { useTheme } from '../theme';
import { Card, Txt, Button } from './ui';
import { exportBackup } from '../lib/backup';
import { IS_LEGACY, FOSSFITNESS_DOWNLOAD, buildMoveUrl, fossFitnessPeer, openFossFitness, openOwnAppDetails, trustedPeer } from '../lib/migration';

export default function MoveToFossFitnessCard() {
  if (!IS_LEGACY) return null;
  return <MoveCard />;
}

function MoveCard() {
  const t = useTheme();
  const { state } = useStore();
  const { auth, syncNow, pending, downloadFossFitness, startMove } = useHub();
  const [peer, setPeer] = useState(() => fossFitnessPeer());
  const [busy, setBusy] = useState(false);
  const [opened, setOpened] = useState(false);

  // Check again whenever the person comes back from installing it.
  const refresh = useCallback(() => setPeer(fossFitnessPeer()), []);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => s === 'active' && refresh());
    return () => sub.remove();
  }, [refresh]);

  const installed = peer && peer.installed;
  const trusted = trustedPeer(peer);

  const move = async () => {
    setBusy(true);
    try {
      // Everything has to be on the server before FossFitness pulls it down.
      let ok = await syncNow();
      if (ok === undefined) {
        await new Promise((r) => setTimeout(r, 3000)); // a sync was already running
        ok = await syncNow();
      }
      if (ok === false) throw new Error("Couldn't upload your latest changes to the server");
      const handoff = await startMove();
      openFossFitness(buildMoveUrl(handoff.server, handoff.code));
      setOpened(true);
    } catch (e) {
      Alert.alert("Couldn't start the move", `${(e && e.message) || e}\n\nCheck you're online and try again.`);
    } finally {
      setBusy(false);
    }
  };

  const uninstall = () =>
    Alert.alert(
      'Remove Health Tracker (old)?',
      auth
        ? 'Only do this once FossFitness shows your history. On the next screen, tap Uninstall.'
        : 'Only do this once you have restored your backup in FossFitness and it shows your history. On the next screen, tap Uninstall.',
      [
        { text: 'Not yet', style: 'cancel' },
        { text: 'Continue', onPress: () => openOwnAppDetails() },
      ]
    );

  const step = (n, done, title, body, action) => (
    <View style={{ flexDirection: 'row', paddingVertical: 8 }}>
      <Txt size={18} style={{ width: 30 }}>{done ? '✅' : `${n}.`}</Txt>
      <View style={{ flex: 1 }}>
        <Txt weight="700">{title}</Txt>
        {body ? <Txt dim size={13} style={{ lineHeight: 19, marginTop: 2 }}>{body}</Txt> : null}
        {action ? <View style={{ marginTop: 8, alignItems: 'flex-start' }}>{action}</View> : null}
      </View>
    </View>
  );

  const installStep = step(
    auth ? 1 : 2,
    trusted,
    trusted ? 'FossFitness is installed' : 'Install FossFitness',
    trusted
      ? null
      : installed
        ? "An app called FossFitness is installed, but it isn't the real one. Uninstall it, then download it here."
        : 'Open the download and tap Install. If Android asks, allow installing from this source.',
    trusted ? null : <Button small title="Download FossFitness" onPress={() => (auth ? downloadFossFitness() : Linking.openURL(FOSSFITNESS_DOWNLOAD))} />
  );

  return (
    <Card style={{ borderWidth: 2, borderColor: t.primary }}>
      <Txt size={18} weight="800">📦 Move to FossFitness</Txt>
      <Txt dim size={14} style={{ lineHeight: 20, marginTop: 6, marginBottom: 6 }}>
        Health Tracker is now called FossFitness, and new features and fixes only go there. This old app stops getting updates.
        {auth ? ' Moving takes about a minute and keeps everything: history, foods, meals, medals and your group.' : ''}
      </Txt>
      {auth ? (
        <>
          {installStep}
          {step(
            2,
            opened,
            'Move your account',
            opened
              ? 'In FossFitness, tap Move. Your history comes in over the next minute. Nothing has to be typed in.'
              : pending
                ? `First this sends what's still waiting to upload (${pending}), then opens FossFitness. In FossFitness, tap Move.`
                : 'Opens FossFitness signed in as you. In FossFitness, tap Move.',
            <Button small title={busy ? 'Getting ready…' : opened ? 'Open FossFitness again' : 'Open FossFitness'} disabled={!trusted || busy} onPress={move} />
          )}
        </>
      ) : (
        <>
          {step(
            1,
            false,
            'Save a backup file',
            'Your data is only on this phone. Save it to a file first.',
            <Button small variant="secondary" title="⬇ Save backup" onPress={() => exportBackup(state).catch((e) => Alert.alert('Export failed', String(e.message || e)))} />
          )}
          {installStep}
          {step(3, false, 'Restore it in FossFitness', 'In FossFitness, finish the welcome steps, then Settings → App settings → Your data → ⬆ Restore from backup, and pick the file.')}
        </>
      )}
      {step(auth ? 3 : 4, false, 'Remove this old app', 'Once FossFitness shows your history.', <Button small variant="ghost" title="Uninstall Health Tracker (old)…" onPress={uninstall} />)}
    </Card>
  );
}
