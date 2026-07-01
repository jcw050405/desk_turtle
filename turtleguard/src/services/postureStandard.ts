export const POSTURE_STANDARD_ORDER = [
  'very_sensitive',
  'sensitive',
  'default',
  'relaxed',
  'very_relaxed',
] as const;

export type PostureStandard = (typeof POSTURE_STANDARD_ORDER)[number];

export interface PostureStandardConfig {
  key: PostureStandard;
  label: string;
  scaleIncreaseRatio: number;
  yDropFaceHeightMultiplier: number;
}

export const DEFAULT_POSTURE_STANDARD: PostureStandard = 'default';

export const POSTURE_STANDARD_CONFIGS: Record<PostureStandard, PostureStandardConfig> = {
  very_sensitive: {
    key: 'very_sensitive',
    label: 'Very sensitive',
    scaleIncreaseRatio: 0.06,
    yDropFaceHeightMultiplier: 0.35,
  },
  sensitive: {
    key: 'sensitive',
    label: 'Sensitive',
    scaleIncreaseRatio: 0.08,
    yDropFaceHeightMultiplier: 0.45,
  },
  default: {
    key: 'default',
    label: 'Default',
    scaleIncreaseRatio: 0.1,
    yDropFaceHeightMultiplier: 0.55,
  },
  relaxed: {
    key: 'relaxed',
    label: 'Relaxed',
    scaleIncreaseRatio: 0.13,
    yDropFaceHeightMultiplier: 0.7,
  },
  very_relaxed: {
    key: 'very_relaxed',
    label: 'Very relaxed',
    scaleIncreaseRatio: 0.16,
    yDropFaceHeightMultiplier: 0.85,
  },
};

export function isPostureStandard(value: unknown): value is PostureStandard {
  return typeof value === 'string' && POSTURE_STANDARD_ORDER.includes(value as PostureStandard);
}

export function normalizePostureStandard(value: unknown): PostureStandard {
  return isPostureStandard(value) ? value : DEFAULT_POSTURE_STANDARD;
}

export function getPostureStandardConfig(value: unknown): PostureStandardConfig {
  return POSTURE_STANDARD_CONFIGS[normalizePostureStandard(value)];
}

export function getEffectivePostureStandard(
  selected: unknown,
  rankingMode: boolean,
): PostureStandard {
  return rankingMode ? DEFAULT_POSTURE_STANDARD : normalizePostureStandard(selected);
}
