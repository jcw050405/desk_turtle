import { useState } from 'react';
import { Activity, Cable, History, Trophy, Users } from 'lucide-react';
import MainMonitor from '../pages/MainMonitor';
import HardwareSettings from '../pages/HardwareSettings';
import LocalHistory from '../pages/LocalHistory';
import SocialSetup from '../pages/SocialSetup';
import GroupRanking from '../pages/GroupRanking';

type Tab = 'monitor' | 'hardware' | 'history' | 'social' | 'ranking';

const tabs = [
  { id: 'monitor' as const, label: '관찰 화면', icon: Activity },
  { id: 'hardware' as const, label: '하드웨어', icon: Cable },
  { id: 'history' as const, label: '로컬 기록', icon: History },
  { id: 'social' as const, label: '소셜', icon: Users },
  { id: 'ranking' as const, label: '랭킹', icon: Trophy },
];

export default function AppShell() {
  const [tab, setTab] = useState<Tab>('monitor');

  return (
    <div className="min-h-screen bg-[#FBFBF9] text-[#2C2C2A]">
      <div className="mx-auto flex min-h-screen max-w-[1280px]">
        <nav className="w-64 border-r border-[#2C2C2A]/10 bg-white p-5">
          <div className="mb-8 flex items-center gap-2 text-xl font-bold text-[#2E7D63]">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[#2E7D63] text-white">
              T
            </span>
            TurtleGuard
          </div>

          <div className="space-y-2">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left ${
                  tab === id ? 'bg-[#2E7D63]/10 text-[#2E7D63]' : 'hover:bg-[#2E7D63]/10'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>
        </nav>

        <main className="flex-1 p-8">
          {tab === 'monitor' && <MainMonitor />}
          {tab === 'hardware' && <HardwareSettings />}
          {tab === 'history' && <LocalHistory />}
          {tab === 'social' && <SocialSetup />}
          {tab === 'ranking' && <GroupRanking />}
        </main>
      </div>
    </div>
  );
}
