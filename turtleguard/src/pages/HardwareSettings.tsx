import { useEffect, useState } from 'react';
import { Cable, RefreshCcw, Unplug, Zap } from 'lucide-react';
import { serialClient } from '../services/serialClient';
import type { TurtleSerialPortInfo, TurtleSerialStatus } from '../types/electron';

export default function HardwareSettings() {
  const [ports, setPorts] = useState<TurtleSerialPortInfo[]>([]);
  const [selectedPath, setSelectedPath] = useState('');
  const [status, setStatus] = useState<TurtleSerialStatus>({ connected: false, path: null });
  const [message, setMessage] = useState('');

  const refresh = async () => {
    const nextPorts = await serialClient.listPorts();
    setPorts(nextPorts);
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

  useEffect(() => {
    void refresh();
    void serialClient.getStatus().then(setStatus);
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
            onClick={() => serialClient.testServo('extended')}
            className="rounded-md border px-4 py-2"
          >
            <Zap className="mr-2 inline h-4 w-4" />
            목 내밀기 테스트
          </button>
          <button
            onClick={() => serialClient.testServo('neutral')}
            className="rounded-md border px-4 py-2"
          >
            중립 위치
          </button>
        </div>

        {message && <p className="mt-4 text-sm text-[#2C2C2A]/70">{message}</p>}
      </div>
    </section>
  );
}
