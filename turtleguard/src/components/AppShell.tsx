import { useEffect, useMemo, useState } from 'react';
import { Activity, AlertCircle, Cable, CheckCircle2, History, Trophy, Users } from 'lucide-react';
import MainMonitor from '../pages/MainMonitor';
import HardwareSettings from '../pages/HardwareSettings';
import LocalHistory from '../pages/LocalHistory';
import SocialSetup from '../pages/SocialSetup';
import GroupRanking from '../pages/GroupRanking';
import { serialClient } from '../services/serialClient';
import { settingsClient } from '../services/settingsClient';
import {
  buildReadinessItems,
  getReadinessSummary,
  type OnboardingTab,
} from '../services/onboardingStatus';

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
  const [hardwareConnected, setHardwareConnected] = useState(false);
  const [cameraChecked, setCameraChecked] = useState(false);
  const [hasSocialProfile, setHasSocialProfile] = useState(false);
  const [hasActiveGroup, setHasActiveGroup] = useState(false);

  const readinessItems = useMemo(
    () =>
      buildReadinessItems({
        hardwareConnected,
        cameraChecked,
        hasSocialProfile,
        hasActiveGroup,
      }),
    [cameraChecked, hardwareConnected, hasActiveGroup, hasSocialProfile],
  );

  const readinessSummary = useMemo(
    () => getReadinessSummary(readinessItems),
    [readinessItems],
  );

  const openTab = (targetTab: OnboardingTab) => {
    setTab(targetTab);
    if (targetTab === 'monitor') {
      setCameraChecked(true);
    }
  };

  useEffect(() => {
    const refreshReadiness = async () => {
      const [serialStatus, settings] = await Promise.all([
        serialClient.getStatus(),
        settingsClient.get(),
      ]);

      setHardwareConnected(serialStatus.connected);
      setHasSocialProfile(Boolean(settings.profile_id));
      setHasActiveGroup(Boolean(settings.last_selected_group_id));
    };

    void refreshReadiness();
    const id = window.setInterval(() => {
      void refreshReadiness();
    }, 2000);

    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (tab === 'monitor') {
      setCameraChecked(true);
    }
  }, [tab]);

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
          <section className="mb-6 rounded-lg border border-[#2C2C2A]/10 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#2C2C2A]/50">
                  Setup status
                </p>
                <h1 className="mt-1 text-2xl font-bold text-[#2C2C2A]">
                  {readinessSummary.title}
                </h1>
                <p className="mt-1 text-sm text-[#2C2C2A]/60">{readinessSummary.detail}</p>
              </div>
              <button
                type="button"
                onClick={() => openTab(readinessSummary.primaryTargetTab)}
                className={`rounded-md px-4 py-2 text-sm font-semibold ${
                  readinessSummary.ready
                    ? 'bg-[#2E7D63] text-white'
                    : 'bg-[#D9A441] text-[#2C2C2A]'
                }`}
              >
                {readinessSummary.primaryActionLabel}
              </button>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-3">
              {readinessItems.map((item) => {
                const isReady = item.status === 'ready';
                const Icon = isReady ? CheckCircle2 : AlertCircle;

                return (
                  <div
                    key={item.id}
                    className={`rounded-md border p-4 ${
                      isReady
                        ? 'border-[#2E7D63]/20 bg-[#2E7D63]/5'
                        : 'border-[#D9A441]/30 bg-[#D9A441]/10'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Icon
                        className={`mt-0.5 h-5 w-5 ${
                          isReady ? 'text-[#2E7D63]' : 'text-[#9A6A00]'
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-[#2C2C2A]">{item.title}</p>
                        <p className="mt-1 text-xs leading-5 text-[#2C2C2A]/60">{item.detail}</p>
                        {!isReady && (
                          <button
                            type="button"
                            onClick={() => openTab(item.targetTab)}
                            className="mt-3 rounded-md border border-[#2C2C2A]/10 bg-white px-3 py-1.5 text-xs font-semibold text-[#2C2C2A]"
                          >
                            {item.actionLabel}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

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
