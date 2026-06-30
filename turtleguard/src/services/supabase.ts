import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "🚨 Supabase Environment Variables Missing!\n" +
    "Please define VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.\n" +
    "Database features will not work without them."
  );
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder'
);

export interface LeaderboardEntry {
  id: string;
  username: string;
  score: number;
  good_time: number;
  bad_time: number;
  created_at: string;
}

/**
 * Saves a user's session score to the leaderboard.
 * @param entry The leaderboard entry to save.
 */
export async function saveLeaderboardScore(entry: Omit<LeaderboardEntry, 'id' | 'created_at'>): Promise<void> {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Cannot save leaderboard score: Supabase is not configured.");
    return;
  }
  
  try {
    const { error } = await supabase.from('leaderboard').insert([entry]);
    if (error) {
      console.warn('Supabase save failed (ignoring in preview):', error.message);
    }
  } catch (err: any) {
    console.warn('Supabase save exception (ignoring in preview):', err.message);
  }
}

/**
 * Fetches the top rankings from the leaderboard.
 * @param limit The number of top entries to fetch.
 */
export async function fetchTopRankings(limit = 5): Promise<LeaderboardEntry[]> {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Cannot fetch rankings: Supabase is not configured.");
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('leaderboard')
      .select('*')
      .order('score', { ascending: false })
      .limit(limit);
      
    if (error) {
      console.warn('Supabase fetch failed (ignoring in preview):', error.message);
      return [];
    }
    
    return data as LeaderboardEntry[] || [];
  } catch (err: any) {
    console.warn('Supabase fetch exception (ignoring in preview):', err.message);
    return [];
  }
}

/**
 * Subscribes to leaderboard changes.
 * @param onUpdate Callback function triggered when data changes.
 * @returns An unsubscribe function.
 */
export function subscribeToLeaderboard(onUpdate: () => void): () => void {
  if (!supabaseUrl || !supabaseAnonKey) return () => {};
  
  const channel = supabase.channel('leaderboard_changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'leaderboard' }, () => {
      onUpdate();
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
