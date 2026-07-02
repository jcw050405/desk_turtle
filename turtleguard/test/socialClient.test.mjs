import assert from 'node:assert/strict';
import test from 'node:test';

import { socialClient } from '../src/services/socialClient.ts';
import { isSupabaseConfigured } from '../src/services/supabase.ts';

test('social client rejects calls when Supabase is not configured', async () => {
  assert.equal(isSupabaseConfigured(), false);

  await assert.rejects(
    () => socialClient.createProfile('Turtle'),
    /Supabase is not configured/,
  );
});
