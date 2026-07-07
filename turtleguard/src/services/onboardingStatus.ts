import type { LocalSessionRecord } from '../types/electron';

export type OnboardingTab = 'monitor' | 'hardware' | 'history' | 'social' | 'ranking';
export type ReadinessStatus = 'ready' | 'needs_action';
export type SyncTone = 'success' | 'warning' | 'neutral';

export type ReadinessItem = {
  id: 'hardware' | 'camera' | 'supabase';
  label: string;
  status: ReadinessStatus;
  title: string;
  detail: string;
  actionLabel: string;
  targetTab: OnboardingTab;
};

export type ReadinessInput = {
  hardwareConnected: boolean;
  cameraChecked: boolean;
  hasSocialProfile: boolean;
  hasActiveGroup: boolean;
};

export type ReadinessSummary = {
  ready: boolean;
  title: string;
  detail: string;
  primaryActionLabel: string;
  primaryTargetTab: OnboardingTab;
};

export type FriendlySyncStatus = {
  label: string;
  detail: string;
  tone: SyncTone;
};

export function getFriendlySyncStatus(
  syncStatus: LocalSessionRecord['sync_status'] = 'local_only',
): FriendlySyncStatus {
  if (syncStatus === 'synced') {
    return {
      label: 'Synced to rankings',
      detail: 'This session has been uploaded successfully.',
      tone: 'success',
    };
  }

  if (syncStatus === 'pending_sync') {
    return {
      label: 'Waiting to sync',
      detail:
        'TurtleGuard will upload this session after Supabase setup or network access is restored.',
      tone: 'warning',
    };
  }

  return {
    label: 'Saved on this PC',
    detail: 'This session is stored locally and was not uploaded to rankings.',
    tone: 'neutral',
  };
}

export function buildReadinessItems(input: ReadinessInput): ReadinessItem[] {
  return [
    {
      id: 'hardware',
      label: 'Hardware',
      status: input.hardwareConnected ? 'ready' : 'needs_action',
      title: input.hardwareConnected ? 'Turtle hardware connected' : 'Connect turtle hardware',
      detail: input.hardwareConnected
        ? 'ESP32-C3 is connected and ready for GOOD/BAD commands.'
        : 'Open hardware settings, connect the ESP32-C3, then run a servo test.',
      actionLabel: 'Open hardware settings',
      targetTab: 'hardware',
    },
    {
      id: 'camera',
      label: 'Camera',
      status: input.cameraChecked ? 'ready' : 'needs_action',
      title: input.cameraChecked ? 'Camera check started' : 'Camera check needed',
      detail: input.cameraChecked
        ? 'The monitor tab has been opened. Start a session when the camera is ready.'
        : 'Open the monitor tab and start a session to confirm camera permission.',
      actionLabel: input.cameraChecked ? 'Open monitor' : 'Check camera',
      targetTab: 'monitor',
    },
    {
      id: 'supabase',
      label: 'Supabase',
      status: input.hasSocialProfile && input.hasActiveGroup ? 'ready' : 'needs_action',
      title:
        input.hasSocialProfile && input.hasActiveGroup
          ? 'Ranking setup ready'
          : 'Set up rankings',
      detail:
        input.hasSocialProfile && input.hasActiveGroup
          ? 'Profile and active group are saved for ranking sessions.'
          : 'Save a profile and create or join a group before using ranking mode.',
      actionLabel: 'Open social setup',
      targetTab: 'social',
    },
  ];
}

export function getReadinessSummary(items: ReadinessItem[]): ReadinessSummary {
  const firstMissing = items.find((item) => item.status !== 'ready');

  if (!firstMissing) {
    return {
      ready: true,
      title: 'TurtleGuard is ready',
      detail: 'Hardware, camera, and ranking setup checks are complete.',
      primaryActionLabel: 'Start monitoring',
      primaryTargetTab: 'monitor',
    };
  }

  return {
    ready: false,
    title: 'Finish TurtleGuard setup',
    detail: firstMissing.title,
    primaryActionLabel: firstMissing.actionLabel,
    primaryTargetTab: firstMissing.targetTab,
  };
}
