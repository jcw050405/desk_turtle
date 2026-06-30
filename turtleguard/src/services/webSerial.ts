/// <reference types="w3c-web-serial" />

type TurtleSerialStatus = {
  connected: boolean;
  path: string | null;
  lastError: string | null;
};

type TurtleSerialResult = TurtleSerialStatus & {
  ok: boolean;
  message?: string;
  value?: string;
};

type TurtleSerialApi = {
  listPorts: () => Promise<unknown[]>;
  autoConnect: () => Promise<TurtleSerialResult>;
  connect: (path: string) => Promise<TurtleSerialResult>;
  disconnect: () => Promise<TurtleSerialResult>;
  getStatus: () => Promise<TurtleSerialStatus>;
  sendPostureState: (state: 'BAD' | 'GOOD') => Promise<TurtleSerialResult>;
  testServo: (position: string) => Promise<TurtleSerialResult>;
};

type TurtleSystemApi = {
  onSuspend: (callback: () => void) => () => void;
};

declare global {
  interface Window {
    turtleSerial?: TurtleSerialApi;
    turtleSystem?: TurtleSystemApi;
  }
}

export class WebSerialService {
  private isConnected = false;
  private lastSignal: boolean | null = null;
  private lastSignalTime = 0;
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private removeSuspendListener: (() => void) | null = null;

  constructor() {
    this.bindSuspendListener();
    this.startPolling();
  }

  private bindSuspendListener() {
    if (typeof window === 'undefined' || !window.turtleSystem?.onSuspend) {
      return;
    }

    this.removeSuspendListener = window.turtleSystem.onSuspend(() => {
      this.markDisconnected();
    });
  }

  private startPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }

    this.pollInterval = setInterval(async () => {
      if (!this.isConnected) {
        await this.connect();
      }
    }, 3000);
  }

  private emitConnectionEvent(eventName: 'hardware-connected' | 'hardware-disconnected') {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(eventName));
    }
  }

  private markConnected() {
    const wasConnected = this.isConnected;
    this.isConnected = true;
    this.lastSignal = null;
    this.lastSignalTime = 0;

    if (!wasConnected) {
      this.emitConnectionEvent('hardware-connected');
    }
  }

  private markDisconnected(notify = false) {
    const wasConnected = this.isConnected;
    this.isConnected = false;
    this.lastSignal = null;
    this.lastSignalTime = 0;

    if (notify || wasConnected) {
      this.emitConnectionEvent('hardware-disconnected');
    }
  }

  async connect() {
    if (this.isConnected) {
      return true;
    }

    const turtleSerial = typeof window !== 'undefined' ? window.turtleSerial : undefined;
    if (!turtleSerial?.autoConnect) {
      return false;
    }

    try {
      const status = await turtleSerial.autoConnect();

      if (status.connected) {
        this.markConnected();
        return true;
      }

      this.markDisconnected();
      return false;
    } catch {
      this.markDisconnected();
      return false;
    }
  }

  async disconnect() {
    try {
      if (typeof window !== 'undefined' && window.turtleSerial?.disconnect) {
        await window.turtleSerial.disconnect();
      }
    } catch (error) {
      console.warn('Error closing serial connection', error);
    } finally {
      this.markDisconnected(true);
    }
  }

  async sendSignal(isBadPosture: boolean) {
    if (!this.isConnected) {
      return;
    }

    const now = Date.now();
    const isValueChanged = this.lastSignal !== isBadPosture;
    const isThrottled = now - this.lastSignalTime < 500;

    if (!isValueChanged && isThrottled) {
      return;
    }

    const turtleSerial = typeof window !== 'undefined' ? window.turtleSerial : undefined;
    if (!turtleSerial?.sendPostureState) {
      return;
    }

    try {
      const result = await turtleSerial.sendPostureState(isBadPosture ? 'BAD' : 'GOOD');

      if (result.ok && result.connected) {
        this.lastSignal = isBadPosture;
        this.lastSignalTime = now;
        return;
      }

      this.markDisconnected();
    } catch (error) {
      console.error('Exception writing posture state', error);
      this.markDisconnected();
    }
  }

  getConnected() {
    return this.isConnected;
  }
}

export const serialService = new WebSerialService();
