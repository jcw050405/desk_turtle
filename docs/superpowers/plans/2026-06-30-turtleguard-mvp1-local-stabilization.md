# TurtleGuard MVP-1 Local Stabilization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stabilize TurtleGuard as a local Windows/macOS Electron desktop app that can detect posture, manage Arduino serial connections, track sessions locally, and run without Supabase.

**Architecture:** Electron main owns privileged capabilities: serial ports, local JSON session storage, app sleep/quit cleanup. The React renderer only calls preload-exposed APIs and renders monitor/settings/history screens. Posture detection remains local and lightweight, with explicit calibration and a GOOD/BAD/AWAY/PAUSED state machine.

**Tech Stack:** Electron 42, React 19, Vite 6, TypeScript 5.8, Tailwind CSS, MediaPipe FaceDetector, serialport 13, Node built-in `node:test` for pure main-process tests.

---

## Source And Scope

Work inside:

`C:\Users\jcw75\OneDrive\문서\desk_turtle\turtleguard`

Design reference:

`C:\Users\jcw75\OneDrive\문서\desk_turtle\docs\superpowers\specs\2026-06-30-turtleguard-design.md`

MVP-1 only:

- Implement Electron/preload/main serial architecture.
- Implement serial connection management.
- Refactor app UI into local desktop app screens.
- Strengthen calibration and posture states.
- Add local JSON session storage and recovery.
- Add sleep/quit cleanup.
- Do not implement Supabase group ranking.

## Planned File Structure

Create:

- `turtleguard/electron/serialPortScoring.js`: pure helper to rank likely Arduino ports.
- `turtleguard/electron/serialManager.js`: main-process serial connection owner.
- `turtleguard/electron/sessionStore.js`: main-process JSON session draft/history store.
- `turtleguard/preload.js`: safe renderer API bridge.
- `turtleguard/test/serialPortScoring.test.mjs`: Node tests for port scoring.
- `turtleguard/test/sessionStore.test.mjs`: Node tests for JSON session storage.
- `turtleguard/src/types/electron.d.ts`: renderer `window.turtleSerial` and `window.turtleSession` types.
- `turtleguard/src/services/serialClient.ts`: renderer wrapper around preload serial API.
- `turtleguard/src/services/sessionClient.ts`: renderer wrapper around preload session API.
- `turtleguard/src/services/postureState.ts`: posture state reducer and timer accounting helpers.
- `turtleguard/src/components/AppShell.tsx`: desktop app layout with tabs.
- `turtleguard/src/pages/MainMonitor.tsx`: camera/posture/session screen.
- `turtleguard/src/pages/HardwareSettings.tsx`: port connection screen.
- `turtleguard/src/pages/LocalHistory.tsx`: local session history screen.

Modify:

- `turtleguard/package.json`: test script, app name, Electron metadata if needed.
- `turtleguard/main.js`: secure Electron config, IPC registration, sleep/quit cleanup.
- `turtleguard/src/App.tsx`: use desktop app shell instead of marketing monitor.
- `turtleguard/src/services/poseDetection.ts`: explicit calibration result/failure API.
- `turtleguard/src/index.css`: keep global font/Tailwind, add app-level base styles if needed.

Defer:

- `turtleguard/src/services/supabase.ts`: leave unused for MVP-1 or remove imports from active UI.
- `turtleguard/src/pages/Monitor.tsx`: keep as legacy reference until the new screens replace it.

---

## Task 1: Baseline Verification And Package Scripts

**Files:**

- Modify: `turtleguard/package.json`

- [ ] **Step 1: Check the copied project structure**

Run:

```powershell
Get-ChildItem -Force -LiteralPath "C:\Users\jcw75\OneDrive\문서\desk_turtle\turtleguard"
```

Expected: `package.json`, `main.js`, `src`, `arduino`, `vite.config.ts`, and `package-lock.json` are present.

- [ ] **Step 2: Check whether dependencies are installed**

Run:

```powershell
Test-Path -LiteralPath "C:\Users\jcw75\OneDrive\문서\desk_turtle\turtleguard\node_modules"
```

Expected: `True` if installed, `False` if the next executor must run `npm install`.

- [ ] **Step 3: Add a Node test script**

Edit `turtleguard/package.json` and add `"test:node": "node --test"` to `scripts`.

Resulting scripts block:

```json
"scripts": {
  "dev": "vite --port=3000 --host=0.0.0.0",
  "electron:dev": "concurrently \"npm run dev\" \"electron .\"",
  "build:electron": "vite build && electron-builder",
  "build": "vite build",
  "preview": "vite preview",
  "clean": "rm -rf dist server.js",
  "lint": "tsc --noEmit",
  "test:node": "node --test"
}
```

- [ ] **Step 4: Run the baseline checks**

Run:

```powershell
npm run lint
```

Expected:

- If dependencies are installed: TypeScript output appears. Record all current errors before modifying code.
- If dependencies are not installed: command fails because modules are missing. Run `npm install` only after user approval if network is required.

Run:

```powershell
npm run test:node
```

Expected: Passes with zero tests or reports no matching tests before test files are added.

- [ ] **Step 5: Commit if this is a git repository**

Run:

```powershell
git status --short
```

If the project is a git repository:

```powershell
git add package.json
git commit -m "chore: add node test script"
```

If not a git repository, skip commits and note that the workspace is unversioned.

---

## Task 2: Serial Port Scoring Helper

**Files:**

- Create: `turtleguard/electron/serialPortScoring.js`
- Create: `turtleguard/test/serialPortScoring.test.mjs`

- [ ] **Step 1: Write the failing port scoring tests**

Create `turtleguard/test/serialPortScoring.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { scorePort, sortPortsByArduinoLikelihood } from '../electron/serialPortScoring.js';

test('scorePort prefers official Arduino vendor id', () => {
  const port = {
    path: 'COM3',
    vendorId: '2341',
    productId: '0043',
    manufacturer: 'Arduino LLC',
  };

  assert.equal(scorePort(port, null), 100);
});

test('scorePort prefers last successful path', () => {
  const port = {
    path: 'COM7',
    vendorId: '9999',
    manufacturer: 'Unknown USB Serial',
  };

  assert.equal(scorePort(port, 'COM7'), 70);
});

test('scorePort recognizes CH340 style adapters', () => {
  const port = {
    path: 'COM5',
    vendorId: '1A86',
    productId: '7523',
    manufacturer: 'USB-SERIAL CH340',
  };

  assert.equal(scorePort(port, null), 80);
});

test('sortPortsByArduinoLikelihood orders highest score first', () => {
  const ports = [
    { path: 'COM9', manufacturer: 'Bluetooth' },
    { path: 'COM5', manufacturer: 'USB-SERIAL CH340', vendorId: '1A86' },
    { path: 'COM3', manufacturer: 'Arduino LLC', vendorId: '2341' },
  ];

  const sorted = sortPortsByArduinoLikelihood(ports, null);

  assert.deepEqual(sorted.map((entry) => entry.path), ['COM3', 'COM5', 'COM9']);
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```powershell
npm run test:node -- test/serialPortScoring.test.mjs
```

Expected: FAIL because `electron/serialPortScoring.js` does not exist.

- [ ] **Step 3: Implement the scoring helper**

Create `turtleguard/electron/serialPortScoring.js`:

```js
const OFFICIAL_ARDUINO_VENDOR_IDS = new Set(['2341', '2A03']);
const COMMON_USB_SERIAL_VENDOR_IDS = new Set(['1A86', '10C4', '0403']);

function normalize(value) {
  return String(value ?? '').trim().toLowerCase();
}

export function scorePort(port, lastSuccessfulPath) {
  const path = normalize(port.path);
  const vendorId = normalize(port.vendorId).toUpperCase();
  const manufacturer = normalize(port.manufacturer);
  const productId = normalize(port.productId);
  const serialNumber = normalize(port.serialNumber);
  const searchText = `${path} ${manufacturer} ${productId} ${serialNumber}`;

  if (lastSuccessfulPath && path === normalize(lastSuccessfulPath)) {
    return 70;
  }

  if (OFFICIAL_ARDUINO_VENDOR_IDS.has(vendorId)) {
    return 100;
  }

  if (searchText.includes('arduino')) {
    return 95;
  }

  if (COMMON_USB_SERIAL_VENDOR_IDS.has(vendorId)) {
    return 80;
  }

  if (
    searchText.includes('ch340') ||
    searchText.includes('ch341') ||
    searchText.includes('usb serial') ||
    searchText.includes('usb-serial')
  ) {
    return 75;
  }

  if (path.startsWith('com') || path.includes('/dev/tty') || path.includes('/dev/cu')) {
    return 20;
  }

  return 0;
}

export function sortPortsByArduinoLikelihood(ports, lastSuccessfulPath) {
  return [...ports]
    .map((port) => ({
      ...port,
      score: scorePort(port, lastSuccessfulPath),
    }))
    .sort((a, b) => b.score - a.score || String(a.path).localeCompare(String(b.path)));
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run:

```powershell
npm run test:node -- test/serialPortScoring.test.mjs
```

Expected: PASS, 4 tests passing.

- [ ] **Step 5: Commit if available**

```powershell
git add electron/serialPortScoring.js test/serialPortScoring.test.mjs
git commit -m "feat: score likely arduino serial ports"
```

---

## Task 3: Main-Process Serial Manager And Secure Preload API

**Files:**

- Create: `turtleguard/electron/serialManager.js`
- Create: `turtleguard/preload.js`
- Modify: `turtleguard/main.js`

- [ ] **Step 1: Add the main-process serial manager**

Create `turtleguard/electron/serialManager.js`:

```js
import { SerialPort } from 'serialport';
import { sortPortsByArduinoLikelihood } from './serialPortScoring.js';

export class SerialManager {
  constructor({ getLastSuccessfulPath, setLastSuccessfulPath } = {}) {
    this.port = null;
    this.connectedPath = null;
    this.lastSignal = null;
    this.getLastSuccessfulPath = getLastSuccessfulPath ?? (() => null);
    this.setLastSuccessfulPath = setLastSuccessfulPath ?? (() => {});
  }

  async listPorts() {
    const ports = await SerialPort.list();
    return sortPortsByArduinoLikelihood(ports, this.getLastSuccessfulPath());
  }

  async autoConnect() {
    const ports = await this.listPorts();
    for (const port of ports) {
      if (port.score <= 0) continue;
      try {
        return await this.connect(port.path);
      } catch {
        await this.disconnect();
      }
    }
    return { connected: false, path: null, reason: 'NO_MATCHING_PORT' };
  }

  async connect(path) {
    if (!path || typeof path !== 'string') {
      throw new Error('Serial path is required.');
    }

    if (this.port?.isOpen && this.connectedPath === path) {
      return { connected: true, path };
    }

    await this.disconnect();

    this.port = new SerialPort({
      path,
      baudRate: 9600,
      autoOpen: false,
    });

    await new Promise((resolve, reject) => {
      this.port.open((error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    this.connectedPath = path;
    this.lastSignal = null;
    this.setLastSuccessfulPath(path);

    this.port.on('close', () => {
      this.connectedPath = null;
      this.port = null;
      this.lastSignal = null;
    });

    this.port.on('error', () => {
      void this.disconnect();
    });

    return { connected: true, path };
  }

  async disconnect() {
    const currentPort = this.port;
    this.port = null;
    this.connectedPath = null;
    this.lastSignal = null;

    if (!currentPort?.isOpen) {
      return { connected: false, path: null };
    }

    await new Promise((resolve) => {
      currentPort.close(() => resolve());
    });

    return { connected: false, path: null };
  }

  async sendPostureState(state) {
    const signal = state === 'BAD' ? '1' : '0';

    if (!this.port?.isOpen) {
      return { sent: false, reason: 'NOT_CONNECTED' };
    }

    if (this.lastSignal === signal) {
      return { sent: false, reason: 'UNCHANGED' };
    }

    await new Promise((resolve, reject) => {
      this.port.write(signal, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    this.lastSignal = signal;
    return { sent: true, signal };
  }

  async testServo(position) {
    if (position !== 'extended' && position !== 'neutral') {
      throw new Error('Servo test position must be extended or neutral.');
    }

    return this.sendPostureState(position === 'extended' ? 'BAD' : 'GOOD');
  }

  getStatus() {
    return {
      connected: Boolean(this.port?.isOpen && this.connectedPath),
      path: this.connectedPath,
    };
  }
}
```

- [ ] **Step 2: Add the preload bridge**

Create `turtleguard/preload.js`:

```js
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('turtleSerial', {
  listPorts: () => ipcRenderer.invoke('serial:listPorts'),
  autoConnect: () => ipcRenderer.invoke('serial:autoConnect'),
  connect: (path) => ipcRenderer.invoke('serial:connect', path),
  disconnect: () => ipcRenderer.invoke('serial:disconnect'),
  getStatus: () => ipcRenderer.invoke('serial:getStatus'),
  sendPostureState: (state) => ipcRenderer.invoke('serial:sendPostureState', state),
  testServo: (position) => ipcRenderer.invoke('serial:testServo', position),
});

contextBridge.exposeInMainWorld('turtleSession', {
  list: () => ipcRenderer.invoke('session:list'),
  saveDraft: (session) => ipcRenderer.invoke('session:saveDraft', session),
  finish: (session) => ipcRenderer.invoke('session:finish', session),
  recoverOpen: () => ipcRenderer.invoke('session:recoverOpen'),
});
```

- [ ] **Step 3: Replace insecure Electron settings and register serial IPC**

Modify `turtleguard/main.js` to:

```js
import { app, BrowserWindow, ipcMain, powerMonitor } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { SerialManager } from './electron/serialManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow = null;
let lastSuccessfulPath = null;

const serialManager = new SerialManager({
  getLastSuccessfulPath: () => lastSuccessfulPath,
  setLastSuccessfulPath: (pathValue) => {
    lastSuccessfulPath = pathValue;
  },
});

function registerSerialIpc() {
  ipcMain.handle('serial:listPorts', () => serialManager.listPorts());
  ipcMain.handle('serial:autoConnect', () => serialManager.autoConnect());
  ipcMain.handle('serial:connect', (_event, portPath) => serialManager.connect(portPath));
  ipcMain.handle('serial:disconnect', () => serialManager.disconnect());
  ipcMain.handle('serial:getStatus', () => serialManager.getStatus());
  ipcMain.handle('serial:sendPostureState', (_event, state) => serialManager.sendPostureState(state));
  ipcMain.handle('serial:testServo', (_event, position) => serialManager.testServo(position));
}

function registerPowerEvents() {
  powerMonitor.on('suspend', () => {
    mainWindow?.webContents.send('system:suspend');
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  const isDev =
    process.defaultApp ||
    /[\\/]electron-prebuilt[\\/]/.test(process.execPath) ||
    /[\\/]electron[\\/]/.test(process.execPath);

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));
  }
}

app.whenReady().then(() => {
  registerSerialIpc();
  registerPowerEvents();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('before-quit', async (event) => {
  event.preventDefault();
  await serialManager.disconnect();
  app.exit(0);
});

app.on('window-all-closed', async () => {
  await serialManager.disconnect();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
```

- [ ] **Step 4: Run type and node tests**

Run:

```powershell
npm run test:node -- test/serialPortScoring.test.mjs
npm run lint
```

Expected:

- Node tests pass.
- TypeScript either passes or shows pre-existing renderer errors. New preload/main JS should not create TypeScript errors unless referenced from TS without declarations.

- [ ] **Step 5: Commit if available**

```powershell
git add main.js preload.js electron/serialManager.js
git commit -m "feat: move serial control behind preload ipc"
```

---

## Task 4: Renderer Serial Types And Client Wrapper

**Files:**

- Create: `turtleguard/src/types/electron.d.ts`
- Create: `turtleguard/src/services/serialClient.ts`

- [ ] **Step 1: Add renderer global types**

Create `turtleguard/src/types/electron.d.ts`:

```ts
export type TurtlePostureState = 'IDLE' | 'CALIBRATING' | 'GOOD' | 'BAD' | 'AWAY' | 'PAUSED' | 'ERROR';

export interface TurtleSerialPortInfo {
  path: string;
  manufacturer?: string;
  vendorId?: string;
  productId?: string;
  serialNumber?: string;
  score?: number;
}

export interface TurtleSerialStatus {
  connected: boolean;
  path: string | null;
  reason?: string;
}

export interface TurtleSerialApi {
  listPorts(): Promise<TurtleSerialPortInfo[]>;
  autoConnect(): Promise<TurtleSerialStatus>;
  connect(path: string): Promise<TurtleSerialStatus>;
  disconnect(): Promise<TurtleSerialStatus>;
  getStatus(): Promise<TurtleSerialStatus>;
  sendPostureState(state: TurtlePostureState): Promise<{ sent: boolean; signal?: string; reason?: string }>;
  testServo(position: 'extended' | 'neutral'): Promise<{ sent: boolean; signal?: string; reason?: string }>;
}

export interface TurtleSessionApi {
  list(): Promise<unknown[]>;
  saveDraft(session: unknown): Promise<unknown>;
  finish(session: unknown): Promise<unknown>;
  recoverOpen(): Promise<unknown[]>;
}

declare global {
  interface Window {
    turtleSerial?: TurtleSerialApi;
    turtleSession?: TurtleSessionApi;
  }
}
```

- [ ] **Step 2: Add a renderer wrapper with browser-safe fallback**

Create `turtleguard/src/services/serialClient.ts`:

```ts
import type { TurtlePostureState, TurtleSerialPortInfo, TurtleSerialStatus } from '../types/electron';

const disconnected: TurtleSerialStatus = {
  connected: false,
  path: null,
  reason: 'SERIAL_API_UNAVAILABLE',
};

export const serialClient = {
  async listPorts(): Promise<TurtleSerialPortInfo[]> {
    return window.turtleSerial?.listPorts() ?? [];
  },

  async autoConnect(): Promise<TurtleSerialStatus> {
    return window.turtleSerial?.autoConnect() ?? disconnected;
  },

  async connect(path: string): Promise<TurtleSerialStatus> {
    return window.turtleSerial?.connect(path) ?? disconnected;
  },

  async disconnect(): Promise<TurtleSerialStatus> {
    return window.turtleSerial?.disconnect() ?? disconnected;
  },

  async getStatus(): Promise<TurtleSerialStatus> {
    return window.turtleSerial?.getStatus() ?? disconnected;
  },

  async sendPostureState(state: TurtlePostureState) {
    return window.turtleSerial?.sendPostureState(state) ?? { sent: false, reason: 'SERIAL_API_UNAVAILABLE' };
  },

  async testServo(position: 'extended' | 'neutral') {
    return window.turtleSerial?.testServo(position) ?? { sent: false, reason: 'SERIAL_API_UNAVAILABLE' };
  },
};
```

- [ ] **Step 3: Run TypeScript**

Run:

```powershell
npm run lint
```

Expected: No new errors from `serialClient.ts` or `electron.d.ts`.

- [ ] **Step 4: Commit if available**

```powershell
git add src/types/electron.d.ts src/services/serialClient.ts
git commit -m "feat: add renderer serial client"
```

---

## Task 5: Local JSON Session Store In Electron Main

**Files:**

- Create: `turtleguard/electron/sessionStore.js`
- Create: `turtleguard/test/sessionStore.test.mjs`
- Modify: `turtleguard/main.js`
- Create: `turtleguard/src/services/sessionClient.ts`

- [ ] **Step 1: Write failing session store tests**

Create `turtleguard/test/sessionStore.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { SessionStore } from '../electron/sessionStore.js';

test('SessionStore saves and recovers open draft sessions', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'turtleguard-session-'));
  try {
    const store = new SessionStore(dir);
    await store.saveDraft({
      id: 'session-1',
      started_at: '2026-06-30T00:00:00.000Z',
      ended_at: null,
      good_posture_seconds: 10,
      bad_posture_seconds: 2,
      away_seconds: 3,
      warning_count: 1,
      ended_reason: null,
      created_at: '2026-06-30T00:00:00.000Z',
      updated_at: '2026-06-30T00:00:15.000Z',
      sync_status: 'local_only',
    });

    const open = await store.recoverOpen();

    assert.equal(open.length, 1);
    assert.equal(open[0].id, 'session-1');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('SessionStore finish marks ended_at and ended_reason', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'turtleguard-session-'));
  try {
    const store = new SessionStore(dir);
    await store.saveDraft({
      id: 'session-2',
      started_at: '2026-06-30T00:00:00.000Z',
      ended_at: null,
      good_posture_seconds: 1,
      bad_posture_seconds: 0,
      away_seconds: 0,
      warning_count: 0,
      ended_reason: null,
      created_at: '2026-06-30T00:00:00.000Z',
      updated_at: '2026-06-30T00:00:01.000Z',
      sync_status: 'local_only',
    });

    await store.finish({
      id: 'session-2',
      ended_at: '2026-06-30T00:05:00.000Z',
      ended_reason: 'user_stopped',
      updated_at: '2026-06-30T00:05:00.000Z',
    });

    const open = await store.recoverOpen();
    const all = await store.list();

    assert.equal(open.length, 0);
    assert.equal(all[0].ended_reason, 'user_stopped');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```powershell
npm run test:node -- test/sessionStore.test.mjs
```

Expected: FAIL because `electron/sessionStore.js` does not exist.

- [ ] **Step 3: Implement the session store**

Create `turtleguard/electron/sessionStore.js`:

```js
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export class SessionStore {
  constructor(userDataPath) {
    this.filePath = path.join(userDataPath, 'sessions.json');
  }

  async ensureDir() {
    await mkdir(path.dirname(this.filePath), { recursive: true });
  }

  async readSessions() {
    try {
      const raw = await readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  async writeSessions(sessions) {
    await this.ensureDir();
    await writeFile(this.filePath, JSON.stringify(sessions, null, 2), 'utf8');
  }

  async list() {
    const sessions = await this.readSessions();
    return sessions.sort((a, b) => String(b.started_at).localeCompare(String(a.started_at)));
  }

  async saveDraft(session) {
    const sessions = await this.readSessions();
    const index = sessions.findIndex((existing) => existing.id === session.id);
    const nextSession = {
      ...session,
      ended_at: session.ended_at ?? null,
      ended_reason: session.ended_reason ?? null,
      sync_status: session.sync_status ?? 'local_only',
    };

    if (index >= 0) {
      sessions[index] = { ...sessions[index], ...nextSession };
    } else {
      sessions.push(nextSession);
    }

    await this.writeSessions(sessions);
    return nextSession;
  }

  async finish(partialSession) {
    const sessions = await this.readSessions();
    const index = sessions.findIndex((existing) => existing.id === partialSession.id);

    if (index < 0) {
      throw new Error(`Cannot finish missing session: ${partialSession.id}`);
    }

    sessions[index] = {
      ...sessions[index],
      ...partialSession,
      ended_at: partialSession.ended_at,
      ended_reason: partialSession.ended_reason,
    };

    await this.writeSessions(sessions);
    return sessions[index];
  }

  async recoverOpen() {
    const sessions = await this.readSessions();
    return sessions.filter((session) => !session.ended_at);
  }
}
```

- [ ] **Step 4: Register session IPC in `main.js`**

Modify `turtleguard/main.js`:

```js
import { SessionStore } from './electron/sessionStore.js';
```

Create store after `serialManager`:

```js
const sessionStore = new SessionStore(app.getPath('userData'));
```

Add function:

```js
function registerSessionIpc() {
  ipcMain.handle('session:list', () => sessionStore.list());
  ipcMain.handle('session:saveDraft', (_event, session) => sessionStore.saveDraft(session));
  ipcMain.handle('session:finish', (_event, session) => sessionStore.finish(session));
  ipcMain.handle('session:recoverOpen', () => sessionStore.recoverOpen());
}
```

Call it in `app.whenReady()` before `createWindow()`:

```js
registerSessionIpc();
```

- [ ] **Step 5: Add the renderer session wrapper**

Create `turtleguard/src/services/sessionClient.ts`:

```ts
export interface LocalSessionRecord {
  id: string;
  started_at: string;
  ended_at: string | null;
  good_posture_seconds: number;
  bad_posture_seconds: number;
  away_seconds: number;
  warning_count: number;
  ended_reason: string | null;
  created_at: string;
  updated_at: string;
  sync_status: 'local_only' | 'pending_sync' | 'synced';
}

export const sessionClient = {
  async list(): Promise<LocalSessionRecord[]> {
    return (window.turtleSession?.list() as Promise<LocalSessionRecord[]>) ?? [];
  },

  async saveDraft(session: LocalSessionRecord): Promise<LocalSessionRecord> {
    if (!window.turtleSession) return session;
    return window.turtleSession.saveDraft(session) as Promise<LocalSessionRecord>;
  },

  async finish(session: Partial<LocalSessionRecord> & { id: string }): Promise<LocalSessionRecord | null> {
    if (!window.turtleSession) return null;
    return window.turtleSession.finish(session) as Promise<LocalSessionRecord>;
  },

  async recoverOpen(): Promise<LocalSessionRecord[]> {
    return (window.turtleSession?.recoverOpen() as Promise<LocalSessionRecord[]>) ?? [];
  },
};
```

- [ ] **Step 6: Run tests and typecheck**

Run:

```powershell
npm run test:node -- test/sessionStore.test.mjs test/serialPortScoring.test.mjs
npm run lint
```

Expected: Node tests pass; TypeScript has no new errors from `sessionClient.ts`.

- [ ] **Step 7: Commit if available**

```powershell
git add electron/sessionStore.js test/sessionStore.test.mjs main.js src/services/sessionClient.ts preload.js
git commit -m "feat: add local session store ipc"
```

---

## Task 6: Posture State Machine

**Files:**

- Create: `turtleguard/src/services/postureState.ts`
- Modify: `turtleguard/src/services/poseDetection.ts`

- [ ] **Step 1: Add posture state types and accumulator helper**

Create `turtleguard/src/services/postureState.ts`:

```ts
export type PostureState = 'IDLE' | 'CALIBRATING' | 'GOOD' | 'BAD' | 'AWAY' | 'PAUSED' | 'ERROR';

export interface PostureCounters {
  good_posture_seconds: number;
  bad_posture_seconds: number;
  away_seconds: number;
  warning_count: number;
}

export interface PostureRuntime {
  state: PostureState;
  noFaceSince: number | null;
  counters: PostureCounters;
}

export interface DetectionInput {
  hasFace: boolean;
  isBadPosture: boolean;
  now: number;
  awayGraceMs: number;
}

export function initialPostureRuntime(): PostureRuntime {
  return {
    state: 'IDLE',
    noFaceSince: null,
    counters: {
      good_posture_seconds: 0,
      bad_posture_seconds: 0,
      away_seconds: 0,
      warning_count: 0,
    },
  };
}

export function nextPostureState(previous: PostureRuntime, input: DetectionInput): PostureRuntime {
  if (!input.hasFace) {
    const noFaceSince = previous.noFaceSince ?? input.now;
    const state = input.now - noFaceSince >= input.awayGraceMs ? 'AWAY' : previous.state;
    return { ...previous, state, noFaceSince };
  }

  const nextState: PostureState = input.isBadPosture ? 'BAD' : 'GOOD';
  const enteredBad = previous.state !== 'BAD' && nextState === 'BAD';

  return {
    ...previous,
    state: nextState,
    noFaceSince: null,
    counters: {
      ...previous.counters,
      warning_count: previous.counters.warning_count + (enteredBad ? 1 : 0),
    },
  };
}

export function addElapsedSecond(runtime: PostureRuntime): PostureRuntime {
  if (runtime.state === 'GOOD') {
    return {
      ...runtime,
      counters: {
        ...runtime.counters,
        good_posture_seconds: runtime.counters.good_posture_seconds + 1,
      },
    };
  }

  if (runtime.state === 'BAD') {
    return {
      ...runtime,
      counters: {
        ...runtime.counters,
        bad_posture_seconds: runtime.counters.bad_posture_seconds + 1,
      },
    };
  }

  if (runtime.state === 'AWAY') {
    return {
      ...runtime,
      counters: {
        ...runtime.counters,
        away_seconds: runtime.counters.away_seconds + 1,
      },
    };
  }

  return runtime;
}
```

- [ ] **Step 2: Replace silent calibration fallback with explicit result**

Modify `turtleguard/src/services/poseDetection.ts` so calibration completion returns success/failure.

Add types:

```ts
export interface CalibrationResult {
  ok: boolean;
  baselineScale?: number;
  reason?: 'NO_FACE_SAMPLES';
}
```

Change callback type:

```ts
private onCalibrationComplete?: (result: CalibrationResult) => void;
```

Change `startCalibration` signature:

```ts
startCalibration(onComplete: (result: CalibrationResult) => void) {
```

Replace the fallback block with:

```ts
      if (this.calibrationSamplesScale.length > 0) {
        this.baselineScale = this.calibrationSamplesScale.reduce((a, b) => a + b, 0) / this.calibrationSamplesScale.length;
        this.baselineY = this.calibrationSamplesY.reduce((a, b) => a + b, 0) / this.calibrationSamplesY.length;
        this.emaScale = this.baselineScale;

        if (this.onCalibrationComplete) {
          this.onCalibrationComplete({ ok: true, baselineScale: this.baselineScale });
        }
        return;
      }

      this.baselineScale = null;
      this.baselineY = null;
      this.emaScale = null;

      if (this.onCalibrationComplete) {
        this.onCalibrationComplete({ ok: false, reason: 'NO_FACE_SAMPLES' });
      }
```

- [ ] **Step 3: Run TypeScript**

Run:

```powershell
npm run lint
```

Expected: TypeScript errors appear where `Monitor.tsx` still expects the old callback shape. These will be fixed when new `MainMonitor.tsx` replaces old flow. If keeping `Monitor.tsx` temporarily breaks lint, update its `startCalibration` callback minimally:

```ts
postureDetector.startCalibration((result) => {
  if (!result.ok) {
    setAppState('IDLE');
    setCameraError(true);
    return;
  }
  setAppState('ACTIVE');
  setIsBossMode(true);
});
```

- [ ] **Step 4: Commit if available**

```powershell
git add src/services/postureState.ts src/services/poseDetection.ts src/pages/Monitor.tsx
git commit -m "feat: add explicit posture state helpers"
```

---

## Task 7: Hardware Settings Screen

**Files:**

- Create: `turtleguard/src/pages/HardwareSettings.tsx`

- [ ] **Step 1: Create the hardware settings screen**

Create `turtleguard/src/pages/HardwareSettings.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { Cable, RefreshCcw, Unplug, Zap } from 'lucide-react';
import { serialClient } from '../services/serialClient';
import type { TurtleSerialPortInfo, TurtleSerialStatus } from '../types/electron';

export default function HardwareSettings() {
  const [ports, setPorts] = useState<TurtleSerialPortInfo[]>([]);
  const [selectedPath, setSelectedPath] = useState('');
  const [status, setStatus] = useState<TurtleSerialStatus>({ connected: false, path: null });
  const [message, setMessage] = useState('');

  const refresh = async () => {
    const nextPorts = await serialClient.listPorts();
    setPorts(nextPorts);
    setSelectedPath((current) => current || nextPorts[0]?.path || '');
  };

  const connect = async () => {
    if (!selectedPath) {
      setMessage('연결할 포트를 선택하세요.');
      return;
    }
    const nextStatus = await serialClient.connect(selectedPath);
    setStatus(nextStatus);
    setMessage(nextStatus.connected ? `${selectedPath} 연결됨` : '연결하지 못했습니다.');
  };

  const autoConnect = async () => {
    const nextStatus = await serialClient.autoConnect();
    setStatus(nextStatus);
    setMessage(nextStatus.connected ? `${nextStatus.path} 자동 연결됨` : '자동 연결할 아두이노를 찾지 못했습니다.');
  };

  const disconnect = async () => {
    const nextStatus = await serialClient.disconnect();
    setStatus(nextStatus);
    setMessage('연결을 해제했습니다.');
  };

  useEffect(() => {
    void refresh();
    void serialClient.getStatus().then(setStatus);
  }, []);

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-[#2C2C2A]">하드웨어 설정</h1>
        <p className="text-sm text-[#2C2C2A]/60">아두이노 포트를 자동 탐색하거나 직접 선택합니다.</p>
      </header>

      <div className="rounded-lg border border-[#2C2C2A]/10 bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold">
            <Cable className="h-5 w-5 text-[#2E7D63]" />
            {status.connected ? `연결됨: ${status.path}` : '연결되지 않음'}
          </div>
          <button onClick={refresh} className="rounded-md border px-3 py-2 text-sm">
            <RefreshCcw className="mr-2 inline h-4 w-4" />
            새로고침
          </button>
        </div>

        <select
          value={selectedPath}
          onChange={(event) => setSelectedPath(event.target.value)}
          className="mb-4 w-full rounded-md border border-[#2C2C2A]/20 px-3 py-2"
        >
          <option value="">포트 선택</option>
          {ports.map((port) => (
            <option key={port.path} value={port.path}>
              {port.path} {port.manufacturer ? `- ${port.manufacturer}` : ''} {typeof port.score === 'number' ? `(score ${port.score})` : ''}
            </option>
          ))}
        </select>

        <div className="flex flex-wrap gap-3">
          <button onClick={autoConnect} className="rounded-md bg-[#2E7D63] px-4 py-2 text-white">
            자동 연결
          </button>
          <button onClick={connect} className="rounded-md bg-[#2C2C2A] px-4 py-2 text-white">
            연결
          </button>
          <button onClick={disconnect} className="rounded-md border px-4 py-2">
            <Unplug className="mr-2 inline h-4 w-4" />
            연결 해제
          </button>
          <button onClick={() => serialClient.testServo('extended')} className="rounded-md border px-4 py-2">
            <Zap className="mr-2 inline h-4 w-4" />
            목 내밀기 테스트
          </button>
          <button onClick={() => serialClient.testServo('neutral')} className="rounded-md border px-4 py-2">
            중립 위치
          </button>
        </div>

        {message && <p className="mt-4 text-sm text-[#2C2C2A]/70">{message}</p>}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Run TypeScript**

Run:

```powershell
npm run lint
```

Expected: No new errors from `HardwareSettings.tsx`.

- [ ] **Step 3: Commit if available**

```powershell
git add src/pages/HardwareSettings.tsx
git commit -m "feat: add hardware settings screen"
```

---

## Task 8: App Shell And Screen Routing

**Files:**

- Create: `turtleguard/src/components/AppShell.tsx`
- Create: `turtleguard/src/pages/LocalHistory.tsx`
- Create: `turtleguard/src/pages/MainMonitor.tsx`
- Modify: `turtleguard/src/App.tsx`

- [ ] **Step 1: Create local history screen**

Create `turtleguard/src/pages/LocalHistory.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { sessionClient, LocalSessionRecord } from '../services/sessionClient';

function formatSeconds(seconds: number) {
  const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
  const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
}

export default function LocalHistory() {
  const [sessions, setSessions] = useState<LocalSessionRecord[]>([]);

  useEffect(() => {
    void sessionClient.list().then(setSessions);
  }, []);

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-[#2C2C2A]">로컬 기록</h1>
        <p className="text-sm text-[#2C2C2A]/60">이 기록은 현재 컴퓨터에만 저장됩니다.</p>
      </header>

      <div className="overflow-hidden rounded-lg border border-[#2C2C2A]/10 bg-white">
        {sessions.length === 0 ? (
          <p className="p-6 text-sm text-[#2C2C2A]/50">아직 저장된 세션이 없습니다.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-[#FBFBF9] text-[#2C2C2A]/60">
              <tr>
                <th className="p-3">시작</th>
                <th className="p-3">바른 자세</th>
                <th className="p-3">나쁜 자세</th>
                <th className="p-3">자리비움</th>
                <th className="p-3">경고</th>
                <th className="p-3">상태</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((session) => (
                <tr key={session.id} className="border-t border-[#2C2C2A]/5">
                  <td className="p-3">{new Date(session.started_at).toLocaleString()}</td>
                  <td className="p-3">{formatSeconds(session.good_posture_seconds)}</td>
                  <td className="p-3">{formatSeconds(session.bad_posture_seconds)}</td>
                  <td className="p-3">{formatSeconds(session.away_seconds)}</td>
                  <td className="p-3">{session.warning_count}</td>
                  <td className="p-3">{session.ended_at ? session.ended_reason : '복구 필요'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Create a first-pass main monitor screen**

Create `turtleguard/src/pages/MainMonitor.tsx`:

```tsx
import { useMemo, useRef, useState } from 'react';
import { sessionClient, LocalSessionRecord } from '../services/sessionClient';
import { serialClient } from '../services/serialClient';
import { initialPostureRuntime, PostureRuntime, PostureState } from '../services/postureState';

function formatSeconds(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function makeSession(runtime: PostureRuntime, id: string, startedAt: string, endedAt: string | null, endedReason: string | null): LocalSessionRecord {
  const now = new Date().toISOString();
  return {
    id,
    started_at: startedAt,
    ended_at: endedAt,
    good_posture_seconds: runtime.counters.good_posture_seconds,
    bad_posture_seconds: runtime.counters.bad_posture_seconds,
    away_seconds: runtime.counters.away_seconds,
    warning_count: runtime.counters.warning_count,
    ended_reason: endedReason,
    created_at: startedAt,
    updated_at: now,
    sync_status: 'local_only',
  };
}

export default function MainMonitor() {
  const [runtime, setRuntime] = useState<PostureRuntime>(initialPostureRuntime());
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const intervalRef = useRef<number | null>(null);

  const statusLabel: Record<PostureState, string> = useMemo(() => ({
    IDLE: '대기 중',
    CALIBRATING: '기준 자세 측정 중',
    GOOD: '바른 자세',
    BAD: '거북목 감지',
    AWAY: '자리비움',
    PAUSED: '일시정지',
    ERROR: '오류',
  }), []);

  const startSession = async () => {
    const id = crypto.randomUUID();
    const start = new Date().toISOString();
    setSessionId(id);
    setStartedAt(start);
    setRuntime({ ...initialPostureRuntime(), state: 'CALIBRATING' });

    await sessionClient.saveDraft(makeSession(initialPostureRuntime(), id, start, null, null));
    await serialClient.sendPostureState('IDLE');
  };

  const stopSession = async () => {
    if (!sessionId || !startedAt) return;
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    intervalRef.current = null;
    await serialClient.sendPostureState('IDLE');
    await sessionClient.finish(makeSession(runtime, sessionId, startedAt, new Date().toISOString(), 'user_stopped'));
    setSessionId(null);
    setStartedAt(null);
    setRuntime(initialPostureRuntime());
  };

  return (
    <section className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.6fr)]">
      <div className="rounded-lg border border-[#2C2C2A]/10 bg-[#1F1F1D] p-5 text-white">
        <div className="aspect-video rounded-md bg-black/50" />
        <p className="mt-3 text-sm text-white/60">카메라 미리보기와 감지 오버레이가 여기에 표시됩니다.</p>
      </div>

      <aside className="space-y-4">
        <div className="rounded-lg border border-[#2C2C2A]/10 bg-white p-5">
          <p className="text-sm text-[#2C2C2A]/50">현재 상태</p>
          <p className="mt-1 text-3xl font-bold text-[#2C2C2A]">{statusLabel[runtime.state]}</p>
        </div>

        <div className="rounded-lg border border-[#2C2C2A]/10 bg-white p-5">
          <p className="text-sm text-[#2C2C2A]/50">바른 자세 시간</p>
          <p className="mt-1 text-3xl font-mono font-bold text-[#2E7D63]">{formatSeconds(runtime.counters.good_posture_seconds)}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-[#2C2C2A]/10 bg-white p-4">
            <p className="text-xs text-[#2C2C2A]/50">나쁜 자세</p>
            <p className="font-mono text-xl font-bold">{formatSeconds(runtime.counters.bad_posture_seconds)}</p>
          </div>
          <div className="rounded-lg border border-[#2C2C2A]/10 bg-white p-4">
            <p className="text-xs text-[#2C2C2A]/50">자리비움</p>
            <p className="font-mono text-xl font-bold">{formatSeconds(runtime.counters.away_seconds)}</p>
          </div>
        </div>

        {!sessionId ? (
          <button onClick={startSession} className="w-full rounded-md bg-[#2E7D63] px-4 py-3 font-bold text-white">
            세션 시작
          </button>
        ) : (
          <button onClick={stopSession} className="w-full rounded-md bg-[#D9534F] px-4 py-3 font-bold text-white">
            세션 종료
          </button>
        )}
      </aside>
    </section>
  );
}
```

- [ ] **Step 3: Create app shell**

Create `turtleguard/src/components/AppShell.tsx`:

```tsx
import { useState } from 'react';
import { Activity, Cable, History } from 'lucide-react';
import MainMonitor from '../pages/MainMonitor';
import HardwareSettings from '../pages/HardwareSettings';
import LocalHistory from '../pages/LocalHistory';

type Tab = 'monitor' | 'hardware' | 'history';

export default function AppShell() {
  const [tab, setTab] = useState<Tab>('monitor');

  return (
    <div className="min-h-screen bg-[#FBFBF9] text-[#2C2C2A]">
      <div className="mx-auto flex min-h-screen max-w-[1280px]">
        <nav className="w-64 border-r border-[#2C2C2A]/10 bg-white p-5">
          <div className="mb-8 flex items-center gap-2 text-xl font-bold text-[#2E7D63]">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[#2E7D63] text-white">T</span>
            TurtleGuard
          </div>

          <div className="space-y-2">
            <button onClick={() => setTab('monitor')} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left hover:bg-[#2E7D63]/10">
              <Activity className="h-4 w-4" />
              관제 화면
            </button>
            <button onClick={() => setTab('hardware')} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left hover:bg-[#2E7D63]/10">
              <Cable className="h-4 w-4" />
              하드웨어
            </button>
            <button onClick={() => setTab('history')} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left hover:bg-[#2E7D63]/10">
              <History className="h-4 w-4" />
              로컬 기록
            </button>
          </div>
        </nav>

        <main className="flex-1 p-8">
          {tab === 'monitor' && <MainMonitor />}
          {tab === 'hardware' && <HardwareSettings />}
          {tab === 'history' && <LocalHistory />}
        </main>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Switch App to the app shell**

Modify `turtleguard/src/App.tsx`:

```tsx
import AppShell from './components/AppShell';

export default function App() {
  return <AppShell />;
}
```

- [ ] **Step 5: Run TypeScript**

Run:

```powershell
npm run lint
```

Expected: New app shell files typecheck. If legacy `Monitor.tsx` produces errors because of the changed detector callback, either fix the callback minimally or remove `Monitor.tsx` imports from active code.

- [ ] **Step 6: Commit if available**

```powershell
git add src/App.tsx src/components/AppShell.tsx src/pages/MainMonitor.tsx src/pages/HardwareSettings.tsx src/pages/LocalHistory.tsx
git commit -m "feat: add local desktop app shell"
```

---

## Task 9: Integrate Camera, Calibration, And Timers In Main Monitor

**Files:**

- Modify: `turtleguard/src/pages/MainMonitor.tsx`
- Modify: `turtleguard/src/services/poseDetection.ts`

- [ ] **Step 1: Add camera refs and stream lifecycle to `MainMonitor.tsx`**

In `MainMonitor.tsx`, add imports:

```tsx
import { useCallback, useEffect } from 'react';
import { postureDetector } from '../services/poseDetection';
import { addElapsedSecond, nextPostureState } from '../services/postureState';
```

Add refs inside component:

```tsx
const videoRef = useRef<HTMLVideoElement>(null);
const canvasRef = useRef<HTMLCanvasElement>(null);
const streamRef = useRef<MediaStream | null>(null);
const animationRef = useRef<number | null>(null);
const lastProcessTimeRef = useRef(0);
```

Replace the placeholder camera div:

```tsx
<div className="relative aspect-video overflow-hidden rounded-md bg-black/50">
  <video ref={videoRef} playsInline muted className="absolute inset-0 h-full w-full scale-x-[-1] object-cover" />
  <canvas ref={canvasRef} width={320} height={240} className="absolute inset-0 h-full w-full scale-x-[-1] object-cover" />
</div>
```

- [ ] **Step 2: Implement start session camera and calibration flow**

Replace `startSession` body with:

```tsx
const startSession = async () => {
  const id = crypto.randomUUID();
  const start = new Date().toISOString();

  setSessionId(id);
  setStartedAt(start);
  setRuntime({ ...initialPostureRuntime(), state: 'CALIBRATING' });

  await sessionClient.saveDraft(makeSession(initialPostureRuntime(), id, start, null, null));

  try {
    await postureDetector.initialize();
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 320, height: 240, frameRate: { ideal: 10, max: 15 } },
    });

    streamRef.current = stream;

    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
    }

    postureDetector.startCalibration((result) => {
      if (!result.ok) {
        setRuntime((current) => ({ ...current, state: 'ERROR' }));
        return;
      }
      setRuntime((current) => ({ ...current, state: 'GOOD' }));
    });
  } catch {
    setRuntime((current) => ({ ...current, state: 'ERROR' }));
  }
};
```

- [ ] **Step 3: Add detection loop**

Add inside component:

```tsx
const detectLoop = useCallback((timestamp: number) => {
  if (!sessionId || !videoRef.current) return;

  if (timestamp - lastProcessTimeRef.current >= 500 && videoRef.current.readyState >= 2) {
    const result = postureDetector.detectPosture(videoRef.current, timestamp);

    setRuntime((current) => {
      const next = nextPostureState(current, {
        hasFace: Boolean(result),
        isBadPosture: Boolean(result?.isBadPosture),
        now: timestamp,
        awayGraceMs: 10_000,
      });

      void serialClient.sendPostureState(next.state);
      return next;
    });

    lastProcessTimeRef.current = timestamp;
  }

  animationRef.current = requestAnimationFrame(detectLoop);
}, [sessionId]);

useEffect(() => {
  if (!sessionId) return;
  animationRef.current = requestAnimationFrame(detectLoop);
  return () => {
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
  };
}, [detectLoop, sessionId]);
```

- [ ] **Step 4: Add one-second counter and draft persistence interval**

Add effect:

```tsx
useEffect(() => {
  if (!sessionId || !startedAt) return;

  const id = window.setInterval(() => {
    setRuntime((current) => {
      const next = addElapsedSecond(current);
      void sessionClient.saveDraft(makeSession(next, sessionId, startedAt, null, null));
      return next;
    });
  }, 1000);

  intervalRef.current = id;

  return () => window.clearInterval(id);
}, [sessionId, startedAt]);
```

- [ ] **Step 5: Clean up stream on stop**

In `stopSession`, before resetting runtime:

```tsx
streamRef.current?.getTracks().forEach((track) => track.stop());
streamRef.current = null;
if (animationRef.current) cancelAnimationFrame(animationRef.current);
animationRef.current = null;
```

- [ ] **Step 6: Run TypeScript**

Run:

```powershell
npm run lint
```

Expected: TypeScript passes for the integrated monitor. If strict React hook dependency warnings appear, fix them before proceeding.

- [ ] **Step 7: Manual camera check**

Run:

```powershell
npm run dev
```

In another terminal:

```powershell
npm run electron:dev
```

Expected:

- App opens.
- Session start asks for camera permission.
- Calibration state appears.
- If no face is visible during calibration, ERROR state appears.
- If face is visible, state changes to GOOD/BAD/AWAY according to detector output.

- [ ] **Step 8: Commit if available**

```powershell
git add src/pages/MainMonitor.tsx src/services/poseDetection.ts
git commit -m "feat: integrate camera posture state machine"
```

---

## Task 10: Sleep And Shutdown Session Closeout

**Files:**

- Modify: `turtleguard/preload.js`
- Modify: `turtleguard/src/types/electron.d.ts`
- Modify: `turtleguard/src/pages/MainMonitor.tsx`
- Modify: `turtleguard/main.js`

- [ ] **Step 1: Expose system suspend listener**

Modify `turtleguard/preload.js`:

```js
contextBridge.exposeInMainWorld('turtleSystem', {
  onSuspend: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('system:suspend', listener);
    return () => ipcRenderer.removeListener('system:suspend', listener);
  },
});
```

- [ ] **Step 2: Add type declaration**

Modify `turtleguard/src/types/electron.d.ts`:

```ts
export interface TurtleSystemApi {
  onSuspend(callback: () => void): () => void;
}
```

Add to `Window`:

```ts
turtleSystem?: TurtleSystemApi;
```

- [ ] **Step 3: Handle suspend in `MainMonitor.tsx`**

Add effect:

```tsx
useEffect(() => {
  if (!window.turtleSystem) return;

  return window.turtleSystem.onSuspend(() => {
    if (!sessionId || !startedAt) return;

    const endedAt = new Date().toISOString();
    void serialClient.sendPostureState('IDLE');
    void sessionClient.finish(makeSession(runtime, sessionId, startedAt, endedAt, 'system_sleep'));
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setSessionId(null);
    setStartedAt(null);
    setRuntime(initialPostureRuntime());
  });
}, [runtime, sessionId, startedAt]);
```

- [ ] **Step 4: Ensure main shutdown closes serial**

Review `main.js` and confirm both handlers exist:

```js
app.on('before-quit', async (event) => {
  event.preventDefault();
  await serialManager.disconnect();
  app.exit(0);
});

app.on('window-all-closed', async () => {
  await serialManager.disconnect();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
```

- [ ] **Step 5: Run TypeScript and node tests**

Run:

```powershell
npm run lint
npm run test:node
```

Expected: TypeScript and node tests pass.

- [ ] **Step 6: Commit if available**

```powershell
git add preload.js main.js src/types/electron.d.ts src/pages/MainMonitor.tsx
git commit -m "feat: close sessions and serial ports on suspend"
```

---

## Task 11: Performance Mode Control

**Files:**

- Modify: `turtleguard/src/pages/MainMonitor.tsx`

- [ ] **Step 1: Add performance mode state**

In `MainMonitor.tsx`, add:

```tsx
type PerformanceMode = 'low_power' | 'default' | 'accuracy';

const PERFORMANCE_INTERVAL_MS: Record<PerformanceMode, number> = {
  low_power: 1000,
  default: 500,
  accuracy: 300,
};
```

Inside component:

```tsx
const [performanceMode, setPerformanceMode] = useState<PerformanceMode>('default');
```

- [ ] **Step 2: Use selected interval in detect loop**

Replace:

```tsx
if (timestamp - lastProcessTimeRef.current >= 500 && videoRef.current.readyState >= 2) {
```

With:

```tsx
if (timestamp - lastProcessTimeRef.current >= PERFORMANCE_INTERVAL_MS[performanceMode] && videoRef.current.readyState >= 2) {
```

Add `performanceMode` to the `detectLoop` dependency array.

- [ ] **Step 3: Add UI selector**

Add near session controls:

```tsx
<label className="block rounded-lg border border-[#2C2C2A]/10 bg-white p-4">
  <span className="mb-2 block text-sm text-[#2C2C2A]/50">성능 모드</span>
  <select
    value={performanceMode}
    onChange={(event) => setPerformanceMode(event.target.value as PerformanceMode)}
    className="w-full rounded-md border border-[#2C2C2A]/20 px-3 py-2"
  >
    <option value="low_power">저전력</option>
    <option value="default">기본</option>
    <option value="accuracy">정확도</option>
  </select>
</label>
```

- [ ] **Step 4: Run TypeScript**

Run:

```powershell
npm run lint
```

Expected: TypeScript passes.

- [ ] **Step 5: Commit if available**

```powershell
git add src/pages/MainMonitor.tsx
git commit -m "feat: add posture detection performance modes"
```

---

## Task 12: Final MVP-1 Verification

**Files:**

- Verify only.

- [ ] **Step 1: Run all available automated checks**

Run:

```powershell
npm run test:node
npm run lint
npm run build
```

Expected:

- Node tests pass.
- TypeScript passes.
- Vite build succeeds.

- [ ] **Step 2: Run Electron dev flow**

Run:

```powershell
npm run electron:dev
```

Expected:

- App opens with desktop shell.
- App does not expose renderer Node APIs.
- Hardware settings can list ports.
- Hardware settings does not crash when no Arduino is connected.
- Manual connect attempts show a clear result.
- Servo test sends only through main-process serial manager.

- [ ] **Step 3: Manual camera behavior checklist**

Verify:

```text
[ ] Camera permission prompt appears only after session start.
[ ] Calibration starts before tracking.
[ ] Calibration failure is visible if no face is detected.
[ ] GOOD/BAD/AWAY/PAUSED labels are visible.
[ ] AWAY time does not increase good posture time.
[ ] Ending session writes local history.
[ ] Reopening app can show local history.
```

- [ ] **Step 4: Manual interruption checklist**

Verify:

```text
[ ] Stop session closes camera tracks.
[ ] Closing the app closes serial port.
[ ] Disconnecting Arduino changes connection status.
[ ] Camera loss during session goes PAUSED or ERROR without crashing.
[ ] Sleep handling ends the session or records safe closeout.
```

- [ ] **Step 5: Build Electron package if dependencies and platform allow**

Run:

```powershell
npm run build:electron
```

Expected:

- Windows build is produced on Windows.
- macOS build may need a macOS host; document that limitation if running on Windows.

- [ ] **Step 6: Document remaining limitations**

Create or update `turtleguard/README.md` section:

```md
## MVP-1 Test Notes

- Core posture tracking is local.
- Supabase ranking is not part of MVP-1.
- Hardware is optional; the app can run without Arduino.
- Windows test build can be produced from Windows.
- macOS build should be produced and tested on macOS.
```

- [ ] **Step 7: Commit final MVP-1 verification docs if available**

```powershell
git add README.md
git commit -m "docs: record mvp1 test notes"
```

---

## Self-Review Checklist

Spec coverage:

- Electron security and preload IPC: Tasks 3, 4.
- Serial auto-detect/manual selection/cleanup: Tasks 2, 3, 7, 10.
- Desktop app screen refactor: Tasks 7, 8.
- Calibration explicit failure: Tasks 6, 9.
- GOOD/BAD/AWAY/PAUSED state machine: Tasks 6, 9.
- Local JSON session storage: Task 5.
- Session recovery and sleep handling: Tasks 5, 10.
- Performance modes: Task 11.
- MVP-1 verification: Task 12.
- Supabase deferred: stated in scope and excluded from tasks.

Placeholder scan:

- No `TBD`, `TODO`, `FIXME`, or "implement later" instructions are intended.
- Every task names exact files and commands.

Type consistency:

- Renderer state uses `PostureState` / `TurtlePostureState` values: `IDLE`, `CALIBRATING`, `GOOD`, `BAD`, `AWAY`, `PAUSED`, `ERROR`.
- Serial state contract maps `BAD` to `1`, all neutral states to `0`.
- Local session fields match the design document.

