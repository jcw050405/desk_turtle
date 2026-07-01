import { useEffect, useState } from 'react';
import { sessionClient, type LocalSessionRecord } from '../services/sessionClient';

function formatSeconds(seconds: number) {
  const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
  const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
}

export default function LocalHistory() {
  const [sessions, setSessions] = useState<LocalSessionRecord[]>([]);

  useEffect(() => {
    void sessionClient.list().then(setSessions);
  }, []);

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-[#2C2C2A]">로컬 기록</h1>
        <p className="text-sm text-[#2C2C2A]/60">
          이 기록은 현재 컴퓨터에만 저장됩니다.
        </p>
      </header>

      <div className="overflow-hidden rounded-lg border border-[#2C2C2A]/10 bg-white">
        {sessions.length === 0 ? (
          <p className="p-6 text-sm text-[#2C2C2A]/50">아직 저장된 세션이 없습니다.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-[#FBFBF9] text-[#2C2C2A]/60">
              <tr>
                <th className="p-3">시작</th>
                <th className="p-3">바른 자세</th>
                <th className="p-3">나쁜 자세</th>
                <th className="p-3">자리 비움</th>
                <th className="p-3">경고</th>
                <th className="p-3">상태</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((session) => (
                <tr key={session.id} className="border-t border-[#2C2C2A]/5">
                  <td className="p-3">{new Date(session.started_at).toLocaleString()}</td>
                  <td className="p-3">{formatSeconds(session.good_posture_seconds)}</td>
                  <td className="p-3">{formatSeconds(session.bad_posture_seconds)}</td>
                  <td className="p-3">{formatSeconds(session.away_seconds)}</td>
                  <td className="p-3">{session.warning_count}</td>
                  <td className="p-3">{session.ended_at ? session.ended_reason : '복구 필요'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
