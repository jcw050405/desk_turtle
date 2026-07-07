import { buildStudySessionPayload } from './sessionPayload.ts';
import { settingsClient } from './settingsClient.ts';
import { socialClient } from './socialClient.ts';
import { sessionClient, type LocalSessionRecord } from './sessionClient.ts';
import type { PostureStandard } from './postureStandard.ts';

export async function syncEndedSession(
  session: LocalSessionRecord,
  rankingMode: boolean,
  postureStandard: PostureStandard,
): Promise<LocalSessionRecord> {
  const settings = await settingsClient.get();

  if (!settings.sync_enabled || !settings.profile_id) {
    return { ...session, sync_status: 'local_only' };
  }

  try {
    const payload = buildStudySessionPayload({
      session,
      profileId: settings.profile_id,
      groupId: rankingMode ? settings.last_selected_group_id : null,
      rankingMode,
      postureStandard,
    });

    await socialClient.uploadSession(payload);
    return { ...session, sync_status: 'synced' };
  } catch {
    return { ...session, sync_status: 'pending_sync' };
  }
}

async function persistSyncStatus(
  session: LocalSessionRecord,
  syncStatus: LocalSessionRecord['sync_status'],
): Promise<LocalSessionRecord> {
  return (
    (await sessionClient.finish({
      id: session.id,
      sync_status: syncStatus,
    })) ?? { ...session, sync_status: syncStatus }
  );
}

export async function retryPendingSession(session: LocalSessionRecord): Promise<LocalSessionRecord> {
  if (session.sync_status !== 'pending_sync') {
    return session;
  }

  const settings = await settingsClient.get();

  if (!settings.sync_enabled || !settings.profile_id) {
    return persistSyncStatus(session, 'local_only');
  }

  try {
    const rankingMode = session.ranking_mode ?? Boolean(session.group_id);
    const postureStandard = session.posture_standard ?? settings.posture_standard;
    const groupId = rankingMode ? (session.group_id ?? settings.last_selected_group_id) : null;
    const payload = buildStudySessionPayload({
      session,
      profileId: settings.profile_id,
      groupId,
      rankingMode,
      postureStandard,
    });

    await socialClient.uploadSession(payload);
    return persistSyncStatus(session, 'synced');
  } catch {
    return persistSyncStatus(session, 'pending_sync');
  }
}
