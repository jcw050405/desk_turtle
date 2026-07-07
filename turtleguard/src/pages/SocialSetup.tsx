import { useEffect, useState } from 'react';
import { settingsClient } from '../services/settingsClient';
import { getFriendlySocialErrorMessage, socialClient } from '../services/socialClient';
import type { TurtleSettings } from '../types/electron';

export default function SocialSetup() {
  const [settings, setSettings] = useState<TurtleSettings | null>(null);
  const [nickname, setNickname] = useState('');
  const [groupName, setGroupName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    void settingsClient.get().then((loaded) => {
      setSettings(loaded);
      setNickname(loaded.nickname ?? '');
    });
  }, []);

  const runAction = async (action: () => Promise<void>) => {
    setMessage('');
    setError('');
    setIsBusy(true);

    try {
      await action();
    } catch (caught) {
      setError(getFriendlySocialErrorMessage(caught));
    } finally {
      setIsBusy(false);
    }
  };

  const saveProfile = () =>
    runAction(async () => {
      const profile = await socialClient.createProfile(nickname);
      const next = await settingsClient.update({
        profile_id: profile.id,
        nickname: profile.nickname,
      });
      setSettings(next);
      setNickname(profile.nickname);
      setMessage('Profile saved.');
    });

  const createGroup = () =>
    runAction(async () => {
      if (!settings?.profile_id) {
        throw new Error('Create a profile first.');
      }

      const group = await socialClient.createGroup(settings.profile_id, groupName);
      const next = await settingsClient.update({
        last_selected_group_id: group.id,
        active_group_name: group.name,
        active_group_invite_code: group.invite_code,
      });
      setSettings(next);
      setGroupName('');
      setMessage(`Group created. Invite code: ${group.invite_code}`);
    });

  const joinGroup = () =>
    runAction(async () => {
      if (!settings?.profile_id) {
        throw new Error('Create a profile first.');
      }

      const group = await socialClient.joinGroup(settings.profile_id, inviteCode);
      const next = await settingsClient.update({
        last_selected_group_id: group.id,
        active_group_name: group.name,
        active_group_invite_code: group.invite_code,
      });
      setSettings(next);
      setInviteCode('');
      setMessage(`Joined group: ${group.name}`);
    });

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-[#2C2C2A]/10 bg-white p-5">
        <h1 className="text-2xl font-bold text-[#2C2C2A]">Social setup</h1>
        <p className="mt-1 text-sm text-[#2C2C2A]/60">
          Save a profile, then create or join one group to enable rankings and sync.
        </p>
      </div>

      <div className="rounded-lg border border-[#2C2C2A]/10 bg-white p-5">
        <label className="block text-sm font-medium text-[#2C2C2A]" htmlFor="nickname">
          Nickname
        </label>
        <input
          id="nickname"
          value={nickname}
          onChange={(event) => setNickname(event.target.value)}
          className="mt-2 w-full rounded-md border border-[#2C2C2A]/20 px-3 py-2 outline-none focus:border-[#2E7D63]"
          maxLength={32}
        />
        <button
          type="button"
          onClick={saveProfile}
          disabled={isBusy || !nickname.trim()}
          className="mt-3 rounded-md bg-[#2E7D63] px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#2C2C2A]/30"
        >
          Save profile
        </button>
      </div>

      <div className="rounded-lg border border-[#2C2C2A]/10 bg-white p-5">
        <p className="text-sm text-[#2C2C2A]/50">Current group</p>
        <p className="mt-1 text-xl font-bold text-[#2C2C2A]">
          {settings?.active_group_name ?? 'No group yet'}
        </p>
        <p className="mt-1 text-sm text-[#2C2C2A]/60">
          {settings?.profile_id
            ? 'Profile is ready. Group sessions can be uploaded when ranking mode is on.'
            : 'Profile is missing. Save a nickname before creating or joining a group.'}
        </p>
        {settings?.active_group_invite_code && (
          <p className="mt-1 font-mono text-sm text-[#2E7D63]">
            {settings.active_group_invite_code}
          </p>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-[#2C2C2A]/10 bg-white p-5">
          <label className="block text-sm font-medium text-[#2C2C2A]" htmlFor="group-name">
            Create group
          </label>
          <input
            id="group-name"
            value={groupName}
            onChange={(event) => setGroupName(event.target.value)}
            className="mt-2 w-full rounded-md border border-[#2C2C2A]/20 px-3 py-2 outline-none focus:border-[#2E7D63]"
            maxLength={48}
          />
          <button
            type="button"
            onClick={createGroup}
            disabled={isBusy || !groupName.trim()}
            className="mt-3 rounded-md bg-[#2E7D63] px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#2C2C2A]/30"
          >
            Create
          </button>
        </div>

        <div className="rounded-lg border border-[#2C2C2A]/10 bg-white p-5">
          <label className="block text-sm font-medium text-[#2C2C2A]" htmlFor="invite-code">
            Join with invite code
          </label>
          <input
            id="invite-code"
            value={inviteCode}
            onChange={(event) => setInviteCode(event.target.value.toUpperCase())}
            className="mt-2 w-full rounded-md border border-[#2C2C2A]/20 px-3 py-2 font-mono outline-none focus:border-[#2E7D63]"
            maxLength={12}
          />
          <button
            type="button"
            onClick={joinGroup}
            disabled={isBusy || !inviteCode.trim()}
            className="mt-3 rounded-md bg-[#2E7D63] px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#2C2C2A]/30"
          >
            Join
          </button>
        </div>
      </div>

      {message && (
        <p className="rounded-md bg-[#2E7D63]/10 p-3 text-sm text-[#2E7D63]">{message}</p>
      )}
      {error && <p className="rounded-md bg-[#D9534F]/10 p-3 text-sm text-[#D9534F]">{error}</p>}
    </section>
  );
}
