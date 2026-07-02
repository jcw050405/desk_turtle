import { getEffectivePostureStandard, type PostureStandard } from './postureStandard';
import type { LocalSessionRecord } from './sessionClient';

export interface StudySessionUploadPayload {
  id: string;
  profile_id: string;
  group_id: string | null;
  started_at: string;
  ended_at: string | null;
  good_posture_seconds: number;
  bad_posture_seconds: number;
  away_seconds: number;
  warning_count: number;
  ended_reason: string | null;
  ranking_mode: boolean;
  posture_standard: PostureStandard;
}

interface BuildStudySessionPayloadInput {
  session: LocalSessionRecord;
  profileId: string;
  groupId: string | null;
  rankingMode: boolean;
  postureStandard: PostureStandard;
}

export function buildStudySessionPayload({
  session,
  profileId,
  groupId,
  rankingMode,
  postureStandard,
}: BuildStudySessionPayloadInput): StudySessionUploadPayload {
  if (rankingMode && !groupId) {
    throw new Error('Ranking sessions require group_id.');
  }

  return {
    id: session.id,
    profile_id: profileId,
    group_id: groupId,
    started_at: session.started_at,
    ended_at: session.ended_at,
    good_posture_seconds: session.good_posture_seconds,
    bad_posture_seconds: session.bad_posture_seconds,
    away_seconds: session.away_seconds,
    warning_count: session.warning_count,
    ended_reason: session.ended_reason,
    ranking_mode: rankingMode,
    posture_standard: getEffectivePostureStandard(postureStandard, rankingMode),
  };
}
