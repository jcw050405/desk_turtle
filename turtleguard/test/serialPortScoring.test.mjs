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

test('sortPortsByArduinoLikelihood orders highest score first', () => {
  const ports = [
    { path: 'COM9', manufacturer: 'Bluetooth' },
    { path: 'COM5', manufacturer: 'USB-SERIAL CH340', vendorId: '1A86' },
    { path: 'COM3', manufacturer: 'Arduino LLC', vendorId: '2341' },
  ];

  const sorted = sortPortsByArduinoLikelihood(ports, null);

  assert.deepEqual(sorted.map((entry) => entry.path), ['COM3', 'COM5', 'COM9']);
});
