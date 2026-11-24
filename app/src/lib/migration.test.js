/* global jest */
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { android: { package: 'io.github.merlinlcb.fossfitness' } } } }));
import { buildMoveUrl, parseMoveUrl, trustedPeer, IS_LEGACY, UPDATE_CHANNEL, FOSSFITNESS_CERTS } from './migration';

test('a move link survives the round trip', () => {
  const url = buildMoveUrl('health.example.com/', 'AbC-123_xyzAbC-123_xyz');
  expect(url).toBe('fossfitness://move?server=https%3A%2F%2Fhealth.example.com&code=AbC-123_xyzAbC-123_xyz');
  expect(parseMoveUrl(url)).toEqual({ server: 'https://health.example.com', code: 'AbC-123_xyzAbC-123_xyz' });
});

test('anything else is not a move link', () => {
  expect(parseMoveUrl(null)).toBe(null);
  expect(parseMoveUrl('https://evil.example/move?code=aaaaaaaaaaaaaaaaaaaa')).toBe(null);
  expect(parseMoveUrl('fossfitness://move?server=https%3A%2F%2Fx.org&code=short')).toBe(null);
  expect(parseMoveUrl('fossfitness://move?server=&code=aaaaaaaaaaaaaaaaaaaa')).toBe(null);
  expect(parseMoveUrl('fossfitness://move?server=https%3A%2F%2Fx.org&code=has%20space%20inside%20it!!')).toBe(null);
  expect(parseMoveUrl('fossfitness://move?server=%E0%A4%A&code=aaaaaaaaaaaaaaaaaaaa')).toBe(null);
});

test('only the real FossFitness (by signing certificate) gets the sign-in', () => {
  expect(trustedPeer({ installed: true, certs: [FOSSFITNESS_CERTS[0].toUpperCase()] })).toBe(true);
  expect(trustedPeer({ installed: true, certs: ['00'.repeat(32)] })).toBe(false);
  expect(trustedPeer({ installed: false, certs: [] })).toBe(false);
  expect(trustedPeer(null)).toBe(false);
});

test('FossFitness builds use the FossFitness update channel', () => {
  expect(IS_LEGACY).toBe(false);
  expect(UPDATE_CHANNEL).toBe('fossfitness');
});
