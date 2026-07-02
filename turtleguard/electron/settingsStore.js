import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const POSTURE_STANDARDS = new Set([
  'very_sensitive',
  'sensitive',
  'default',
  'relaxed',
  'very_relaxed',
]);

const DEFAULT_SETTINGS = Object.freeze({
  posture_standard: 'default',
  last_selected_group_id: null,
  sync_enabled: true,
  profile_id: null,
  nickname: null,
  active_group_name: null,
  active_group_invite_code: null,
});

function normalizeOptionalString(value) {
  return typeof value === 'string' && value.trim() ? value : null;
}

function normalizeSettings(value) {
  const input = value && typeof value === 'object' ? value : {};
  const postureStandard = POSTURE_STANDARDS.has(input.posture_standard)
    ? input.posture_standard
    : DEFAULT_SETTINGS.posture_standard;

  return {
    posture_standard: postureStandard,
    last_selected_group_id: normalizeOptionalString(input.last_selected_group_id),
    sync_enabled:
      typeof input.sync_enabled === 'boolean' ? input.sync_enabled : DEFAULT_SETTINGS.sync_enabled,
    profile_id: normalizeOptionalString(input.profile_id),
    nickname: normalizeOptionalString(input.nickname),
    active_group_name: normalizeOptionalString(input.active_group_name),
    active_group_invite_code: normalizeOptionalString(input.active_group_invite_code),
  };
}

export class SettingsStore {
  constructor(userDataPath) {
    this.filePath = path.join(userDataPath, 'settings.json');
  }

  async ensureDir() {
    await mkdir(path.dirname(this.filePath), { recursive: true });
  }

  async readRaw() {
    try {
      return JSON.parse(await readFile(this.filePath, 'utf8'));
    } catch (error) {
      if (error?.code === 'ENOENT') {
        return {};
      }

      return {};
    }
  }

  async write(settings) {
    await this.ensureDir();
    await writeFile(this.filePath, `${JSON.stringify(settings, null, 2)}\n`, 'utf8');
  }

  async get() {
    return normalizeSettings(await this.readRaw());
  }

  async update(patch) {
    const next = normalizeSettings({
      ...(await this.get()),
      ...(patch && typeof patch === 'object' ? patch : {}),
    });
    await this.write(next);
    return next;
  }
}
