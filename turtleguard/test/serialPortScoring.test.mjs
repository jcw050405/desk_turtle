import test from 'node:test';
import assert from 'node:assert/strict';
import { scorePort, sortPortsByArduinoLikelihood } from '../electron/serialPortScoring.js';

test('scorePort prefers official Arduino vendor id', () => {
  const port = {
    path: 'COM3',
    vendorId: '2341',
    productId: '0043',
    manufacturer: 'Arduino LLC',
  };

  assert.equal(scorePort(port, null), 100);
});

test('scorePort prefers last successful path', () => {
  const port = {
    path: 'COM7',
    vendorId: '9999',
    manufacturer: 'Generic Peripheral',
  };

  assert.equal(scorePort(port, 'COM7'), 70);
});

test('scorePort keeps official Arduino vendor id stronger than last successful path', () => {
  const port = {
    path: 'COM3',
    vendorId: '2341',
    manufacturer: 'Arduino LLC',
  };

  assert.equal(scorePort(port, 'COM3'), 100);
});

test('scorePort keeps Arduino metadata stronger than last successful path', () => {
  const port = {
    path: 'COM4',
    vendorId: '9999',
    manufacturer: 'Arduino compatible board',
  };

  assert.equal(scorePort(port, 'COM4'), 100);
});

test('scorePort recognizes CH340 style adapters', () => {
  const port = {
    path: 'COM5',
    vendorId: '1A86',
    productId: '7523',
    manufacturer: 'USB-SERIAL CH340',
  };

  assert.equal(scorePort(port, null), 80);
});

test('scorePort recognizes ESP32-C3 native USB devices', () => {
  const port = {
    path: 'COM12',
    vendorId: '303A',
    productId: '1001',
    manufacturer: 'Espressif',
    product: 'USB JTAG/serial debug unit',
  };

  assert.equal(scorePort(port, null), 90);
});

test('scorePort recognizes ESP32-C3 descriptor text', () => {
  const port = {
    path: 'COM13',
    vendorId: '9999',
    manufacturer: 'Unknown',
    friendlyName: 'ESP32-C3 USB JTAG/serial (COM13)',
  };

  assert.equal(scorePort(port, null), 90);
});

test('scorePort keeps known chip vendor id stronger than last successful path', () => {
  const port = {
    path: 'COM5',
    vendorId: '1A86',
    productId: '7523',
    manufacturer: 'USB-SERIAL CH340',
  };

  assert.equal(scorePort(port, 'COM5'), 80);
});

test('scorePort keeps known chip metadata stronger than last successful path', () => {
  const port = {
    path: 'COM6',
    vendorId: '9999',
    manufacturer: 'FTDI USB Serial Device',
  };

  assert.equal(scorePort(port, 'COM6'), 75);
});

test('scorePort recognizes common adapter text from additional descriptor fields', () => {
  const port = {
    path: 'COM11',
    vendorId: '9999',
    manufacturer: 'QinHeng Electronics',
    friendlyName: 'USB-SERIAL CH340 (COM11)',
    pnpId: 'USB\\VID_1A86&PID_7523\\5&1111111&0&3',
    locationId: 'Port_#0003.Hub_#0001',
  };

  assert.equal(scorePort(port, null), 75);
});

test('sortPortsByArduinoLikelihood orders highest score first', () => {
  const ports = [
    { path: 'COM9', manufacturer: 'Bluetooth' },
    { path: 'COM5', manufacturer: 'USB-SERIAL CH340', vendorId: '1A86' },
    { path: 'COM3', manufacturer: 'Arduino LLC', vendorId: '2341' },
  ];

  const sorted = sortPortsByArduinoLikelihood(ports, null);

  assert.deepEqual(sorted.map((entry) => entry.path), ['COM3', 'COM5', 'COM9']);
});

test('sortPortsByArduinoLikelihood ranks ESP32-C3 above generic USB serial adapters', () => {
  const ports = [
    { path: 'COM9', manufacturer: 'Bluetooth' },
    { path: 'COM5', manufacturer: 'USB-SERIAL CH340', vendorId: '1A86' },
    { path: 'COM12', manufacturer: 'Espressif', vendorId: '303A' },
  ];

  const sorted = sortPortsByArduinoLikelihood(ports, null);

  assert.deepEqual(sorted.map((entry) => entry.path), ['COM12', 'COM5', 'COM9']);
});

test('sortPortsByArduinoLikelihood uses path order as a deterministic tie-break', () => {
  const ports = [
    { path: 'COM9', manufacturer: 'Unknown Device' },
    { path: 'COM2', manufacturer: 'Unknown Device' },
    { path: 'COM11', manufacturer: 'Unknown Device' },
  ];

  const sorted = sortPortsByArduinoLikelihood(ports, null);

  assert.deepEqual(sorted.map((entry) => entry.path), ['COM11', 'COM2', 'COM9']);
  assert.deepEqual(sorted.map((entry) => entry.score), [20, 20, 20]);
});
