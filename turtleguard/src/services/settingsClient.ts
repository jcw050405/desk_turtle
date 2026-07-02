import { DEFAULT_POSTURE_STANDARD, normalizePostureStandard } from './postureStandard';
import type { TurtleSettings } from '../types/electron';

export const DEFAULT_SETTINGS: TurtleSettings = {
  posture_standard: DEFAULT_POSTURE_STANDARD,
  last_selected_group_id: null,
  sync_enabled: true,
  profile_id: null,
  nickname: null,
  active_group_name: null,
  active_group_invite_code: null,
};

function getSettingsApi() {
  if (typeof window === 'undefined') {
    return undefined;
  }

  return window.turtleSettings;
}

export const settingsClient = {
  async get(): Promise<TurtleSettings> {
    const settings = (await getSettingsApi()?.get?.()) ?? DEFAULT_SETTINGS;
    return {
      ...DEFAULT_SETTINGS,
      ...settings,
      posture_standard: normalizePostureStandard(settings.posture_standard),
    };
  },

  async update(patch: Partial<TurtleSettings>): Promise<TurtleSettings> {
    const nextPatch = {
      ...patch,
      posture_standard:
        patch.posture_standard === undefined
          ? undefined
          : normalizePostureStandard(patch.posture_standard),
    };

    const settings = (await getSettingsApi()?.update?.(nextPatch)) ?? {
      ...DEFAULT_SETTINGS,
      ...nextPatch,
    };

    return {
      ...DEFAULT_SETTINGS,
      ...settings,
      posture_standard: normalizePostureStandard(settings.posture_standard),
    };
  },
};
