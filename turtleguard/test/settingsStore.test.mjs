import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { SettingsStore } from '../electron/settingsStore.js';

async function withStore(fn) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'turtleguard-settings-'));
  try {
    await fn(new SettingsStore(dir));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test('settings default to default posture standard', async () => {
  await withStore(async (store) => {
    const settings = await store.get();
    assert.equal(settings.posture_standard, 'default');
    assert.equal(settings.last_selected_group_id, null);
    assert.equal(settings.sync_enabled, true);
  });
});

test('settings persist posture standard changes', async () => {
  await withStore(async (store) => {
    await store.update({ posture_standard: 'relaxed' });
    const settings = await store.get();
    assert.equal(settings.posture_standard, 'relaxed');
  });
});

test('invalid settings fall back safely', async () => {
  await withStore(async (store) => {
    await store.update({ posture_standard: 'invalid-value', sync_enabled: 'yes' });
    const settings = await store.get();
    assert.equal(settings.posture_standard, 'default');
    assert.equal(settings.sync_enabled, true);
  });
});
