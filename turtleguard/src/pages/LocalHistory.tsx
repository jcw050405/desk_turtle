import { useEffect, useState } from 'react';
import { getFriendlySyncStatus } from '../services/onboardingStatus';
import { sessionClient, type LocalSessionRecord } from '../services/sessionClient';
import { retryPendingSession } from '../services/sessionSync';

function formatSeconds(seconds: number) {
  const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
  const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
}

export default function LocalHistory() {
  const [sessions, setSessions] = useState<LocalSessionRecord[]>([]);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState('');

  useEffect(() => {
    void sessionClient.list().then(setSessions);
  }, []);

  const refreshSessions = async () => {
    setSessions(await sessionClient.list());
  };

  const retrySync = async (session: LocalSessionRecord) => {
    setRetryingId(session.id);
    setSyncMessage('');

    try {
      const retried = await retryPendingSession(session);
      await refreshSessions();
      setSyncMessage(
        retried.sync_status === 'synced'
          ? 'Session synced to rankings.'
          : 'Session is still waiting to sync. Check Supabase setup or network, then try again.',
      );
    } finally {
      setRetryingId(null);
    }
  };

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-[#2C2C2A]">로컬 기록</h1>
        <p className="text-sm text-[#2C2C2A]/60">
          세션 기록은 이 컴퓨터에 먼저 저장되고, 소셜 설정이 있으면 동기화 상태가 함께 표시됩니다.
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
                <th className="p-3">Sync</th>
                <th className="p-3">Retry</th>
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
                  <td className="p-3">
                    {(() => {
                      const syncStatus = getFriendlySyncStatus(
                        session.sync_status ?? 'local_only',
                      );

                      return (
                        <div>
                          <span
                            className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                              syncStatus.tone === 'success'
                                ? 'bg-[#2E7D63]/10 text-[#2E7D63]'
                                : syncStatus.tone === 'warning'
                                  ? 'bg-[#D9A441]/10 text-[#7A5A12]'
                                  : 'bg-[#2C2C2A]/5 text-[#2C2C2A]/60'
                            }`}
                          >
                            {syncStatus.label}
                          </span>
                          <p className="mt-1 max-w-[220px] text-xs leading-5 text-[#2C2C2A]/50">
                            {syncStatus.detail}
                          </p>
                        </div>
                      );
                    })()}
                  </td>
                  <td className="p-3">
                    {session.sync_status === 'pending_sync' ? (
                      <button
                        type="button"
                        onClick={() => retrySync(session)}
                        disabled={retryingId === session.id}
                        className="rounded-md border border-[#2E7D63]/30 px-3 py-1 text-xs font-semibold text-[#2E7D63] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {retryingId === session.id ? 'Retrying...' : 'Retry'}
                      </button>
                    ) : (
                      <span className="text-[#2C2C2A]/40">-</span>
                    )}
                  </td>
                  <td className="p-3">
                    {session.ended_at ? (session.ended_reason ?? 'ended') : '복구 필요'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {syncMessage && (
        <p className="rounded-md bg-[#2E7D63]/10 p-3 text-sm text-[#2E7D63]">{syncMessage}</p>
      )}
    </section>
  );
}
