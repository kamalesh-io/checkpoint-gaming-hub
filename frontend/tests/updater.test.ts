import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSemver, compareSemver } from '../src/utils/semver.ts';

test('Tauri Updater: parseSemver parses standard and prefixed versions', () => {
  const p1 = parseSemver('1.1.0');
  assert.equal(p1.major, 1);
  assert.equal(p1.minor, 1);
  assert.equal(p1.patch, 0);
  assert.equal(p1.prerelease, undefined);

  const p2 = parseSemver('v2.0.4-beta.1');
  assert.equal(p2.major, 2);
  assert.equal(p2.minor, 0);
  assert.equal(p2.patch, 4);
  assert.equal(p2.prerelease, 'beta.1');
});

test('Tauri Updater: compareSemver accurately determines version precedence', () => {
  // Newer patch
  assert.equal(compareSemver('1.1.1', '1.1.0'), 1);
  // Equal
  assert.equal(compareSemver('1.1.0', 'v1.1.0'), 0);
  // Older
  assert.equal(compareSemver('1.0.1', '1.1.0'), -1);
  // Major bump
  assert.equal(compareSemver('2.0.0', '1.9.9'), 1);
  // Minor bump
  assert.equal(compareSemver('1.2.0', '1.1.9'), 1);
  // Older minor
  assert.equal(compareSemver('1.0.9', '1.1.0'), -1);
});

test('Tauri Updater: official endpoint URL points to verified release repository', async () => {
  const tauriConf = await import('../../src-tauri/tauri.conf.json', { with: { type: 'json' } });
  const endpoints = tauriConf.default.plugins?.updater?.endpoints;
  assert.ok(Array.isArray(endpoints));
  assert.ok(endpoints.length > 0);
  assert.equal(
    endpoints[0],
    'https://github.com/kamalesh-io/checkpoint-gaming-hub/releases/latest/download/latest.json'
  );
  // Verify public key is set
  const pubkey = tauriConf.default.plugins?.updater?.pubkey;
  assert.ok(typeof pubkey === 'string' && pubkey.length > 50);
});

test('Tauri Updater: bundle creates updater artifacts', async () => {
  const tauriConf = await import('../../src-tauri/tauri.conf.json', { with: { type: 'json' } });
  assert.equal(tauriConf.default.bundle?.createUpdaterArtifacts, true);
});
