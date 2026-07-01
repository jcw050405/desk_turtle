import type {
  TurtleHardwarePostureState,
  TurtleSerialApi,
  TurtleSerialPortInfo,
  TurtleSerialResult,
  TurtleSerialStatus,
} from '../types/electron';

const UNAVAILABLE_MESSAGE = 'Electron serial API is unavailable in this renderer';

function getUnavailableStatus(
  overrides: Partial<TurtleSerialStatus> = {},
): TurtleSerialStatus {
  return {
    connected: false,
    path: null,
    lastError: UNAVAILABLE_MESSAGE,
    message: UNAVAILABLE_MESSAGE,
    reason: 'unavailable',
    ...overrides,
  };
}

function getUnavailableResult<TValue = string>(
  overrides: Partial<TurtleSerialResult<TValue>> = {},
): TurtleSerialResult<TValue> {
  return {
    ok: false,
    ...getUnavailableStatus(),
    ...overrides,
  };
}

function getSerialApi(): TurtleSerialApi | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }

  return window.turtleSerial;
}

export const serialClient = {
  async listPorts(): Promise<TurtleSerialPortInfo[]> {
    return (await getSerialApi()?.listPorts?.()) ?? [];
  },

  async autoConnect(): Promise<TurtleSerialResult> {
    return (await getSerialApi()?.autoConnect?.()) ?? getUnavailableResult();
  },

  async connect(path: string): Promise<TurtleSerialResult> {
    return (
      (await getSerialApi()?.connect?.(path)) ??
      getUnavailableResult({ message: 'Electron serial API is unavailable in this renderer' })
    );
  },

  async disconnect(): Promise<TurtleSerialResult> {
    return (await getSerialApi()?.disconnect?.()) ?? getUnavailableResult({ lastError: null });
  },

  async getStatus(): Promise<TurtleSerialStatus> {
    return (await getSerialApi()?.getStatus?.()) ?? getUnavailableStatus();
  },

  async sendPostureState(state: TurtleHardwarePostureState): Promise<TurtleSerialResult> {
    return (
      (await getSerialApi()?.sendPostureState?.(state)) ??
      getUnavailableResult({
        value: state === 'BAD' ? '1' : '0',
        sent: false,
        signal: state === 'BAD',
      })
    );
  },

  async testServo(position: string): Promise<TurtleSerialResult> {
    return (
      (await getSerialApi()?.testServo?.(position)) ??
      getUnavailableResult({ value: position })
    );
  },
};
