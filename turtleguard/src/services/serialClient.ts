import type {
  TurtleHardwarePostureState,
  TurtleSerialApi,
  TurtleSerialPortInfo,
  TurtleSerialResult,
  TurtleSerialStatus,
} from '../types/electron';

const UNAVAILABLE_MESSAGE = 'Electron serial API is unavailable in this renderer';

export type DeviceResponseDescription = {
  title: string;
  detail: string;
  tone: 'success' | 'warning' | 'neutral';
};

export function describeDeviceResponse(
  lastReceived?: string | null,
): DeviceResponseDescription {
  if (!lastReceived) {
    return {
      title: 'No firmware response yet',
      detail: 'Run a servo test. If no ACK appears, close Arduino Serial Monitor and check the selected port.',
      tone: 'warning',
    };
  }

  if (lastReceived.startsWith('ACK:BAD:80')) {
    return {
      title: 'BAD command confirmed',
      detail: 'Firmware moved the MG90S servo to 80 degrees on GPIO3.',
      tone: 'success',
    };
  }

  if (lastReceived.startsWith('ACK:GOOD:10')) {
    return {
      title: 'GOOD command confirmed',
      detail: 'Firmware returned the MG90S servo to 10 degrees on GPIO3.',
      tone: 'success',
    };
  }

  if (lastReceived === 'READY:TURTLE') {
    return {
      title: 'Firmware ready',
      detail: 'ESP32-C3 firmware is running and waiting for commands.',
      tone: 'neutral',
    };
  }

  return {
    title: 'Device response received',
    detail: lastReceived,
    tone: 'neutral',
  };
}

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
