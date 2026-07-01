import type { LocalSessionRecord, TurtleSessionApi } from '../types/electron';

function getSessionApi(): TurtleSessionApi | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }

  return window.turtleSession;
}

export type { LocalSessionRecord };

export const sessionClient = {
  async list(): Promise<LocalSessionRecord[]> {
    return (await getSessionApi()?.list?.()) ?? [];
  },

  async saveDraft(session: LocalSessionRecord): Promise<LocalSessionRecord> {
    return (await getSessionApi()?.saveDraft?.(session)) ?? session;
  },

  async finish(
    session: Partial<LocalSessionRecord> & Pick<LocalSessionRecord, 'id'>,
  ): Promise<LocalSessionRecord | null> {
    return (await getSessionApi()?.finish?.(session)) ?? null;
  },

  async recoverOpen(): Promise<LocalSessionRecord[]> {
    return (await getSessionApi()?.recoverOpen?.()) ?? [];
  },
};
