import { createClient } from '@supabase/supabase-js';

const viteEnv = (import.meta.env ?? {}) as Partial<ImportMetaEnv>;

export const supabaseUrl = viteEnv.VITE_SUPABASE_URL;
export const supabaseAnonKey = viteEnv.VITE_SUPABASE_ANON_KEY;

export function isSupabaseConfigured() {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

export const supabase = createClient(
  supabaseUrl || 'https://example.supabase.co',
  supabaseAnonKey || 'anonymous-key-not-configured',
);
