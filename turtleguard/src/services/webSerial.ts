/// <reference types="w3c-web-serial" />

import { serialClient } from './serialClient';

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

    try {
      const status = await serialClient.autoConnect();

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
      await serialClient.disconnect();
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

    try {
      const result = await serialClient.sendPostureState(isBadPosture ? 'BAD' : 'GOOD');

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
