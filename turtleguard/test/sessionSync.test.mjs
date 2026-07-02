import assert from 'node:assert/strict';
import test from 'node:test';

import { syncEndedSession } from '../src/services/sessionSync.ts';

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
