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
  });
});
