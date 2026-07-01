import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { SessionStore } from '../electron/sessionStore.js';

test('saveDraft persists a draft and recoverOpen returns open sessions', async () => {
  const userDataPath = await mkdtemp(path.join(os.tmpdir(), 'turtleguard-session-store-'));

  try {
    const store = new SessionStore(userDataPath);
    const session = {
      id: 'session-1',
      started_at: '2026-07-01T10:00:00.000Z',
      ended_at: null,
      good_posture_seconds: 12,
      bad_posture_seconds: 3,
      away_seconds: 1,
      warning_count: 2,
      ended_reason: null,
      created_at: '2026-07-01T10:00:00.000Z',
      updated_at: '2026-07-01T10:05:00.000Z',
    };

    const saved = await store.saveDraft(session);
    const openSessions = await store.recoverOpen();
    const listed = await store.list();

    assert.equal(saved.sync_status, 'local_only');
    assert.deepEqual(openSessions, [saved]);
    assert.deepEqual(listed, [saved]);
  } finally {
    await rm(userDataPath, { recursive: true, force: true });
  }
});

test('finish marks a session ended, removes it from recoverOpen, and keeps it in list', async () => {
  const userDataPath = await mkdtemp(path.join(os.tmpdir(), 'turtleguard-session-store-'));

  try {
    const store = new SessionStore(userDataPath);
    await store.saveDraft({
      id: 'session-2',
      started_at: '2026-07-01T11:00:00.000Z',
      ended_at: null,
      good_posture_seconds: 20,
      bad_posture_seconds: 4,
      away_seconds: 0,
      warning_count: 1,
      ended_reason: null,
      created_at: '2026-07-01T11:00:00.000Z',
      updated_at: '2026-07-01T11:10:00.000Z',
      sync_status: 'pending_sync',
    });

    const finished = await store.finish({
      id: 'session-2',
      ended_at: '2026-07-01T11:15:00.000Z',
      ended_reason: 'manual_stop',
      updated_at: '2026-07-01T11:15:00.000Z',
    });

    const openSessions = await store.recoverOpen();
    const listed = await store.list();

    assert.equal(finished.ended_at, '2026-07-01T11:15:00.000Z');
    assert.equal(finished.ended_reason, 'manual_stop');
    assert.deepEqual(openSessions, []);
    assert.equal(listed.length, 1);
    assert.deepEqual(listed[0], finished);
  } finally {
    await rm(userDataPath, { recursive: true, force: true });
  }
});
