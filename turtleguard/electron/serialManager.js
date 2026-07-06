import { SerialPort } from 'serialport';
import { sortPortsByArduinoLikelihood } from './serialPortScoring.js';

function toErrorMessage(error) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return String(error ?? 'Unknown serial error');
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export class SerialManager {
  constructor(options = {}) {
    this.getLastPath =
      typeof options.getLastPath === 'function' ? options.getLastPath : null;
    this.setLastPath =
      typeof options.setLastPath === 'function' ? options.setLastPath : null;
    this.baudRate = options.baudRate ?? 9600;
    this.readyDelayMs = options.readyDelayMs ?? 1500;
    this.commandTerminator = options.commandTerminator ?? '\n';
    this.responseTimeoutMs = options.responseTimeoutMs ?? 1000;
    this.port = null;
    this.readBuffer = '';
    this.pendingResponses = [];
    this.status = {
      connected: false,
      path: null,
      lastError: null,
      lastReceived: null,
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

    port.on('data', (chunk) => {
      this.handlePortData(chunk);
    });

    port.on('close', () => {
      if (this.port === port) {
        this.port = null;
        this.status = {
          connected: false,
          path: null,
          lastError: this.status.lastError,
          lastReceived: this.status.lastReceived,
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
      lastReceived: this.status.lastReceived ?? null,
    };

    if (this.readyDelayMs > 0) {
      await delay(this.readyDelayMs);
    }

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
    const value = postureState === 'BAD' ? '1' : '0';
    const expectedAck = postureState === 'BAD' ? 'ACK:BAD' : 'ACK:GOOD';
    const result = await this.writeValue(value, {
      expectedResponsePrefixes: [expectedAck],
      responseTimeoutMs: this.responseTimeoutMs,
    });

    if (result.ok && !result.confirmed) {
      return {
        ...result,
        ok: false,
        message: 'Command was sent, but TurtleGuard firmware did not acknowledge it',
      };
    }

    return result;
  }

  getStatus() {
    return {
      connected: this.status.connected,
      path: this.status.path,
      lastError: this.status.lastError,
      lastReceived: this.status.lastReceived ?? null,
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
      lastReceived: this.status.lastReceived ?? null,
    };
  }

  handlePortData(chunk) {
    this.readBuffer += chunk.toString('utf8');

    const lines = this.readBuffer.split(/\r?\n/);
    this.readBuffer = lines.pop() ?? '';

    for (const line of lines) {
      const message = line.trim();

      if (message) {
        this.status = {
          ...this.status,
          lastReceived: message,
        };
        this.resolvePendingResponses(message);
      }
    }
  }

  waitForResponse(prefixes, timeoutMs) {
    return new Promise((resolve) => {
      const entry = {
        prefixes,
        resolve,
        timeout: null,
      };

      entry.timeout = setTimeout(() => {
        this.pendingResponses = this.pendingResponses.filter((candidate) => candidate !== entry);
        resolve(null);
      }, timeoutMs);

      this.pendingResponses.push(entry);
    });
  }

  resolvePendingResponses(message) {
    const matched = this.pendingResponses.filter((entry) =>
      entry.prefixes.some((prefix) => message.startsWith(prefix)),
    );

    for (const entry of matched) {
      clearTimeout(entry.timeout);
      entry.resolve(message);
    }

    if (matched.length > 0) {
      this.pendingResponses = this.pendingResponses.filter((entry) => !matched.includes(entry));
    }
  }

  async writeValue(value, options = {}) {
    if (!this.port || !this.status.connected) {
      const message = 'Serial port is not connected';

      return {
        ok: false,
        value,
        message,
        ...this.getStatus(),
      };
    }

    const command = `${value}${this.commandTerminator}`;
    let responsePromise = null;

    if (Array.isArray(options.expectedResponsePrefixes)) {
      this.status = {
        ...this.status,
        lastReceived: null,
      };
      responsePromise = this.waitForResponse(
        options.expectedResponsePrefixes,
        options.responseTimeoutMs ?? this.responseTimeoutMs,
      );
    }

    try {
      await new Promise((resolve, reject) => {
        this.port.write(command, (error) => {
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

    const response = responsePromise ? await responsePromise : null;

    return {
      ok: true,
      value,
      sent: true,
      confirmed: Boolean(response),
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
        lastReceived: this.status.lastReceived ?? null,
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
        lastReceived: this.status.lastReceived ?? null,
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
      lastReceived: this.status.lastReceived ?? null,
    };

    return {
      ok: true,
      ...this.getStatus(),
    };
  }
}
