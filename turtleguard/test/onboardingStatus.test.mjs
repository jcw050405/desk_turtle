import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildReadinessItems,
  getFriendlySyncStatus,
  getReadinessSummary,
} from '../src/services/onboardingStatus.ts';

test('readiness items mark hardware ready when serial is connected', () => {
  const items = buildReadinessItems({
    hardwareConnected: true,
    cameraChecked: false,
    hasSocialProfile: false,
    hasActiveGroup: false,
  });

  assert.deepEqual(items[0], {
    id: 'hardware',
    label: 'Hardware',
    status: 'ready',
    title: 'Turtle hardware connected',
    detail: 'ESP32-C3 is connected and ready for GOOD/BAD commands.',
    actionLabel: 'Open hardware settings',
    targetTab: 'hardware',
  });
});

test('readiness summary points to the first missing setup item', () => {
  const summary = getReadinessSummary([
    {
      id: 'hardware',
      label: 'Hardware',
      status: 'ready',
      title: 'Turtle hardware connected',
      detail: 'Ready',
      actionLabel: 'Open hardware settings',
      targetTab: 'hardware',
    },
    {
      id: 'camera',
      label: 'Camera',
      status: 'needs_action',
      title: 'Camera check needed',
      detail: 'Open monitor',
      actionLabel: 'Check camera',
      targetTab: 'monitor',
    },
  ]);

  assert.deepEqual(summary, {
    ready: false,
    title: 'Finish TurtleGuard setup',
    detail: 'Camera check needed',
    primaryActionLabel: 'Check camera',
    primaryTargetTab: 'monitor',
  });
});

test('readiness summary is ready only when every item is ready', () => {
  const summary = getReadinessSummary(
    buildReadinessItems({
      hardwareConnected: true,
      cameraChecked: true,
      hasSocialProfile: true,
      hasActiveGroup: true,
    }),
  );

  assert.equal(summary.ready, true);
  assert.equal(summary.title, 'TurtleGuard is ready');
  assert.equal(summary.primaryActionLabel, 'Start monitoring');
  assert.equal(summary.primaryTargetTab, 'monitor');
});

test('friendly sync statuses explain local and pending records', () => {
  assert.deepEqual(getFriendlySyncStatus('local_only'), {
    label: 'Saved on this PC',
    detail: 'This session is stored locally and was not uploaded to rankings.',
    tone: 'neutral',
  });
  assert.deepEqual(getFriendlySyncStatus('pending_sync'), {
    label: 'Waiting to sync',
    detail: 'TurtleGuard will upload this session after Supabase setup or network access is restored.',
    tone: 'warning',
  });
});

test('friendly sync status explains synced records', () => {
  assert.deepEqual(getFriendlySyncStatus('synced'), {
    label: 'Synced to rankings',
    detail: 'This session has been uploaded successfully.',
    tone: 'success',
  });
});
