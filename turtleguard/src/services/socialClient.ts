import { isSupabaseConfigured, supabase } from './supabase.ts';
import type { StudySessionUploadPayload } from './sessionPayload.ts';

export interface TurtleProfile {
  id: string;
  nickname: string;
}

export interface TurtleGroup {
  id: string;
  name: string;
  invite_code: string;
}

export interface GroupRankingEntry {
  profile_id: string;
  nickname: string;
  total_good_posture_seconds: number;
  total_bad_posture_seconds: number;
  total_away_seconds: number;
  rank: number;
}

function requireSupabase() {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured.');
  }
}

export function getFriendlySocialErrorMessage(caught: unknown): string {
  const message =
    caught instanceof Error
      ? caught.message
      : typeof caught === 'object' && caught && 'message' in caught
        ? String(caught.message)
        : '';
  const normalized = message.toLowerCase();

  if (normalized.includes('supabase is not configured')) {
    return 'Supabase setup is missing. Add your URL and anon key in .env, then restart TurtleGuard.';
  }

  if (normalized.includes('duplicate') || normalized.includes('unique constraint')) {
    return 'That nickname, group, or invite code is already in use. Try a different value.';
  }

  if (normalized.includes('invite')) {
    return 'Invite code was not accepted. Check the code and try again.';
  }

  if (normalized.includes('network') || normalized.includes('fetch')) {
    return 'Could not reach Supabase. Check your internet connection and try again.';
  }

  return message || 'Social request failed. Check your Supabase setup and try again.';
}

export const socialClient = {
  async createProfile(nickname: string): Promise<TurtleProfile> {
    requireSupabase();
    const { data, error } = await supabase.rpc('create_profile', { nickname });
    if (error) throw error;
    return data as TurtleProfile;
  },

  async createGroup(profileId: string, groupName: string): Promise<TurtleGroup> {
    requireSupabase();
    const { data, error } = await supabase.rpc('create_group_with_invite_code', {
      profile_id: profileId,
      group_name: groupName,
    });
    if (error) throw error;
    return data as TurtleGroup;
  },

  async joinGroup(profileId: string, inviteCode: string): Promise<TurtleGroup> {
    requireSupabase();
    const { data, error } = await supabase.rpc('join_group_by_invite_code', {
      profile_id: profileId,
      invite_code: inviteCode,
    });
    if (error) throw error;
    return data as TurtleGroup;
  },

  async uploadSession(payload: StudySessionUploadPayload) {
    requireSupabase();
    const { data, error } = await supabase.rpc('upload_study_session', { payload });
    if (error) throw error;
    return data;
  },

  async getRankings(groupId: string, period: 'daily' | 'weekly'): Promise<GroupRankingEntry[]> {
    requireSupabase();
    const { data, error } = await supabase.rpc('get_group_rankings', {
      group_id: groupId,
      period,
    });
    if (error) throw error;
    return (data ?? []) as GroupRankingEntry[];
  },
};
