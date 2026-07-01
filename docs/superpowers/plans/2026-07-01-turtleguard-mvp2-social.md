# TurtleGuard MVP-2 Social Ranking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add local 5-step posture standard settings, fair ranking-mode override, nickname/group social flows, session sync, and daily/weekly group rankings.

**Architecture:** Keep posture tracking local-first. Store local settings in Electron main process JSON storage exposed through preload IPC. Use Supabase RPC for social workflows and summary-only ranking data.

**Tech Stack:** Electron main/preload IPC, React + TypeScript, Vite, Node test runner, Supabase RPC/SQL, local JSON files under Electron `userData`.

---

## File Map

Create:

- `turtleguard/src/services/postureStandard.ts`: posture standard keys, labels, mapping, validation, and ranking override.
- `turtleguard/test/postureStandard.test.mjs`: unit tests for mapping, validation, and ranking override.
- `turtleguard/electron/settingsStore.js`: main-process local settings JSON store.
- `turtleguard/test/settingsStore.test.mjs`: unit tests for settings persistence and fallback.
- `turtleguard/src/services/settingsClient.ts`: renderer wrapper around preload settings API.
- `turtleguard/src/components/PostureStandardControl.tsx`: 5-step posture standard control.
- `turtleguard/src/services/sessionPayload.ts`: pure helpers for session upload payloads and ranking-mode validation.
- `turtleguard/test/sessionPayload.test.mjs`: unit tests for payload building.
- `turtleguard/supabase/migrations/20260701_mvp2_social.sql`: schema, constraints, RPC, and RLS draft.
- `turtleguard/src/services/socialClient.ts`: Supabase RPC wrapper.
- `turtleguard/src/pages/SocialSetup.tsx`: nickname, create group, join group flow.
- `turtleguard/src/pages/GroupRanking.tsx`: daily/weekly ranking view.
- `docs/releases/v0.2.0-manual-qa.md`: user-run checklist for installer, posture standard, Arduino, and Supabase.

Modify:

- `turtleguard/package.json`: add a focused `test:mvp2` script.
- `turtleguard/main.js`: create `SettingsStore` and register settings IPC handlers.
- `turtleguard/preload.js`: expose `window.turtleSettings`.
- `turtleguard/src/types/electron.d.ts`: add settings API and session fields.
- `turtleguard/src/services/poseDetection.ts`: accept posture standard config in detection.
- `turtleguard/src/pages/MainMonitor.tsx`: load setting, show 5-step control, apply setting, force default in ranking mode.
- `turtleguard/src/services/sessionClient.ts`: include new session metadata fields.
- `turtleguard/src/components/AppShell.tsx`: add Social and Ranking tabs.
- `turtleguard/src/services/supabase.ts`: replace legacy leaderboard helper with exported client and environment guard helpers.

---

### Task 1: Add Posture Standard Domain Model

**Files:**
- Create: `turtleguard/src/services/postureStandard.ts`
- Create: `turtleguard/test/postureStandard.test.mjs`
- Modify: `turtleguard/package.json`

- [ ] **Step 1: Add a focused test script**

Modify `turtleguard/package.json` scripts:

```json
"test:mvp2": "node --import tsx --test test/postureStandard.test.mjs test/settingsStore.test.mjs test/sessionPayload.test.mjs"
```

Keep the existing `test:node` script unchanged.

- [ ] **Step 2: Write failing tests for posture standard mapping**

Create `turtleguard/test/postureStandard.test.mjs`:

```js
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
```

- [ ] **Step 3: Run tests and verify failure**

Run:

```powershell
cd .\turtleguard
npm run test:mvp2
```

Expected: fails because `src/services/postureStandard.ts` does not exist.

- [ ] **Step 4: Implement posture standard model**

Create `turtleguard/src/services/postureStandard.ts`:

```ts
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
```

- [ ] **Step 5: Run tests and commit**

Run:

```powershell
npm run test:mvp2
npm run lint
```

Expected: posture standard tests pass and TypeScript exits 0.

Commit:

```powershell
git add package.json src/services/postureStandard.ts test/postureStandard.test.mjs
git commit -m "feat: add posture standard model"
```

---

### Task 2: Add Main-Process Local Settings Storage

**Files:**
- Create: `turtleguard/electron/settingsStore.js`
- Create: `turtleguard/test/settingsStore.test.mjs`
- Create: `turtleguard/src/services/settingsClient.ts`
- Modify: `turtleguard/main.js`
- Modify: `turtleguard/preload.js`
- Modify: `turtleguard/src/types/electron.d.ts`

- [ ] **Step 1: Write failing SettingsStore tests**

Create `turtleguard/test/settingsStore.test.mjs`:

```js
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { SettingsStore } from '../electron/settingsStore.js';

async function withStore(fn) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'turtleguard-settings-'));
  try {
    await fn(new SettingsStore(dir));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test('settings default to default posture standard', async () => {
  await withStore(async (store) => {
    const settings = await store.get();
    assert.equal(settings.posture_standard, 'default');
    assert.equal(settings.last_selected_group_id, null);
    assert.equal(settings.sync_enabled, true);
  });
});

test('settings persist posture standard changes', async () => {
  await withStore(async (store) => {
    await store.update({ posture_standard: 'relaxed' });
    const settings = await store.get();
    assert.equal(settings.posture_standard, 'relaxed');
  });
});

test('invalid settings fall back safely', async () => {
  await withStore(async (store) => {
    await store.update({ posture_standard: 'invalid-value', sync_enabled: 'yes' });
    const settings = await store.get();
    assert.equal(settings.posture_standard, 'default');
    assert.equal(settings.sync_enabled, true);
  });
});
```

- [ ] **Step 2: Run test and verify failure**

Run:

```powershell
npm run test:mvp2
```

Expected: fails because `electron/settingsStore.js` does not exist.

- [ ] **Step 3: Implement settings store**

Create `turtleguard/electron/settingsStore.js`:

```js
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
});

function normalizeSettings(value) {
  const input = value && typeof value === 'object' ? value : {};
  const postureStandard = POSTURE_STANDARDS.has(input.posture_standard)
    ? input.posture_standard
    : DEFAULT_SETTINGS.posture_standard;

  return {
    posture_standard: postureStandard,
    last_selected_group_id:
      typeof input.last_selected_group_id === 'string' ? input.last_selected_group_id : null,
    sync_enabled:
      typeof input.sync_enabled === 'boolean' ? input.sync_enabled : DEFAULT_SETTINGS.sync_enabled,
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
```

- [ ] **Step 4: Register settings IPC**

Modify `turtleguard/main.js`:

```js
import { SettingsStore } from './electron/settingsStore.js';
```

Change `registerIpcHandlers` signature:

```js
function registerIpcHandlers(sessionStore, settingsStore) {
```

Add handlers inside `registerIpcHandlers`:

```js
  ipcMain.handle('settings:get', async () => settingsStore.get());
  ipcMain.handle('settings:update', async (_event, patch) => settingsStore.update(patch));
```

Create store in `app.whenReady()`:

```js
  const settingsStore = new SettingsStore(app.getPath('userData'));

  registerIpcHandlers(sessionStore, settingsStore);
```

Remove the old one-argument `registerIpcHandlers(sessionStore)` call.

- [ ] **Step 5: Expose preload API**

Add to `turtleguard/preload.js`:

```js
contextBridge.exposeInMainWorld('turtleSettings', {
  get: () => ipcRenderer.invoke('settings:get'),
  update: (patch) => ipcRenderer.invoke('settings:update', patch),
});
```

- [ ] **Step 6: Add renderer types**

Modify `turtleguard/src/types/electron.d.ts`:

```ts
export type TurtlePostureStandard =
  | 'very_sensitive'
  | 'sensitive'
  | 'default'
  | 'relaxed'
  | 'very_relaxed';

export interface TurtleSettings {
  posture_standard: TurtlePostureStandard;
  last_selected_group_id: string | null;
  sync_enabled: boolean;
}

export interface TurtleSettingsApi {
  get(): Promise<TurtleSettings>;
  update(patch: Partial<TurtleSettings>): Promise<TurtleSettings>;
}
```

Add to `Window`:

```ts
turtleSettings?: TurtleSettingsApi;
```

- [ ] **Step 7: Add renderer settings client**

Create `turtleguard/src/services/settingsClient.ts`:

```ts
import { DEFAULT_POSTURE_STANDARD, normalizePostureStandard } from './postureStandard';
import type { TurtleSettings } from '../types/electron';

export const DEFAULT_SETTINGS: TurtleSettings = {
  posture_standard: DEFAULT_POSTURE_STANDARD,
  last_selected_group_id: null,
  sync_enabled: true,
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
```

- [ ] **Step 8: Run tests and commit**

Run:

```powershell
npm run test:mvp2
npm run test:node
npm run lint
```

Expected: settings tests, existing node tests, and TypeScript pass.

Commit:

```powershell
git add main.js preload.js electron/settingsStore.js src/types/electron.d.ts src/services/settingsClient.ts test/settingsStore.test.mjs
git commit -m "feat: persist local app settings"
```

---

### Task 3: Apply Posture Standard To Detection

**Files:**
- Modify: `turtleguard/src/services/poseDetection.ts`
- Modify: `turtleguard/src/pages/MainMonitor.tsx`
- Test: `turtleguard/test/postureStandard.test.mjs`

- [ ] **Step 1: Extend posture standard tests with effective config**

Append to `test/postureStandard.test.mjs`:

```js
test('relaxed standards require more deviation than sensitive standards', () => {
  const sensitive = getPostureStandardConfig('sensitive');
  const relaxed = getPostureStandardConfig('relaxed');

  assert.ok(relaxed.scaleIncreaseRatio > sensitive.scaleIncreaseRatio);
  assert.ok(relaxed.yDropFaceHeightMultiplier > sensitive.yDropFaceHeightMultiplier);
});
```

- [ ] **Step 2: Run focused test**

Run:

```powershell
npm run test:mvp2
```

Expected: pass after Task 1; this guards mapping before wiring.

- [ ] **Step 3: Modify detector imports and method signature**

In `turtleguard/src/services/poseDetection.ts`, import:

```ts
import { getPostureStandardConfig, type PostureStandard } from './postureStandard';
```

Change:

```ts
detectPosture(video: HTMLVideoElement, timestamp: number): PostureResult | null {
```

to:

```ts
detectPosture(
  video: HTMLVideoElement,
  timestamp: number,
  postureStandard: PostureStandard = 'default',
): PostureResult | null {
```

- [ ] **Step 4: Replace hard-coded thresholds**

Replace:

```ts
    const scaleThreshold = this.baselineScale * 1.08;
    const yThreshold = this.baselineY + (boundingBox.height * 0.5); 
```

with:

```ts
    const standardConfig = getPostureStandardConfig(postureStandard);
    const scaleThreshold = this.baselineScale * (1 + standardConfig.scaleIncreaseRatio);
    const yThreshold =
      this.baselineY + boundingBox.height * standardConfig.yDropFaceHeightMultiplier;
```

- [ ] **Step 5: Add monitor state for personal standard and ranking mode**

In `MainMonitor.tsx`, import:

```ts
import PostureStandardControl from '../components/PostureStandardControl';
import { settingsClient } from '../services/settingsClient';
import {
  DEFAULT_POSTURE_STANDARD,
  getEffectivePostureStandard,
  type PostureStandard,
} from '../services/postureStandard';
```

Add state:

```ts
  const [postureStandard, setPostureStandard] =
    useState<PostureStandard>(DEFAULT_POSTURE_STANDARD);
  const [rankingMode, setRankingMode] = useState(false);
```

Load settings:

```ts
  useEffect(() => {
    void settingsClient.get().then((settings) => {
      setPostureStandard(settings.posture_standard);
    });
  }, []);
```

Add helper:

```ts
  const effectivePostureStandard = getEffectivePostureStandard(postureStandard, rankingMode);
```

- [ ] **Step 6: Pass standard to detector**

Replace:

```ts
      const result = postureDetector.detectPosture(videoRef.current, timestamp);
```

with:

```ts
      const result = postureDetector.detectPosture(
        videoRef.current,
        timestamp,
        effectivePostureStandard,
      );
```

Add `effectivePostureStandard` to the `detectLoop` dependency array.

- [ ] **Step 7: Run typecheck and commit**

Run:

```powershell
npm run lint
npm run test:mvp2
```

Expected: TypeScript and focused tests pass.

Commit:

```powershell
git add src/services/poseDetection.ts src/pages/MainMonitor.tsx test/postureStandard.test.mjs
git commit -m "feat: apply posture standard to detection"
```

---

### Task 4: Add 5-Step Posture Standard UI

**Files:**
- Create: `turtleguard/src/components/PostureStandardControl.tsx`
- Modify: `turtleguard/src/pages/MainMonitor.tsx`

- [ ] **Step 1: Create posture standard control**

Create `turtleguard/src/components/PostureStandardControl.tsx`:

```tsx
import {
  POSTURE_STANDARD_CONFIGS,
  POSTURE_STANDARD_ORDER,
  type PostureStandard,
} from '../services/postureStandard';

interface PostureStandardControlProps {
  value: PostureStandard;
  disabled?: boolean;
  note?: string;
  onChange(value: PostureStandard): void;
}

export default function PostureStandardControl({
  value,
  disabled = false,
  note,
  onChange,
}: PostureStandardControlProps) {
  const index = POSTURE_STANDARD_ORDER.indexOf(value);
  const safeIndex = index === -1 ? 2 : index;
  const selected = POSTURE_STANDARD_CONFIGS[POSTURE_STANDARD_ORDER[safeIndex]];

  return (
    <div className="rounded-lg border border-[#2C2C2A]/10 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-[#2C2C2A]/50">Posture standard</p>
          <p className="font-semibold text-[#2C2C2A]">{selected.label}</p>
        </div>
        <span className="rounded-md bg-[#2E7D63]/10 px-2 py-1 text-xs text-[#2E7D63]">
          {safeIndex + 1}/5
        </span>
      </div>

      <input
        type="range"
        min={0}
        max={4}
        step={1}
        value={safeIndex}
        disabled={disabled}
        aria-label="Posture standard"
        onChange={(event) => onChange(POSTURE_STANDARD_ORDER[Number(event.target.value)])}
        className="mt-3 w-full accent-[#2E7D63]"
      />

      <div className="mt-1 flex justify-between text-xs text-[#2C2C2A]/50">
        <span>Sensitive</span>
        <span>Relaxed</span>
      </div>

      {note && <p className="mt-3 text-xs text-[#2C2C2A]/60">{note}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Wire control into monitor**

In `MainMonitor.tsx`, add:

```ts
  const handlePostureStandardChange = async (next: PostureStandard) => {
    setPostureStandard(next);
    await settingsClient.update({ posture_standard: next });
  };
```

Render inside the right-side `<aside className="space-y-4">` before performance mode:

```tsx
        <PostureStandardControl
          value={effectivePostureStandard}
          disabled={rankingMode}
          note={
            rankingMode
              ? 'Ranking sessions use the default posture standard for fairness.'
              : 'Adjust how quickly TurtleGuard marks forward-head posture.'
          }
          onChange={handlePostureStandardChange}
        />
```

- [ ] **Step 3: Add temporary ranking mode toggle for local testing**

Until group sessions exist, add a simple checkbox below the posture standard control:

```tsx
        <label className="flex items-center gap-2 rounded-lg border border-[#2C2C2A]/10 bg-white p-4 text-sm">
          <input
            type="checkbox"
            checked={rankingMode}
            onChange={(event) => setRankingMode(event.target.checked)}
            className="h-4 w-4 accent-[#2E7D63]"
          />
          Ranking mode fairness check
        </label>
```

This toggle is replaced by real group-session mode in Task 8.

- [ ] **Step 4: Run lean verification and commit**

Run:

```powershell
npm run lint
```

Expected: TypeScript exits 0.

Commit:

```powershell
git add src/components/PostureStandardControl.tsx src/pages/MainMonitor.tsx
git commit -m "feat: add posture standard control"
```

Manual check assigned to user after a test build:

- Move slider to Sensitive and confirm BAD appears more easily.
- Move slider to Relaxed and confirm BAD appears less easily.
- Enable ranking toggle and confirm the control is disabled at Default.

---

### Task 5: Add Session Metadata And Upload Payload Builder

**Files:**
- Create: `turtleguard/src/services/sessionPayload.ts`
- Create: `turtleguard/test/sessionPayload.test.mjs`
- Modify: `turtleguard/src/types/electron.d.ts`
- Modify: `turtleguard/src/pages/MainMonitor.tsx`

- [ ] **Step 1: Write payload tests**

Create `turtleguard/test/sessionPayload.test.mjs`:

```js
import assert from 'node:assert/strict';
import test from 'node:test';

import { buildStudySessionPayload } from '../src/services/sessionPayload.ts';

const baseSession = {
  id: 'session-1',
  started_at: '2026-07-01T00:00:00.000Z',
  ended_at: '2026-07-01T00:10:00.000Z',
  good_posture_seconds: 500,
  bad_posture_seconds: 80,
  away_seconds: 20,
  warning_count: 3,
  ended_reason: 'user_stopped',
  created_at: '2026-07-01T00:00:00.000Z',
  updated_at: '2026-07-01T00:10:00.000Z',
  sync_status: 'pending',
};

test('personal payload keeps selected posture standard', () => {
  const payload = buildStudySessionPayload({
    session: baseSession,
    profileId: 'profile-1',
    groupId: null,
    rankingMode: false,
    postureStandard: 'relaxed',
  });

  assert.equal(payload.ranking_mode, false);
  assert.equal(payload.posture_standard, 'relaxed');
  assert.equal(payload.group_id, null);
});

test('ranking payload forces default posture standard', () => {
  const payload = buildStudySessionPayload({
    session: baseSession,
    profileId: 'profile-1',
    groupId: 'group-1',
    rankingMode: true,
    postureStandard: 'very_relaxed',
  });

  assert.equal(payload.ranking_mode, true);
  assert.equal(payload.posture_standard, 'default');
  assert.equal(payload.group_id, 'group-1');
});

test('ranking payload requires group id', () => {
  assert.throws(
    () =>
      buildStudySessionPayload({
        session: baseSession,
        profileId: 'profile-1',
        groupId: null,
        rankingMode: true,
        postureStandard: 'default',
      }),
    /Ranking sessions require group_id/,
  );
});
```

- [ ] **Step 2: Implement payload builder**

Create `turtleguard/src/services/sessionPayload.ts`:

```ts
import {
  getEffectivePostureStandard,
  normalizePostureStandard,
  type PostureStandard,
} from './postureStandard';
import type { LocalSessionRecord } from './sessionClient';

export interface BuildStudySessionPayloadInput {
  session: LocalSessionRecord;
  profileId: string;
  groupId: string | null;
  rankingMode: boolean;
  postureStandard: PostureStandard;
}

export interface StudySessionUploadPayload {
  id: string;
  profile_id: string;
  group_id: string | null;
  started_at: string;
  ended_at: string;
  good_posture_seconds: number;
  bad_posture_seconds: number;
  away_seconds: number;
  warning_count: number;
  ranking_mode: boolean;
  posture_standard: PostureStandard;
}

export function buildStudySessionPayload({
  session,
  profileId,
  groupId,
  rankingMode,
  postureStandard,
}: BuildStudySessionPayloadInput): StudySessionUploadPayload {
  if (rankingMode && !groupId) {
    throw new Error('Ranking sessions require group_id.');
  }

  if (!session.ended_at) {
    throw new Error('Only ended sessions can be uploaded.');
  }

  return {
    id: session.id,
    profile_id: profileId,
    group_id: groupId,
    started_at: session.started_at,
    ended_at: session.ended_at,
    good_posture_seconds: session.good_posture_seconds,
    bad_posture_seconds: session.bad_posture_seconds,
    away_seconds: session.away_seconds,
    warning_count: session.warning_count,
    ranking_mode: rankingMode,
    posture_standard: getEffectivePostureStandard(
      normalizePostureStandard(postureStandard),
      rankingMode,
    ),
  };
}
```

- [ ] **Step 3: Extend LocalSessionRecord type**

In `src/types/electron.d.ts`, add optional fields to `LocalSessionRecord`:

```ts
group_id?: string | null;
ranking_mode?: boolean;
posture_standard?: TurtlePostureStandard;
```

- [ ] **Step 4: Include metadata when creating sessions**

In `MainMonitor.tsx`, update `makeSession` signature:

```ts
function makeSession(
  runtime: PostureRuntime,
  id: string,
  startedAt: string,
  endedAt: string | null,
  endedReason: string | null,
  metadata: {
    groupId: string | null;
    rankingMode: boolean;
    postureStandard: PostureStandard;
  },
): LocalSessionRecord {
```

Add fields to returned object:

```ts
    group_id: metadata.groupId,
    ranking_mode: metadata.rankingMode,
    posture_standard: getEffectivePostureStandard(
      metadata.postureStandard,
      metadata.rankingMode,
    ),
```

Update call sites with:

```ts
{
  groupId: null,
  rankingMode,
  postureStandard,
}
```

- [ ] **Step 5: Run tests and commit**

Run:

```powershell
npm run test:mvp2
npm run lint
```

Expected: focused tests and TypeScript pass.

Commit:

```powershell
git add src/services/sessionPayload.ts test/sessionPayload.test.mjs src/types/electron.d.ts src/pages/MainMonitor.tsx
git commit -m "feat: add ranking session metadata"
```

---

### Task 6: Add Supabase Schema And RPC Draft

**Files:**
- Create: `turtleguard/supabase/migrations/20260701_mvp2_social.sql`

- [ ] **Step 1: Create Supabase migration file**

Create `turtleguard/supabase/migrations/20260701_mvp2_social.sql`:

```sql
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  nickname text not null check (char_length(trim(nickname)) between 1 and 32),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz
);

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 48),
  invite_code text not null unique,
  owner_profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  unique(group_id, profile_id)
);

create table if not exists public.study_sessions (
  id uuid primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  group_id uuid references public.groups(id) on delete set null,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  good_posture_seconds integer not null check (good_posture_seconds >= 0),
  bad_posture_seconds integer not null check (bad_posture_seconds >= 0),
  away_seconds integer not null check (away_seconds >= 0),
  warning_count integer not null check (warning_count >= 0),
  ranking_mode boolean not null default false,
  posture_standard text not null check (
    posture_standard in ('very_sensitive', 'sensitive', 'default', 'relaxed', 'very_relaxed')
  ),
  sync_status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ranking_sessions_use_default_standard check (
    ranking_mode = false or posture_standard = 'default'
  ),
  constraint ranking_sessions_have_group check (
    ranking_mode = false or group_id is not null
  )
);

create or replace function public.create_profile(nickname text)
returns public.profiles
language plpgsql
security definer
as $$
declare
  cleaned text := trim(nickname);
  created public.profiles;
begin
  if char_length(cleaned) < 1 or char_length(cleaned) > 32 then
    raise exception 'Nickname must be 1 to 32 characters.';
  end if;

  insert into public.profiles (nickname, last_seen_at)
  values (cleaned, now())
  returning * into created;

  return created;
end;
$$;

create or replace function public.create_group_with_invite_code(profile_id uuid, group_name text)
returns public.groups
language plpgsql
security definer
as $$
declare
  cleaned_name text := trim(group_name);
  code text;
  created public.groups;
begin
  if exists (select 1 from public.group_members gm where gm.profile_id = create_group_with_invite_code.profile_id) then
    raise exception 'MVP-2 supports one group per user.';
  end if;

  code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  insert into public.groups (name, invite_code, owner_profile_id)
  values (cleaned_name, code, profile_id)
  returning * into created;

  insert into public.group_members (group_id, profile_id, role)
  values (created.id, profile_id, 'owner');

  return created;
end;
$$;

create or replace function public.join_group_by_invite_code(profile_id uuid, invite_code text)
returns public.groups
language plpgsql
security definer
as $$
declare
  normalized_code text := upper(trim(invite_code));
  target_group public.groups;
begin
  if exists (select 1 from public.group_members gm where gm.profile_id = join_group_by_invite_code.profile_id) then
    raise exception 'MVP-2 supports one group per user.';
  end if;

  select * into target_group from public.groups g where g.invite_code = normalized_code;

  if target_group.id is null then
    raise exception 'Invite code not found.';
  end if;

  insert into public.group_members (group_id, profile_id, role)
  values (target_group.id, profile_id, 'member');

  return target_group;
end;
$$;

create or replace function public.upload_study_session(payload jsonb)
returns public.study_sessions
language plpgsql
security definer
as $$
declare
  inserted public.study_sessions;
  payload_profile_id uuid := (payload->>'profile_id')::uuid;
  payload_group_id uuid := nullif(payload->>'group_id', '')::uuid;
  payload_ranking_mode boolean := coalesce((payload->>'ranking_mode')::boolean, false);
  payload_posture_standard text := payload->>'posture_standard';
begin
  if payload_ranking_mode and payload_posture_standard <> 'default' then
    raise exception 'Ranking sessions must use default posture standard.';
  end if;

  if payload_group_id is not null and not exists (
    select 1 from public.group_members gm
    where gm.group_id = payload_group_id and gm.profile_id = payload_profile_id
  ) then
    raise exception 'Profile is not a member of this group.';
  end if;

  insert into public.study_sessions (
    id,
    profile_id,
    group_id,
    started_at,
    ended_at,
    good_posture_seconds,
    bad_posture_seconds,
    away_seconds,
    warning_count,
    ranking_mode,
    posture_standard,
    sync_status
  )
  values (
    (payload->>'id')::uuid,
    payload_profile_id,
    payload_group_id,
    (payload->>'started_at')::timestamptz,
    (payload->>'ended_at')::timestamptz,
    (payload->>'good_posture_seconds')::integer,
    (payload->>'bad_posture_seconds')::integer,
    (payload->>'away_seconds')::integer,
    (payload->>'warning_count')::integer,
    payload_ranking_mode,
    payload_posture_standard,
    'synced'
  )
  on conflict (id) do update set
    updated_at = now()
  returning * into inserted;

  return inserted;
end;
$$;

create or replace function public.get_group_rankings(group_id uuid, period text)
returns table (
  profile_id uuid,
  nickname text,
  total_good_posture_seconds bigint,
  total_bad_posture_seconds bigint,
  total_away_seconds bigint,
  rank bigint
)
language sql
security definer
as $$
  with period_sessions as (
    select ss.*
    from public.study_sessions ss
    where ss.group_id = get_group_rankings.group_id
      and ss.ranking_mode = true
      and (
        (period = 'daily' and ss.started_at >= date_trunc('day', now()))
        or
        (period = 'weekly' and ss.started_at >= date_trunc('week', now()))
      )
  ),
  totals as (
    select
      p.id as profile_id,
      p.nickname,
      coalesce(sum(ps.good_posture_seconds), 0) as total_good_posture_seconds,
      coalesce(sum(ps.bad_posture_seconds), 0) as total_bad_posture_seconds,
      coalesce(sum(ps.away_seconds), 0) as total_away_seconds
    from public.group_members gm
    join public.profiles p on p.id = gm.profile_id
    left join period_sessions ps on ps.profile_id = p.id
    where gm.group_id = get_group_rankings.group_id
    group by p.id, p.nickname
  )
  select
    totals.profile_id,
    totals.nickname,
    totals.total_good_posture_seconds,
    totals.total_bad_posture_seconds,
    totals.total_away_seconds,
    dense_rank() over (order by totals.total_good_posture_seconds desc) as rank
  from totals
  order by rank, nickname;
$$;
```

- [ ] **Step 2: Add RLS section to the same migration**

Append:

```sql
alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.study_sessions enable row level security;

create policy "profiles are readable by group peers"
on public.profiles for select
using (
  exists (
    select 1
    from public.group_members mine
    join public.group_members peer on peer.group_id = mine.group_id
    where mine.profile_id = auth.uid()
      and peer.profile_id = profiles.id
  )
  or id = auth.uid()
);

create policy "groups are readable by members"
on public.groups for select
using (
  exists (
    select 1 from public.group_members gm
    where gm.group_id = groups.id and gm.profile_id = auth.uid()
  )
);

create policy "group members are readable by group members"
on public.group_members for select
using (
  exists (
    select 1 from public.group_members mine
    where mine.group_id = group_members.group_id and mine.profile_id = auth.uid()
  )
);

create policy "sessions are readable by group members"
on public.study_sessions for select
using (
  profile_id = auth.uid()
  or exists (
    select 1 from public.group_members gm
    where gm.group_id = study_sessions.group_id and gm.profile_id = auth.uid()
  )
);
```

Note for implementer: if MVP-2 uses anonymous local UUID profiles instead of Supabase Auth users, these policies need a token/auth model adjustment before production. Keep this migration as the SQL draft until the auth mode is finalized.

- [ ] **Step 3: Commit migration draft**

Run:

```powershell
git add supabase/migrations/20260701_mvp2_social.sql
git commit -m "docs: add mvp2 supabase migration draft"
```

Manual check assigned to user:

- Apply the SQL in a test Supabase project.
- Confirm functions are created.
- Confirm `create_group_with_invite_code` returns an invite code.

---

### Task 7: Replace Legacy Supabase Helper With Social Client

**Files:**
- Modify: `turtleguard/src/services/supabase.ts`
- Create: `turtleguard/src/services/socialClient.ts`

- [ ] **Step 1: Simplify Supabase client module**

Replace legacy leaderboard helpers in `src/services/supabase.ts` with:

```ts
import { createClient } from '@supabase/supabase-js';

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export function isSupabaseConfigured() {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

export const supabase = createClient(
  supabaseUrl || 'https://example.supabase.co',
  supabaseAnonKey || 'anonymous-key-not-configured',
);
```

- [ ] **Step 2: Create social client**

Create `src/services/socialClient.ts`:

```ts
import { isSupabaseConfigured, supabase } from './supabase';
import type { StudySessionUploadPayload } from './sessionPayload';

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
```

- [ ] **Step 3: Run typecheck and commit**

Run:

```powershell
npm run lint
```

Expected: TypeScript exits 0.

Commit:

```powershell
git add src/services/supabase.ts src/services/socialClient.ts
git commit -m "feat: add social rpc client"
```

---

### Task 8: Add Social Setup And Ranking Screens

**Files:**
- Create: `turtleguard/src/pages/SocialSetup.tsx`
- Create: `turtleguard/src/pages/GroupRanking.tsx`
- Modify: `turtleguard/src/components/AppShell.tsx`
- Modify: `turtleguard/src/services/settingsClient.ts`
- Modify: `turtleguard/src/types/electron.d.ts`

- [ ] **Step 1: Extend settings with profile and group fields**

In `src/types/electron.d.ts`, add to `TurtleSettings`:

```ts
profile_id: string | null;
nickname: string | null;
active_group_name: string | null;
active_group_invite_code: string | null;
```

Update `DEFAULT_SETTINGS` in `settingsClient.ts`:

```ts
profile_id: null,
nickname: null,
active_group_name: null,
active_group_invite_code: null,
```

Also update `electron/settingsStore.js` `DEFAULT_SETTINGS` and `normalizeSettings()` with the same fields.

- [ ] **Step 2: Create social setup page**

Create `src/pages/SocialSetup.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { settingsClient } from '../services/settingsClient';
import { socialClient } from '../services/socialClient';
import type { TurtleSettings } from '../types/electron';

export default function SocialSetup() {
  const [settings, setSettings] = useState<TurtleSettings | null>(null);
  const [nickname, setNickname] = useState('');
  const [groupName, setGroupName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    void settingsClient.get().then((loaded) => {
      setSettings(loaded);
      setNickname(loaded.nickname ?? '');
    });
  }, []);

  const saveProfile = async () => {
    setMessage('');
    const profile = await socialClient.createProfile(nickname);
    const next = await settingsClient.update({
      profile_id: profile.id,
      nickname: profile.nickname,
    });
    setSettings(next);
    setMessage('Profile saved.');
  };

  const createGroup = async () => {
    if (!settings?.profile_id) {
      setMessage('Create a profile first.');
      return;
    }

    const group = await socialClient.createGroup(settings.profile_id, groupName);
    const next = await settingsClient.update({
      last_selected_group_id: group.id,
      active_group_name: group.name,
      active_group_invite_code: group.invite_code,
    });
    setSettings(next);
    setMessage(`Group created. Invite code: ${group.invite_code}`);
  };

  const joinGroup = async () => {
    if (!settings?.profile_id) {
      setMessage('Create a profile first.');
      return;
    }

    const group = await socialClient.joinGroup(settings.profile_id, inviteCode);
    const next = await settingsClient.update({
      last_selected_group_id: group.id,
      active_group_name: group.name,
      active_group_invite_code: group.invite_code,
    });
    setSettings(next);
    setMessage(`Joined group: ${group.name}`);
  };

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-[#2C2C2A]/10 bg-white p-5">
        <h1 className="text-2xl font-bold">Social setup</h1>
        <p className="mt-1 text-sm text-[#2C2C2A]/60">
          Create a nickname profile, then create or join one group.
        </p>
      </div>

      <div className="rounded-lg border border-[#2C2C2A]/10 bg-white p-5">
        <label className="block text-sm font-medium">Nickname</label>
        <input
          value={nickname}
          onChange={(event) => setNickname(event.target.value)}
          className="mt-2 w-full rounded-md border border-[#2C2C2A]/20 px-3 py-2"
        />
        <button onClick={saveProfile} className="mt-3 rounded-md bg-[#2E7D63] px-4 py-2 text-white">
          Save profile
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-[#2C2C2A]/10 bg-white p-5">
          <label className="block text-sm font-medium">Create group</label>
          <input
            value={groupName}
            onChange={(event) => setGroupName(event.target.value)}
            className="mt-2 w-full rounded-md border border-[#2C2C2A]/20 px-3 py-2"
          />
          <button onClick={createGroup} className="mt-3 rounded-md bg-[#2E7D63] px-4 py-2 text-white">
            Create
          </button>
        </div>

        <div className="rounded-lg border border-[#2C2C2A]/10 bg-white p-5">
          <label className="block text-sm font-medium">Join with invite code</label>
          <input
            value={inviteCode}
            onChange={(event) => setInviteCode(event.target.value)}
            className="mt-2 w-full rounded-md border border-[#2C2C2A]/20 px-3 py-2"
          />
          <button onClick={joinGroup} className="mt-3 rounded-md bg-[#2E7D63] px-4 py-2 text-white">
            Join
          </button>
        </div>
      </div>

      {message && <p className="rounded-md bg-[#2E7D63]/10 p-3 text-sm text-[#2E7D63]">{message}</p>}
    </section>
  );
}
```

- [ ] **Step 3: Create ranking page**

Create `src/pages/GroupRanking.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { settingsClient } from '../services/settingsClient';
import { socialClient, type GroupRankingEntry } from '../services/socialClient';

type Period = 'daily' | 'weekly';

function formatSeconds(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function GroupRanking() {
  const [period, setPeriod] = useState<Period>('daily');
  const [groupId, setGroupId] = useState<string | null>(null);
  const [groupName, setGroupName] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [rankings, setRankings] = useState<GroupRankingEntry[]>([]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    void settingsClient.get().then((settings) => {
      setGroupId(settings.last_selected_group_id);
      setGroupName(settings.active_group_name);
      setInviteCode(settings.active_group_invite_code);
    });
  }, []);

  useEffect(() => {
    if (!groupId) {
      return;
    }

    void socialClient
      .getRankings(groupId, period)
      .then(setRankings)
      .catch((error) => setMessage(error instanceof Error ? error.message : 'Ranking load failed.'));
  }, [groupId, period]);

  if (!groupId) {
    return (
      <section className="rounded-lg border border-[#2C2C2A]/10 bg-white p-5">
        <h1 className="text-2xl font-bold">Group ranking</h1>
        <p className="mt-2 text-sm text-[#2C2C2A]/60">Create or join a group first.</p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-[#2C2C2A]/10 bg-white p-5">
        <h1 className="text-2xl font-bold">{groupName ?? 'Group ranking'}</h1>
        {inviteCode && <p className="mt-1 text-sm text-[#2C2C2A]/60">Invite code: {inviteCode}</p>}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setPeriod('daily')}
          className={`rounded-md px-4 py-2 ${period === 'daily' ? 'bg-[#2E7D63] text-white' : 'bg-white'}`}
        >
          Daily
        </button>
        <button
          onClick={() => setPeriod('weekly')}
          className={`rounded-md px-4 py-2 ${period === 'weekly' ? 'bg-[#2E7D63] text-white' : 'bg-white'}`}
        >
          Weekly
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border border-[#2C2C2A]/10 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#FBFBF9]">
            <tr>
              <th className="p-3">Rank</th>
              <th className="p-3">Nickname</th>
              <th className="p-3">Good posture time</th>
            </tr>
          </thead>
          <tbody>
            {rankings.map((entry) => (
              <tr key={entry.profile_id} className="border-t border-[#2C2C2A]/10">
                <td className="p-3">{entry.rank}</td>
                <td className="p-3">{entry.nickname}</td>
                <td className="p-3">{formatSeconds(entry.total_good_posture_seconds)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {message && <p className="rounded-md bg-[#D9534F]/10 p-3 text-sm text-[#D9534F]">{message}</p>}
    </section>
  );
}
```

- [ ] **Step 4: Add tabs**

Modify `AppShell.tsx` imports:

```ts
import { Activity, Cable, History, Trophy, Users } from 'lucide-react';
import SocialSetup from '../pages/SocialSetup';
import GroupRanking from '../pages/GroupRanking';
```

Change tab type:

```ts
type Tab = 'monitor' | 'hardware' | 'history' | 'social' | 'ranking';
```

Add tabs:

```ts
  { id: 'social' as const, label: 'Social', icon: Users },
  { id: 'ranking' as const, label: 'Ranking', icon: Trophy },
```

Add renders:

```tsx
          {tab === 'social' && <SocialSetup />}
          {tab === 'ranking' && <GroupRanking />}
```

- [ ] **Step 5: Run lean verification and commit**

Run:

```powershell
npm run lint
```

Expected: TypeScript exits 0.

Commit:

```powershell
git add electron/settingsStore.js src/types/electron.d.ts src/services/settingsClient.ts src/pages/SocialSetup.tsx src/pages/GroupRanking.tsx src/components/AppShell.tsx
git commit -m "feat: add social setup and ranking screens"
```

Manual check assigned to user:

- Enter nickname.
- Create a group.
- Copy invite code.
- Join group from another test profile if available.
- Open ranking tab and confirm the group appears.

---

### Task 9: Add Session Sync Queue

**Files:**
- Create: `turtleguard/src/services/sessionSync.ts`
- Modify: `turtleguard/src/pages/MainMonitor.tsx`
- Modify: `turtleguard/src/pages/LocalHistory.tsx`

- [ ] **Step 1: Create sync helper**

Create `src/services/sessionSync.ts`:

```ts
import { buildStudySessionPayload } from './sessionPayload';
import { settingsClient } from './settingsClient';
import { socialClient } from './socialClient';
import type { LocalSessionRecord } from './sessionClient';
import type { PostureStandard } from './postureStandard';

export async function syncEndedSession(
  session: LocalSessionRecord,
  rankingMode: boolean,
  postureStandard: PostureStandard,
): Promise<LocalSessionRecord> {
  const settings = await settingsClient.get();

  if (!settings.sync_enabled || !settings.profile_id) {
    return { ...session, sync_status: 'local_only' };
  }

  try {
    const payload = buildStudySessionPayload({
      session,
      profileId: settings.profile_id,
      groupId: rankingMode ? settings.last_selected_group_id : null,
      rankingMode,
      postureStandard,
    });

    await socialClient.uploadSession(payload);
    return { ...session, sync_status: 'synced' };
  } catch {
    return { ...session, sync_status: 'pending' };
  }
}
```

- [ ] **Step 2: Call sync after session finish**

In `MainMonitor.tsx`, import:

```ts
import { syncEndedSession } from '../services/sessionSync';
```

In `stopSession`, replace direct finish with:

```ts
    const finished = makeSession(
      runtime,
      sessionId,
      startedAt,
      new Date().toISOString(),
      'user_stopped',
      {
        groupId: null,
        rankingMode,
        postureStandard,
      },
    );
    const synced = await syncEndedSession(finished, rankingMode, postureStandard);
    await sessionClient.finish(synced);
```

- [ ] **Step 3: Show sync status in local history**

In `LocalHistory.tsx`, add a table column:

```tsx
<th className="p-3">Sync</th>
```

Add row value:

```tsx
<td className="p-3">{session.sync_status ?? 'local_only'}</td>
```

- [ ] **Step 4: Run lean verification and commit**

Run:

```powershell
npm run lint
```

Expected: TypeScript exits 0.

Commit:

```powershell
git add src/services/sessionSync.ts src/pages/MainMonitor.tsx src/pages/LocalHistory.tsx
git commit -m "feat: sync ended sessions"
```

---

### Task 10: Add MVP-2 Manual QA Checklist

**Files:**
- Create: `docs/releases/v0.2.0-manual-qa.md`

- [ ] **Step 1: Create manual QA checklist**

Create `docs/releases/v0.2.0-manual-qa.md`:

```md
# TurtleGuard v0.2.0 Manual QA

## Installer

- [ ] Build installer with `npm run build:electron`.
- [ ] Install the generated Windows setup file.
- [ ] Confirm the app opens without a white screen.

## Personal Posture Standard

- [ ] Start a personal session.
- [ ] Move posture standard to Sensitive.
- [ ] Confirm BAD appears more easily.
- [ ] Move posture standard to Relaxed.
- [ ] Confirm BAD appears less easily.
- [ ] Restart app and confirm selected standard persists.

## Ranking Fairness

- [ ] Enable ranking mode or start a group ranking session.
- [ ] Confirm posture standard is forced to Default.
- [ ] Confirm ranking notice is visible.
- [ ] End session and confirm uploaded payload records `ranking_mode = true`.
- [ ] Confirm uploaded payload records `posture_standard = default`.

## Social

- [ ] Create nickname profile.
- [ ] Create group and receive invite code.
- [ ] Join group with invite code from another profile if available.
- [ ] Complete ranking session.
- [ ] Confirm daily ranking updates.
- [ ] Confirm weekly ranking updates.

## Hardware Regression

- [ ] Arduino COM port appears.
- [ ] Auto-connect works.
- [ ] Servo test works.
- [ ] BAD posture sends extend signal.
- [ ] GOOD posture sends retract signal.
- [ ] App exit releases COM port.
```

- [ ] **Step 2: Run final automated checks**

Run:

```powershell
cd .\turtleguard
npm run test:mvp2
npm run test:node
npm run lint
```

Expected:

- MVP-2 focused tests pass.
- Existing Node tests pass.
- TypeScript exits 0.

- [ ] **Step 3: Commit**

Run:

```powershell
git add ..\docs\releases\v0.2.0-manual-qa.md
git commit -m "docs: add v0.2.0 manual qa checklist"
```

---

### Task 11: Build Test Installer And Hand Manual Checks To User

**Files:**
- No source files changed in this task.

- [ ] **Step 1: Build installer**

Run:

```powershell
cd .\turtleguard
npm run build:electron
```

Expected:

- Electron Builder exits 0.
- Installer appears under `turtleguard\dist`.

- [ ] **Step 2: Give user manual checklist**

Ask the user to run:

```text
docs/releases/v0.2.0-manual-qa.md
```

Do not spend model tokens trying to visually verify camera, Arduino, or installer behavior. The user manually checks these items.

- [ ] **Step 3: Commit only if build config or docs changed**

If no files changed after build, do not create a commit.

---

## Self-Review Checklist

- Spec coverage: Tasks 1-5 cover posture standard, local setting, personal/ranking mode, and payload rules. Tasks 6-9 cover Supabase schema, RPC client, social setup, ranking screen, and sync. Tasks 10-11 cover manual QA and release-candidate verification.
- Placeholder scan: This plan contains concrete files, code snippets, commands, and expected results.
- Type consistency: `PostureStandard`, `TurtleSettings`, `LocalSessionRecord`, and `StudySessionUploadPayload` names are introduced before later tasks use them.
- Manual validation policy: Installer, camera, Arduino, and Supabase live checks are assigned to the user through the checklist.
