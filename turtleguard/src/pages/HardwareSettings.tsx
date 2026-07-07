import { useEffect, useState } from 'react';
import { Cable, RefreshCcw, Unplug, Zap } from 'lucide-react';
import { describeDeviceResponse, serialClient } from '../services/serialClient';
import type { TurtleSerialPortInfo, TurtleSerialStatus } from '../types/electron';

export default function HardwareSettings() {
  const [ports, setPorts] = useState<TurtleSerialPortInfo[]>([]);
  const [selectedPath, setSelectedPath] = useState('');
  const [status, setStatus] = useState<TurtleSerialStatus>({ connected: false, path: null });
  const [message, setMessage] = useState('');
  const responseDescription = describeDeviceResponse(status.lastReceived);

  const refresh = async () => {
    const nextPorts = await serialClient.listPorts();
    const nextStatus = await serialClient.getStatus();
    setPorts(nextPorts);
    setStatus(nextStatus);
    setSelectedPath((current) => current || nextPorts[0]?.path || '');
  };

  const connect = async () => {
    if (!selectedPath) {
      setMessage('연결할 포트를 선택하세요.');
      return;
    }

    const nextStatus = await serialClient.connect(selectedPath);
    setStatus(nextStatus);
    setMessage(nextStatus.connected ? `${selectedPath}에 연결되었습니다.` : '연결하지 못했습니다.');
  };

  const autoConnect = async () => {
    const nextStatus = await serialClient.autoConnect();
    setStatus(nextStatus);
    setMessage(
      nextStatus.connected
        ? `${nextStatus.path}에 자동 연결되었습니다.`
        : '자동 연결할 아두이노를 찾지 못했습니다.',
    );
  };

  const disconnect = async () => {
    const nextStatus = await serialClient.disconnect();
    setStatus(nextStatus);
    setMessage('연결을 해제했습니다.');
  };

  const runServoTest = async (position: 'extended' | 'neutral') => {
    const label = position === 'extended' ? 'BAD / extended' : 'GOOD / neutral';
    setMessage(`Sending ${label} command...`);

    const result = await serialClient.testServo(position);
    const nextStatus = await serialClient.getStatus();
    setStatus(nextStatus);

    if (result.ok) {
      setMessage(
        `Servo command confirmed: ${result.lastReceived ?? nextStatus.lastReceived ?? result.value}`,
      );
      return;
    }

    setMessage(
      result.message ??
        `Servo command was sent, but no firmware ACK was received. Last response: ${
          nextStatus.lastReceived ?? 'none'
        }`,
    );
  };

  useEffect(() => {
    void refresh();
    void serialClient.getStatus().then(setStatus);
  }, []);

  useEffect(() => {
    const statusTimer = window.setInterval(() => {
      void serialClient.getStatus().then(setStatus);
    }, 2000);

    return () => window.clearInterval(statusTimer);
  }, []);

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-[#2C2C2A]">하드웨어 설정</h1>
        <p className="text-sm text-[#2C2C2A]/60">
          거북이 인형의 아두이노 포트를 자동으로 찾거나 직접 선택합니다.
        </p>
      </header>

      <div className="rounded-lg border border-[#2C2C2A]/10 bg-white p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-semibold">
            <Cable className="h-5 w-5 text-[#2E7D63]" />
            {status.connected ? `연결됨: ${status.path}` : '연결되지 않음'}
          </div>
          <button onClick={refresh} className="rounded-md border px-3 py-2 text-sm">
            <RefreshCcw className="mr-2 inline h-4 w-4" />
            새로고침
          </button>
        </div>

        {status.lastError && (
          <p className="mb-4 rounded-md bg-[#D9534F]/10 p-3 text-sm text-[#D9534F]">
            Serial error: {status.lastError}
          </p>
        )}

        <select
          value={selectedPath}
          onChange={(event) => setSelectedPath(event.target.value)}
          className="mb-4 w-full rounded-md border border-[#2C2C2A]/20 px-3 py-2"
        >
          <option value="">포트 선택</option>
          {ports.map((port) => (
            <option key={port.path} value={port.path}>
              {port.path}
              {port.manufacturer ? ` - ${port.manufacturer}` : ''}
              {typeof port.score === 'number' ? ` (score ${port.score})` : ''}
            </option>
          ))}
        </select>

        <div className="flex flex-wrap gap-3">
          <button onClick={autoConnect} className="rounded-md bg-[#2E7D63] px-4 py-2 text-white">
            자동 연결
          </button>
          <button onClick={connect} className="rounded-md bg-[#2C2C2A] px-4 py-2 text-white">
            연결
          </button>
          <button onClick={disconnect} className="rounded-md border px-4 py-2">
            <Unplug className="mr-2 inline h-4 w-4" />
            연결 해제
          </button>
          <button
            onClick={() => runServoTest('extended')}
            disabled={!status.connected}
            className="rounded-md border px-4 py-2"
          >
            <Zap className="mr-2 inline h-4 w-4" />
            목 내밀기 테스트
          </button>
          <button
            onClick={() => runServoTest('neutral')}
            disabled={!status.connected}
            className="rounded-md border px-4 py-2"
          >
            중립 위치
          </button>
        </div>

        {message && <p className="mt-4 text-sm text-[#2C2C2A]/70">{message}</p>}

        <div
          className={`mt-4 rounded-md border p-4 text-sm ${
            responseDescription.tone === 'success'
              ? 'border-[#2E7D63]/20 bg-[#2E7D63]/10 text-[#2E7D63]'
              : responseDescription.tone === 'warning'
                ? 'border-[#D9A441]/20 bg-[#D9A441]/10 text-[#7A5A12]'
                : 'border-[#2C2C2A]/10 bg-[#FBFBF9] text-[#2C2C2A]/70'
          }`}
        >
          <p className="font-semibold">{responseDescription.title}</p>
          <p className="mt-1">{responseDescription.detail}</p>
          {status.lastReceived && (
            <p className="mt-2 font-mono text-xs opacity-70">Raw: {status.lastReceived}</p>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-[#2C2C2A]/10 bg-white p-5">
        <h2 className="text-lg font-bold text-[#2C2C2A]">ESP32-C3 / MG90S checklist</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-[#2C2C2A]/70">
          <li>Servo signal wire is connected to GPIO3 on the ESP32-C3.</li>
          <li>MG90S power and ESP32-C3 GND share a common ground.</li>
          <li>Use a stable external 5V supply for the servo if USB power is weak.</li>
          <li>Close Arduino IDE Serial Monitor before using the app port.</li>
          <li>Firmware should print READY:TURTLE, then ACK:BAD:80 or ACK:GOOD:10 after tests.</li>
        </ul>
      </div>
    </section>
  );
}
