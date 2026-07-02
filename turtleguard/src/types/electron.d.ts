export type TurtlePostureState =
  | 'IDLE'
  | 'CALIBRATING'
  | 'GOOD'
  | 'BAD'
  | 'AWAY'
  | 'PAUSED'
  | 'ERROR';

export type TurtleHardwarePostureState = 'GOOD' | 'BAD';

export type TurtlePostureStandard =
  | 'very_sensitive'
  | 'sensitive'
  | 'default'
  | 'relaxed'
  | 'very_relaxed';

export type TurtleSerialPortInfo = {
  path: string;
  manufacturer?: string;
  vendorId?: string;
  productId?: string;
  serialNumber?: string;
  score?: number;
  pnpId?: string;
  friendlyName?: string;
  product?: string;
  locationId?: string;
};

export type TurtleSerialStatus = {
  connected: boolean;
  path: string | null;
  lastError?: string | null;
  message?: string;
  reason?: string;
};

export type TurtleSerialResult<TValue = string> = TurtleSerialStatus & {
  ok: boolean;
  value?: TValue;
  message?: string;
  reason?: string;
  sent?: boolean;
  signal?: boolean;
};

export type TurtleSerialApi = {
  listPorts: () => Promise<TurtleSerialPortInfo[]>;
  autoConnect: () => Promise<TurtleSerialResult>;
  connect: (path: string) => Promise<TurtleSerialResult>;
  disconnect: () => Promise<TurtleSerialResult>;
  getStatus: () => Promise<TurtleSerialStatus>;
  sendPostureState: (state: TurtleHardwarePostureState) => Promise<TurtleSerialResult>;
  testServo: (position: string) => Promise<TurtleSerialResult>;
};

export type LocalSessionRecord = {
  id: string;
  started_at: string;
  ended_at: string | null;
  group_id?: string | null;
  good_posture_seconds: number;
  bad_posture_seconds: number;
  away_seconds: number;
  warning_count: number;
  ended_reason: string | null;
  ranking_mode?: boolean;
  posture_standard?: TurtlePostureStandard;
  created_at: string;
  updated_at: string;
  sync_status: 'local_only' | 'pending_sync' | 'synced';
};

export type TurtleSessionApi = {
  list: () => Promise<LocalSessionRecord[]>;
  saveDraft: (payload: LocalSessionRecord) => Promise<LocalSessionRecord>;
  finish: (payload: Partial<LocalSessionRecord> & Pick<LocalSessionRecord, 'id'>) => Promise<LocalSessionRecord | null>;
  recoverOpen: () => Promise<LocalSessionRecord[]>;
};

export type TurtleSystemApi = {
  onSuspend: (callback: () => void) => () => void;
};

export interface TurtleSettings {
  posture_standard: TurtlePostureStandard;
  last_selected_group_id: string | null;
  sync_enabled: boolean;
}

export interface TurtleSettingsApi {
  get(): Promise<TurtleSettings>;
  update(patch: Partial<TurtleSettings>): Promise<TurtleSettings>;
}

declare global {
  interface Window {
    turtleSerial?: TurtleSerialApi;
    turtleSession?: TurtleSessionApi;
    turtleSettings?: TurtleSettingsApi;
    turtleSystem?: TurtleSystemApi;
  }
}

export {};
