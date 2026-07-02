import assert from 'node:assert/strict';
import test from 'node:test';

import { buildStudySessionPayload } from '../src/services/sessionPayload.ts';

const baseSession = {
  id: 'session-1',
  started_at: '2026-07-01T10:00:00.000Z',
  ended_at: '2026-07-01T10:30:00.000Z',
  good_posture_seconds: 1200,
  bad_posture_seconds: 500,
  away_seconds: 100,
  warning_count: 3,
  ended_reason: 'user_stopped',
  created_at: '2026-07-01T10:00:00.000Z',
  updated_at: '2026-07-01T10:30:00.000Z',
  sync_status: 'pending_sync',
};

test('personal sessions upload summary data without group ranking metadata', () => {
  const payload = buildStudySessionPayload({
    session: baseSession,
    profileId: 'profile-1',
    groupId: null,
    rankingMode: false,
    postureStandard: 'relaxed',
  });

  assert.equal(payload.id, 'session-1');
  assert.equal(payload.profile_id, 'profile-1');
  assert.equal(payload.group_id, null);
  assert.equal(payload.ranking_mode, false);
  assert.equal(payload.posture_standard, 'relaxed');
  assert.equal(payload.good_posture_seconds, 1200);
  assert.equal(payload.bad_posture_seconds, 500);
  assert.equal(payload.away_seconds, 100);
});

test('ranking sessions require a group and force default standard', () => {
  const payload = buildStudySessionPayload({
    session: baseSession,
    profileId: 'profile-1',
    groupId: 'group-1',
    rankingMode: true,
    postureStandard: 'very_relaxed',
  });

  assert.equal(payload.group_id, 'group-1');
  assert.equal(payload.ranking_mode, true);
  assert.equal(payload.posture_standard, 'default');
});

test('ranking sessions without a group are rejected', () => {
  assert.throws(
    () =>
      buildStudySessionPayload({
        session: baseSession,
        profileId: 'profile-1',
        groupId: null,
        rankingMode: true,
        postureStandard: 'default',
      }),
    /Ranking sessions require group_id/,
  );
});
