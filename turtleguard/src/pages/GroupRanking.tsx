import { useEffect, useState } from 'react';
import { settingsClient } from '../services/settingsClient';
import { socialClient, type GroupRankingEntry } from '../services/socialClient';

type Period = 'daily' | 'weekly';

function formatSeconds(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function GroupRanking() {
  const [period, setPeriod] = useState<Period>('daily');
  const [groupId, setGroupId] = useState<string | null>(null);
  const [groupName, setGroupName] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [rankings, setRankings] = useState<GroupRankingEntry[]>([]);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    void settingsClient.get().then((settings) => {
      setGroupId(settings.last_selected_group_id);
      setGroupName(settings.active_group_name);
      setInviteCode(settings.active_group_invite_code);
    });
  }, []);

  useEffect(() => {
    if (!groupId) {
      return;
    }

    setMessage('');
    setIsLoading(true);
    void socialClient
      .getRankings(groupId, period)
      .then(setRankings)
      .catch((caught) => {
        setRankings([]);
        setMessage(caught instanceof Error ? caught.message : 'Ranking load failed.');
      })
      .finally(() => setIsLoading(false));
  }, [groupId, period]);

  if (!groupId) {
    return (
      <section className="rounded-lg border border-[#2C2C2A]/10 bg-white p-5">
        <h1 className="text-2xl font-bold text-[#2C2C2A]">Group ranking</h1>
        <p className="mt-2 text-sm text-[#2C2C2A]/60">Create or join a group first.</p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-[#2C2C2A]/10 bg-white p-5">
        <h1 className="text-2xl font-bold text-[#2C2C2A]">{groupName ?? 'Group ranking'}</h1>
        {inviteCode && <p className="mt-1 font-mono text-sm text-[#2E7D63]">{inviteCode}</p>}
      </div>

      <div className="inline-flex rounded-lg border border-[#2C2C2A]/10 bg-white p-1">
        {(['daily', 'weekly'] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setPeriod(value)}
            className={`rounded-md px-4 py-2 text-sm font-semibold ${
              period === value ? 'bg-[#2E7D63] text-white' : 'text-[#2C2C2A]/70'
            }`}
          >
            {value === 'daily' ? 'Daily' : 'Weekly'}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border border-[#2C2C2A]/10 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#FBFBF9] text-[#2C2C2A]/60">
            <tr>
              <th className="p-3">Rank</th>
              <th className="p-3">Nickname</th>
              <th className="p-3">Good posture time</th>
            </tr>
          </thead>
          <tbody>
            {rankings.map((entry) => (
              <tr key={entry.profile_id} className="border-t border-[#2C2C2A]/10">
                <td className="p-3 font-bold text-[#2E7D63]">{entry.rank}</td>
                <td className="p-3">{entry.nickname}</td>
                <td className="p-3 font-mono">
                  {formatSeconds(entry.total_good_posture_seconds)}
                </td>
              </tr>
            ))}
            {!isLoading && rankings.length === 0 && (
              <tr>
                <td colSpan={3} className="p-6 text-center text-[#2C2C2A]/50">
                  No ranking data yet.
                </td>
              </tr>
            )}
            {isLoading && (
              <tr>
                <td colSpan={3} className="p-6 text-center text-[#2C2C2A]/50">
                  Loading rankings...
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {message && <p className="rounded-md bg-[#D9534F]/10 p-3 text-sm text-[#D9534F]">{message}</p>}
    </section>
  );
}
