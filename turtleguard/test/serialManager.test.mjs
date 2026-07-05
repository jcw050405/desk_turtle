import test from 'node:test';
import assert from 'node:assert/strict';
import { SerialManager } from '../electron/serialManager.js';

test('disconnect succeeds cleanly when there is no active port', async () => {
  const manager = new SerialManager();

  const result = await manager.disconnect();

  assert.deepEqual(result, {
    ok: true,
    connected: false,
    path: null,
    lastError: null,
    lastReceived: null,
  });
});

test('disconnect waits for close and clears the port on success', async () => {
  const manager = new SerialManager();
  let closeCalled = false;

  const port = {
    isOpen: true,
    path: 'COM7',
    close(callback) {
      closeCalled = true;
      this.isOpen = false;
      callback();
    },
  };

  manager.port = port;
  manager.status = {
    connected: true,
    path: 'COM7',
    lastError: null,
  };

  const result = await manager.disconnect();

  assert.equal(closeCalled, true);
  assert.equal(manager.port, null);
  assert.deepEqual(result, {
    ok: true,
    connected: false,
    path: null,
    lastError: null,
    lastReceived: null,
  });
});

test('disconnect preserves the live port and error details when close fails', async () => {
  const manager = new SerialManager();
  const port = {
    isOpen: true,
    path: 'COM9',
    close(callback) {
      callback(new Error('COM port is still busy'));
    },
  };

  manager.port = port;
  manager.status = {
    connected: true,
    path: 'COM9',
    lastError: null,
  };

  const result = await manager.disconnect();

  assert.equal(manager.port, port);
  assert.deepEqual(result, {
    ok: false,
    message: 'COM port is still busy',
    connected: true,
    path: 'COM9',
    lastError: 'COM port is still busy',
    lastReceived: null,
  });
});

test('sendPostureState writes newline-terminated ESP32-C3 commands', async () => {
  const manager = new SerialManager({ commandTerminator: '\n' });
  const writes = [];

  manager.port = {
    write(value, callback) {
      writes.push(value);
      callback();
    },
    drain(callback) {
      callback();
    },
  };
  manager.status = {
    connected: true,
    path: 'COM6',
    lastError: null,
    lastReceived: null,
  };

  const result = await manager.sendPostureState('BAD');

  assert.deepEqual(writes, ['1\n']);
  assert.deepEqual(result, {
    ok: true,
    value: '1',
    sent: true,
    connected: true,
    path: 'COM6',
    lastError: null,
    lastReceived: null,
  });
});

test('handlePortData keeps the latest non-empty device response', () => {
  const manager = new SerialManager();

  manager.handlePortData(Buffer.from('READY:TURTLE\nACK:BAD\n'));

  assert.equal(manager.getStatus().lastReceived, 'ACK:BAD');
});
