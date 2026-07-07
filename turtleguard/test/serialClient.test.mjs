import assert from 'node:assert/strict';
import test from 'node:test';

import { describeDeviceResponse } from '../src/services/serialClient.ts';

test('device response explains BAD ACK for extended servo position', () => {
  assert.deepEqual(describeDeviceResponse('ACK:BAD:80'), {
    title: 'BAD command confirmed',
    detail: 'Firmware moved the MG90S servo to 80 degrees on GPIO3.',
    tone: 'success',
  });
});

test('device response explains GOOD ACK for neutral servo position', () => {
  assert.deepEqual(describeDeviceResponse('ACK:GOOD:10'), {
    title: 'GOOD command confirmed',
    detail: 'Firmware returned the MG90S servo to 10 degrees on GPIO3.',
    tone: 'success',
  });
});

test('device response explains firmware ready signal', () => {
  assert.deepEqual(describeDeviceResponse('READY:TURTLE'), {
    title: 'Firmware ready',
    detail: 'ESP32-C3 firmware is running and waiting for commands.',
    tone: 'neutral',
  });
});

test('device response explains missing ACK', () => {
  assert.deepEqual(describeDeviceResponse(null), {
    title: 'No firmware response yet',
    detail: 'Run a servo test. If no ACK appears, close Arduino Serial Monitor and check the selected port.',
    tone: 'warning',
  });
});

test('device response preserves unknown firmware messages', () => {
  assert.deepEqual(describeDeviceResponse('ERR:UNKNOWN:X'), {
    title: 'Device response received',
    detail: 'ERR:UNKNOWN:X',
    tone: 'neutral',
  });
});
