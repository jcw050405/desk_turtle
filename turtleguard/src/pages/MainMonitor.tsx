import { useMemo, useRef, useState } from 'react';
import { sessionClient, type LocalSessionRecord } from '../services/sessionClient';
import { serialClient } from '../services/serialClient';
import {
  initialPostureRuntime,
  type PostureRuntime,
  type PostureState,
} from '../services/postureState';

function formatSeconds(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function makeSession(
  runtime: PostureRuntime,
  id: string,
  startedAt: string,
  endedAt: string | null,
  endedReason: string | null,
): LocalSessionRecord {
  const now = new Date().toISOString();
  return {
    id,
    started_at: startedAt,
    ended_at: endedAt,
    good_posture_seconds: runtime.counters.good_posture_seconds,
    bad_posture_seconds: runtime.counters.bad_posture_seconds,
    away_seconds: runtime.counters.away_seconds,
    warning_count: runtime.counters.warning_count,
    ended_reason: endedReason,
    created_at: startedAt,
    updated_at: now,
    sync_status: 'local_only',
  };
}

export default function MainMonitor() {
  const [runtime, setRuntime] = useState<PostureRuntime>(initialPostureRuntime());
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const intervalRef = useRef<number | null>(null);

  const statusLabel: Record<PostureState, string> = useMemo(
    () => ({
      IDLE: '대기 중',
      CALIBRATING: '기준 자세 측정 중',
      GOOD: '바른 자세',
      BAD: '거북목 감지',
      AWAY: '자리 비움',
      PAUSED: '일시정지',
      ERROR: '오류',
    }),
    [],
  );

  const startSession = async () => {
    const id = crypto.randomUUID();
    const start = new Date().toISOString();
    const initial = { ...initialPostureRuntime(), state: 'CALIBRATING' as const };

    setSessionId(id);
    setStartedAt(start);
    setRuntime(initial);
    await sessionClient.saveDraft(makeSession(initialPostureRuntime(), id, start, null, null));
    await serialClient.sendPostureState('GOOD');
  };

  const stopSession = async () => {
    if (!sessionId || !startedAt) {
      return;
    }

    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
    }
    intervalRef.current = null;

    await serialClient.sendPostureState('GOOD');
    await sessionClient.finish(
      makeSession(runtime, sessionId, startedAt, new Date().toISOString(), 'user_stopped'),
    );

    setSessionId(null);
    setStartedAt(null);
    setRuntime(initialPostureRuntime());
  };

  return (
    <section className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.6fr)]">
      <div className="rounded-lg border border-[#2C2C2A]/10 bg-[#1F1F1D] p-5 text-white">
        <div className="aspect-video rounded-md bg-black/50" />
        <p className="mt-3 text-sm text-white/60">
          카메라 미리보기와 자세 감지 오버레이가 여기에 표시됩니다.
        </p>
      </div>

      <aside className="space-y-4">
        <div className="rounded-lg border border-[#2C2C2A]/10 bg-white p-5">
          <p className="text-sm text-[#2C2C2A]/50">현재 상태</p>
          <p className="mt-1 text-3xl font-bold text-[#2C2C2A]">{statusLabel[runtime.state]}</p>
        </div>

        <div className="rounded-lg border border-[#2C2C2A]/10 bg-white p-5">
          <p className="text-sm text-[#2C2C2A]/50">바른 자세 시간</p>
          <p className="mt-1 font-mono text-3xl font-bold text-[#2E7D63]">
            {formatSeconds(runtime.counters.good_posture_seconds)}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-[#2C2C2A]/10 bg-white p-4">
            <p className="text-xs text-[#2C2C2A]/50">나쁜 자세</p>
            <p className="font-mono text-xl font-bold">
              {formatSeconds(runtime.counters.bad_posture_seconds)}
            </p>
          </div>
          <div className="rounded-lg border border-[#2C2C2A]/10 bg-white p-4">
            <p className="text-xs text-[#2C2C2A]/50">자리 비움</p>
            <p className="font-mono text-xl font-bold">
              {formatSeconds(runtime.counters.away_seconds)}
            </p>
          </div>
        </div>

        {!sessionId ? (
          <button
            onClick={startSession}
            className="w-full rounded-md bg-[#2E7D63] px-4 py-3 font-bold text-white"
          >
            세션 시작
          </button>
        ) : (
          <button
            onClick={stopSession}
            className="w-full rounded-md bg-[#D9534F] px-4 py-3 font-bold text-white"
          >
            세션 종료
          </button>
        )}
      </aside>
    </section>
  );
}
