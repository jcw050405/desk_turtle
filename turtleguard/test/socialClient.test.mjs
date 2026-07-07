import assert from 'node:assert/strict';
import test from 'node:test';

import { getFriendlySocialErrorMessage, socialClient } from '../src/services/socialClient.ts';
import { isSupabaseConfigured } from '../src/services/supabase.ts';

test('social client rejects calls when Supabase is not configured', async () => {
  assert.equal(isSupabaseConfigured(), false);

  await assert.rejects(
    () => socialClient.createProfile('Turtle'),
    /Supabase is not configured/,
  );
});

test('friendly social error explains missing Supabase setup', () => {
  assert.equal(
    getFriendlySocialErrorMessage(new Error('Supabase is not configured.')),
    'Supabase setup is missing. Add your URL and anon key in .env, then restart TurtleGuard.',
  );
});

test('friendly social error keeps useful Supabase messages', () => {
  assert.equal(
    getFriendlySocialErrorMessage({ message: 'duplicate key value violates unique constraint' }),
    'That nickname, group, or invite code is already in use. Try a different value.',
  );
});
