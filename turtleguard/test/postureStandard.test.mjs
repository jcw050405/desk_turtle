import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_POSTURE_STANDARD,
  POSTURE_STANDARD_ORDER,
  getEffectivePostureStandard,
  getPostureStandardConfig,
  isPostureStandard,
  normalizePostureStandard,
} from '../src/services/postureStandard.ts';

test('posture standards are ordered from sensitive to relaxed', () => {
  assert.deepEqual(POSTURE_STANDARD_ORDER, [
    'very_sensitive',
    'sensitive',
    'default',
    'relaxed',
    'very_relaxed',
  ]);
});

test('default standard uses fair ranking baseline', () => {
  const config = getPostureStandardConfig('default');

  assert.equal(DEFAULT_POSTURE_STANDARD, 'default');
  assert.equal(config.scaleIncreaseRatio, 0.1);
  assert.equal(config.yDropFaceHeightMultiplier, 0.55);
});

test('validation accepts only known posture standards', () => {
  assert.equal(isPostureStandard('very_sensitive'), true);
  assert.equal(isPostureStandard('default'), true);
  assert.equal(isPostureStandard('very_relaxed'), true);
  assert.equal(isPostureStandard('loose'), false);
  assert.equal(isPostureStandard(null), false);
});

test('normalizePostureStandard falls back to default for invalid values', () => {
  assert.equal(normalizePostureStandard('relaxed'), 'relaxed');
  assert.equal(normalizePostureStandard(''), 'default');
  assert.equal(normalizePostureStandard(undefined), 'default');
});

test('ranking mode always forces default standard', () => {
  assert.equal(getEffectivePostureStandard('very_relaxed', false), 'very_relaxed');
  assert.equal(getEffectivePostureStandard('very_relaxed', true), 'default');
});
