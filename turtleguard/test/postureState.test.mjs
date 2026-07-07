import assert from 'node:assert/strict';
import test from 'node:test';

import { initialPostureRuntime, nextPostureState } from '../src/services/postureState.ts';

test('brief BAD posture blips wait for the transition hold duration', () => {
  const runtime = { ...initialPostureRuntime(), state: 'GOOD' };

  const next = nextPostureState(runtime, {
    hasFace: true,
    isBadPosture: true,
    now: 1000,
    awayGraceMs: 10_000,
    transitionHoldMs: 1200,
  });

  assert.equal(next.state, 'GOOD');
  assert.equal(next.candidateState, 'BAD');
  assert.equal(next.candidateSince, 1000);
  assert.equal(next.counters.warning_count, 0);
});

test('BAD posture enters after the transition hold duration and warns once', () => {
  const runtime = {
    ...initialPostureRuntime(),
    state: 'GOOD',
    candidateState: 'BAD',
    candidateSince: 1000,
  };

  const next = nextPostureState(runtime, {
    hasFace: true,
    isBadPosture: true,
    now: 2300,
    awayGraceMs: 10_000,
    transitionHoldMs: 1200,
  });

  assert.equal(next.state, 'BAD');
  assert.equal(next.candidateState, null);
  assert.equal(next.candidateSince, null);
  assert.equal(next.counters.warning_count, 1);
});

test('GOOD posture must also remain stable before leaving BAD', () => {
  const runtime = { ...initialPostureRuntime(), state: 'BAD' };

  const next = nextPostureState(runtime, {
    hasFace: true,
    isBadPosture: false,
    now: 5000,
    awayGraceMs: 10_000,
    transitionHoldMs: 1200,
  });

  assert.equal(next.state, 'BAD');
  assert.equal(next.candidateState, 'GOOD');
  assert.equal(next.candidateSince, 5000);
});
