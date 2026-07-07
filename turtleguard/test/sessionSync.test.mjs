import assert from 'node:assert/strict';
import test from 'node:test';

import { retryPendingSession, syncEndedSession } from '../src/services/sessionSync.ts';
import { socialClient } from '../src/services/socialClient.ts';

const baseSession = {
  id: 'session-1',
  started_at: '2026-07-01T10:00:00.000Z',
  ended_at: '2026-07-01T10:30:00.000Z',
  group_id: null,
  good_posture_seconds: 1200,
  bad_posture_seconds: 500,
  away_seconds: 100,
  warning_count: 3,
  ended_reason: 'user_stopped',
  ranking_mode: false,
  posture_standard: 'relaxed',
  created_at: '2026-07-01T10:00:00.000Z',
  updated_at: '2026-07-01T10:30:00.000Z',
  sync_status: 'local_only',
};

test('ended sessions remain local only when no profile is configured', async () => {
  delete globalThis.window;

  const synced = await syncEndedSession(baseSession, false, 'relaxed');

  assert.equal(synced.sync_status, 'local_only');
});

test('ended sessions become pending sync when upload fails', async () => {
  globalThis.window = {
    turtleSettings: {
      get: async () => ({
        posture_standard: 'default',
        last_selected_group_id: 'group-1',
        sync_enabled: true,
        profile_id: 'profile-1',
        nickname: 'Turtle',
        active_group_name: 'Study Crew',
        active_group_invite_code: 'ABCD1234',
      }),
    },
  };

  const synced = await syncEndedSession(
    { ...baseSession, group_id: 'group-1', ranking_mode: true, posture_standard: 'default' },
    true,
    'default',
  );

  assert.equal(synced.sync_status, 'pending_sync');
});

test('pending sessions can be retried and persisted as synced', async () => {
  const uploadedPayloads = [];
  const originalUploadSession = socialClient.uploadSession;
  socialClient.uploadSession = async (payload) => {
    uploadedPayloads.push(payload);
    return { ok: true };
  };

  globalThis.window = {
    turtleSettings: {
      get: async () => ({
        posture_standard: 'default',
        last_selected_group_id: 'group-1',
        sync_enabled: true,
        profile_id: 'profile-1',
        nickname: 'Turtle',
        active_group_name: 'Study Crew',
        active_group_invite_code: 'ABCD1234',
      }),
    },
    turtleSession: {
      finish: async (patch) => ({
        ...baseSession,
        ...patch,
        sync_status: patch.sync_status,
      }),
    },
  };

  try {
    const retried = await retryPendingSession({
      ...baseSession,
      group_id: 'group-1',
      ranking_mode: true,
      posture_standard: 'default',
      sync_status: 'pending_sync',
    });

    assert.equal(retried.sync_status, 'synced');
    assert.equal(uploadedPayloads.length, 1);
    assert.equal(uploadedPayloads[0].profile_id, 'profile-1');
    assert.equal(uploadedPayloads[0].group_id, 'group-1');
  } finally {
    socialClient.uploadSession = originalUploadSession;
  }
});

test('retry skips sessions that are not pending sync', async () => {
  const retried = await retryPendingSession({
    ...baseSession,
    sync_status: 'synced',
  });

  assert.equal(retried.sync_status, 'synced');
});
