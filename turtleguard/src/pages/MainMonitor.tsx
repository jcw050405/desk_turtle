import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { sessionClient, type LocalSessionRecord } from '../services/sessionClient';
import { serialClient } from '../services/serialClient';
import { postureDetector } from '../services/poseDetection';
import { settingsClient } from '../services/settingsClient';
import {
  DEFAULT_POSTURE_STANDARD,
  getEffectivePostureStandard,
  type PostureStandard,
} from '../services/postureStandard';
import {
  addElapsedSecond,
  initialPostureRuntime,
  nextPostureState,
  type PostureRuntime,
  type PostureState,
} from '../services/postureState';

type PerformanceMode = 'low_power' | 'default' | 'accuracy';

const PERFORMANCE_INTERVAL_MS: Record<PerformanceMode, number> = {
  low_power: 1000,
  default: 500,
  accuracy: 300,
};

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
  const [message, setMessage] = useState('');
  const [performanceMode, setPerformanceMode] = useState<PerformanceMode>('default');
  const [postureStandard, setPostureStandard] =
    useState<PostureStandard>(DEFAULT_POSTURE_STANDARD);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number | null>(null);
  const lastProcessTimeRef = useRef(0);
  const intervalRef = useRef<number | null>(null);
  const rankingMode = false;
  const effectivePostureStandard = getEffectivePostureStandard(postureStandard, rankingMode);

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

  const cleanupCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    animationRef.current = null;

    const context = canvasRef.current?.getContext('2d');
    if (context && canvasRef.current) {
      context.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  }, []);

  useEffect(() => {
    void settingsClient.get().then((settings) => {
      setPostureStandard(settings.posture_standard);
    });
  }, []);

  const drawDetection = useCallback((boundingBox: unknown) => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) {
      return;
    }

    context.clearRect(0, 0, canvas.width, canvas.height);

    if (
      !boundingBox ||
      typeof boundingBox !== 'object' ||
      !('originX' in boundingBox) ||
      !('originY' in boundingBox) ||
      !('width' in boundingBox) ||
      !('height' in boundingBox)
    ) {
      return;
    }

    const box = boundingBox as { originX: number; originY: number; width: number; height: number };
    context.strokeStyle = runtime.state === 'BAD' ? '#D9534F' : '#2E7D63';
    context.lineWidth = 3;
    context.strokeRect(
      box.originX * canvas.width,
      box.originY * canvas.height,
      box.width * canvas.width,
      box.height * canvas.height,
    );
  }, [runtime.state]);

  const startSession = async () => {
    const id = crypto.randomUUID();
    const start = new Date().toISOString();
    const initial = { ...initialPostureRuntime(), state: 'CALIBRATING' as const };

    setSessionId(id);
    setStartedAt(start);
    setRuntime(initial);
    setMessage('카메라를 준비하고 기준 자세를 측정합니다.');
    await sessionClient.saveDraft(makeSession(initialPostureRuntime(), id, start, null, null));
    await serialClient.sendPostureState('GOOD');

    try {
      await postureDetector.initialize();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, frameRate: { ideal: 10, max: 15 } },
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      postureDetector.startCalibration((result) => {
        if (!result.ok) {
          setRuntime((current) => ({ ...current, state: 'ERROR' }));
          setMessage('기준 자세를 잡지 못했습니다. 얼굴이 보이도록 앉은 뒤 다시 시작하세요.');
          return;
        }

        setRuntime((current) => ({ ...current, state: 'GOOD' }));
        setMessage('기준 자세가 등록되었습니다.');
      });
    } catch {
      cleanupCamera();
      setRuntime((current) => ({ ...current, state: 'ERROR' }));
      setMessage('카메라를 시작하지 못했습니다. 권한과 장치 상태를 확인하세요.');
    }
  };

  const stopSession = async () => {
    if (!sessionId || !startedAt) {
      return;
    }

    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
    }
    intervalRef.current = null;

    cleanupCamera();
    await serialClient.sendPostureState('GOOD');
    await sessionClient.finish(
      makeSession(runtime, sessionId, startedAt, new Date().toISOString(), 'user_stopped'),
    );

    setSessionId(null);
    setStartedAt(null);
    setRuntime(initialPostureRuntime());
    setMessage('세션을 종료했습니다.');
  };

  const detectLoop = useCallback((timestamp: number) => {
    if (!sessionId || !videoRef.current) {
      return;
    }

    if (
      timestamp - lastProcessTimeRef.current >= PERFORMANCE_INTERVAL_MS[performanceMode] &&
      videoRef.current.readyState >= 2
    ) {
      const result = postureDetector.detectPosture(
        videoRef.current,
        timestamp,
        effectivePostureStandard,
      );

      setRuntime((current) => {
        if (current.state === 'CALIBRATING') {
          if (result?.detection.boundingBox) {
            drawDetection(result.detection.boundingBox);
          }
          return current;
        }

        const next = nextPostureState(current, {
          hasFace: Boolean(result),
          isBadPosture: Boolean(result?.isBadPosture),
          now: timestamp,
          awayGraceMs: 10_000,
        });

        if (result?.detection.boundingBox) {
          drawDetection(result.detection.boundingBox);
        }

        void serialClient.sendPostureState(next.state === 'BAD' ? 'BAD' : 'GOOD');
        return next;
      });

      lastProcessTimeRef.current = timestamp;
    }

    animationRef.current = requestAnimationFrame(detectLoop);
  }, [drawDetection, effectivePostureStandard, performanceMode, sessionId]);

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    animationRef.current = requestAnimationFrame(detectLoop);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [detectLoop, sessionId]);

  useEffect(() => {
    if (!sessionId || !startedAt) {
      return;
    }

    const id = window.setInterval(() => {
      setRuntime((current) => {
        const next = addElapsedSecond(current);
        void sessionClient.saveDraft(makeSession(next, sessionId, startedAt, null, null));
        return next;
      });
    }, 1000);

    intervalRef.current = id;

    return () => window.clearInterval(id);
  }, [sessionId, startedAt]);

  useEffect(() => {
    if (!window.turtleSystem) {
      return;
    }

    return window.turtleSystem.onSuspend(() => {
      if (!sessionId || !startedAt) {
        return;
      }

      const endedAt = new Date().toISOString();
      cleanupCamera();
      void serialClient.sendPostureState('GOOD');
      void sessionClient.finish(makeSession(runtime, sessionId, startedAt, endedAt, 'system_sleep'));
      setSessionId(null);
      setStartedAt(null);
      setRuntime(initialPostureRuntime());
      setMessage('컴퓨터 절전 신호로 세션을 안전하게 종료했습니다.');
    });
  }, [cleanupCamera, runtime, sessionId, startedAt]);

  return (
    <section className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.6fr)]">
      <div className="rounded-lg border border-[#2C2C2A]/10 bg-[#1F1F1D] p-5 text-white">
        <div className="relative aspect-video overflow-hidden rounded-md bg-black/50">
          <video
            ref={videoRef}
            playsInline
            muted
            className="absolute inset-0 h-full w-full scale-x-[-1] object-cover"
          />
          <canvas
            ref={canvasRef}
            width={320}
            height={240}
            className="absolute inset-0 h-full w-full scale-x-[-1] object-cover"
          />
          {runtime.state === 'IDLE' && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-white/60">
              세션을 시작하면 카메라가 켜집니다.
            </div>
          )}
        </div>
        <p className="mt-3 text-sm text-white/60">
          {message || '카메라 미리보기와 자세 감지 오버레이가 여기에 표시됩니다.'}
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

        <label className="block rounded-lg border border-[#2C2C2A]/10 bg-white p-4">
          <span className="mb-2 block text-sm text-[#2C2C2A]/50">성능 모드</span>
          <select
            value={performanceMode}
            onChange={(event) => setPerformanceMode(event.target.value as PerformanceMode)}
            className="w-full rounded-md border border-[#2C2C2A]/20 px-3 py-2"
          >
            <option value="low_power">저전력</option>
            <option value="default">기본</option>
            <option value="accuracy">정확도 우선</option>
          </select>
        </label>

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
