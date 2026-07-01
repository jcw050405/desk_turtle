import { SerialPort } from 'serialport';
import { sortPortsByArduinoLikelihood } from './serialPortScoring.js';

function toErrorMessage(error) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return String(error ?? 'Unknown serial error');
}

export class SerialManager {
  constructor(options = {}) {
    this.getLastPath =
      typeof options.getLastPath === 'function' ? options.getLastPath : null;
    this.setLastPath =
      typeof options.setLastPath === 'function' ? options.setLastPath : null;
    this.baudRate = options.baudRate ?? 9600;
    this.port = null;
    this.status = {
      connected: false,
      path: null,
      lastError: null,
    };
    this.disconnectPromise = null;
  }

  async listPorts() {
    const ports = await SerialPort.list();
    const lastPath = this.getLastPath ? await this.getLastPath() : null;

    return sortPortsByArduinoLikelihood(ports, lastPath);
  }

  async autoConnect() {
    const ports = await this.listPorts();
    const candidate = ports.find((port) => Number(port.score) > 0);

    if (!candidate?.path) {
      this.status = {
        connected: false,
        path: null,
        lastError: 'No likely Arduino serial device found',
      };

      return {
        ok: false,
        message: 'No likely Arduino serial device found',
        ...this.getStatus(),
      };
    }

    return this.connect(candidate.path);
  }

  async connect(path) {
    if (!path) {
      this.status = {
        connected: false,
        path: null,
        lastError: 'Serial port path is required',
      };

      return {
        ok: false,
        message: 'Serial port path is required',
        ...this.getStatus(),
      };
    }

    await this.disconnect();

    const port = new SerialPort({
      path,
      baudRate: this.baudRate,
      autoOpen: false,
    });

    port.on('error', (error) => {
      this.handlePortError(port, error);
    });

    port.on('close', () => {
      if (this.port === port) {
        this.port = null;
        this.status = {
          connected: false,
          path: null,
          lastError: this.status.lastError,
        };
      }
    });

    try {
      await new Promise((resolve, reject) => {
        port.open((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    } catch (error) {
      const message = toErrorMessage(error);

      this.port = null;
      this.status = {
        connected: false,
        path: null,
        lastError: message,
      };

      return {
        ok: false,
        message,
        ...this.getStatus(),
      };
    }

    this.port = port;
    this.status = {
      connected: true,
      path,
      lastError: null,
    };

    if (this.setLastPath) {
      try {
        await this.setLastPath(path);
      } catch {
        // Persistence is best-effort and should not break a working connection.
      }
    }

    return {
      ok: true,
      ...this.getStatus(),
    };
  }

  async disconnect() {
    if (this.disconnectPromise) {
      return this.disconnectPromise;
    }

    this.disconnectPromise = this.performDisconnect();

    try {
      return await this.disconnectPromise;
    } finally {
      this.disconnectPromise = null;
    }
  }

  async sendPostureState(state) {
    const value = state === 'BAD' ? '1' : '0';

    return this.writeValue(value);
  }

  async testServo(position) {
    const postureState = position === 'extended' ? 'BAD' : 'GOOD';

    return this.sendPostureState(postureState);
  }

  getStatus() {
    return {
      connected: this.status.connected,
      path: this.status.path,
      lastError: this.status.lastError,
    };
  }

  handlePortError(port, error) {
    const message = toErrorMessage(error);

    if (this.port === port) {
      this.port = null;
    }

    this.status = {
      connected: false,
      path: null,
      lastError: message,
    };
  }

  async writeValue(value) {
    if (!this.port || !this.status.connected) {
      const message = 'Serial port is not connected';

      return {
        ok: false,
        value,
        message,
        ...this.getStatus(),
      };
    }

    try {
      await new Promise((resolve, reject) => {
        this.port.write(value, (error) => {
          if (error) {
            reject(error);
            return;
          }

          this.port.drain((drainError) => {
            if (drainError) {
              reject(drainError);
              return;
            }

            resolve();
          });
        });
      });
    } catch (error) {
      const message = toErrorMessage(error);

      this.handlePortError(this.port, error);

      return {
        ok: false,
        value,
        message,
        ...this.getStatus(),
      };
    }

    return {
      ok: true,
      value,
      ...this.getStatus(),
    };
  }

  async performDisconnect() {
    const port = this.port;

    if (!port || !port.isOpen) {
      if (this.port === port) {
        this.port = null;
      }

      this.status = {
        connected: false,
        path: null,
        lastError: null,
      };

      return {
        ok: true,
        ...this.getStatus(),
      };
    }

    try {
      await new Promise((resolve, reject) => {
        port.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    } catch (error) {
      const message = toErrorMessage(error);
      const hasLiveHandle = Boolean(port.isOpen);

      if (!hasLiveHandle && this.port === port) {
        this.port = null;
      }

      this.status = {
        connected: hasLiveHandle,
        path: hasLiveHandle ? port.path ?? this.status.path : null,
        lastError: message,
      };

      return {
        ok: false,
        message,
        ...this.getStatus(),
      };
    }

    if (this.port === port) {
      this.port = null;
    }

    this.status = {
      connected: false,
      path: null,
      lastError: null,
    };

    return {
      ok: true,
      ...this.getStatus(),
    };
  }
}
