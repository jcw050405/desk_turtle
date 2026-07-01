export type TurtlePostureState =
  | 'IDLE'
  | 'CALIBRATING'
  | 'GOOD'
  | 'BAD'
  | 'AWAY'
  | 'PAUSED'
  | 'ERROR';

export type TurtleHardwarePostureState = 'GOOD' | 'BAD';

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

export type TurtleSessionApi = {
  start: (payload?: unknown) => Promise<unknown>;
  pause: (payload?: unknown) => Promise<unknown>;
  resume: (payload?: unknown) => Promise<unknown>;
  end: (payload?: unknown) => Promise<unknown>;
  getDraft: () => Promise<unknown>;
};

export type TurtleSystemApi = {
  onSuspend: (callback: () => void) => () => void;
};

declare global {
  interface Window {
    turtleSerial?: TurtleSerialApi;
    turtleSession?: TurtleSessionApi;
    turtleSystem?: TurtleSystemApi;
  }
}

export {};
