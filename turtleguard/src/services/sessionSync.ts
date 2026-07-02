import { buildStudySessionPayload } from './sessionPayload.ts';
import { settingsClient } from './settingsClient.ts';
import { socialClient } from './socialClient.ts';
import type { LocalSessionRecord } from './sessionClient.ts';
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
