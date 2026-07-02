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
