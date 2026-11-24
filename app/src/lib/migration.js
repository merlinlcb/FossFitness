// Moving people from the old "Health Tracker" app (id com.merlinlcb.healthtracker) to FossFitness.
// The two apps have different ids and signing keys, so Android can't update one into the other.
// Instead the last Health Tracker build (this code, built under the old id) shows a "Move to
// FossFitness" card: it syncs, installs FossFitness, then opens it with a one-time code from the
// server (POST /api/handoff), which FossFitness trades for its own sign-in and restores everything.
import Constants from 'expo-constants';
import { normalizeServer } from './api';

export const LEGACY_ID = 'com.merlinlcb.healthtracker';
export const FOSSFITNESS_ID = 'io.github.merlinlcb.fossfitness';
// SHA-256 of the FossFitness release signing certificate (GitHub releases). The old app only hands
// a sign-in to an app signed with this, so a look-alike app with the same id can't receive it.
export const FOSSFITNESS_CERTS = ['80a4bdf8a7b0b277bb56c0f5ecacb7a4905c0251a1c432149e05a3085d39ada1'];
export const FOSSFITNESS_DOWNLOAD = 'https://github.com/merlinlcb/FossFitness/releases/latest/download/FossFitness.apk';

export const APP_ID = Constants.expoConfig?.android?.package || FOSSFITNESS_ID;
export const IS_LEGACY = APP_ID === LEGACY_ID;
// Update channel on the sync server: old builds get Health Tracker builds (the move build),
// everything else gets FossFitness releases.
export const UPDATE_CHANNEL = IS_LEGACY ? 'healthtracker' : 'fossfitness';

export function trustedPeer(peer) {
  return !!(peer && peer.installed && (peer.certs || []).some((c) => FOSSFITNESS_CERTS.includes(String(c).toLowerCase())));
}

export function buildMoveUrl(server, code) {
  return `fossfitness://move?server=${encodeURIComponent(normalizeServer(server))}&code=${encodeURIComponent(code)}`;
}

// { server, code } from a fossfitness://move link, or null if it isn't one (or looks wrong).
export function parseMoveUrl(url) {
  const m = /^fossfitness:\/\/move\?(.*)$/i.exec(String(url || ''));
  if (!m) return null;
  const q = {};
  for (const part of m[1].split('&')) {
    const i = part.indexOf('=');
    if (i > 0) {
      try {
        q[part.slice(0, i)] = decodeURIComponent(part.slice(i + 1));
      } catch {
        return null;
      }
    }
  }
  const server = normalizeServer(q.server || '');
  if (!/^https?:\/\/[^\s/]+/i.test(server) || !/^[A-Za-z0-9_-]{16,64}$/.test(q.code || '')) return null;
  return { server, code: q.code };
}

function native() {
  return require('expo-modules-core').requireNativeModule('AppHandoff');
}

export function fossFitnessPeer() {
  try {
    return native().peer(FOSSFITNESS_ID);
  } catch {
    return { installed: false, certs: [] };
  }
}

export function openFossFitness(url) {
  return native().open(FOSSFITNESS_ID, url);
}

export function openOwnAppDetails() {
  return native().openAppDetails();
}
