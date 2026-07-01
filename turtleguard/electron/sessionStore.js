import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

function sortByNewestStartedAt(first, second) {
  return new Date(second.started_at).getTime() - new Date(first.started_at).getTime();
}

function normalizeSession(session) {
  return {
    ...session,
    ended_at: session.ended_at ?? null,
    ended_reason: session.ended_reason ?? null,
    sync_status: session.sync_status ?? 'local_only',
  };
}

export class SessionStore {
  constructor(userDataPath) {
    this.filePath = path.join(userDataPath, 'sessions.json');
  }

  async ensureDir() {
    await mkdir(path.dirname(this.filePath), { recursive: true });
  }

  async readSessions() {
    try {
      const fileContents = await readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(fileContents);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      if (error?.code === 'ENOENT') {
        return [];
      }

      return [];
    }
  }

  async writeSessions(sessions) {
    await this.ensureDir();
    await writeFile(this.filePath, `${JSON.stringify(sessions, null, 2)}\n`, 'utf8');
  }

  async list() {
    const sessions = await this.readSessions();
    return sessions.slice().sort(sortByNewestStartedAt);
  }

  async saveDraft(session) {
    const sessions = await this.readSessions();
    const record = normalizeSession(session);
    const index = sessions.findIndex((entry) => entry.id === record.id);

    if (index === -1) {
      sessions.push(record);
    } else {
      sessions[index] = {
        ...sessions[index],
        ...record,
      };
    }

    await this.writeSessions(sessions);

    return normalizeSession(index === -1 ? record : sessions[index]);
  }

  async finish(partialSession) {
    const sessions = await this.readSessions();
    const index = sessions.findIndex((entry) => entry.id === partialSession.id);

    if (!partialSession.id || index === -1) {
      throw new Error(`Session not found: ${partialSession.id ?? 'unknown'}`);
    }

    const finishedRecord = normalizeSession({
      ...sessions[index],
      ...partialSession,
    });

    sessions[index] = finishedRecord;
    await this.writeSessions(sessions);

    return finishedRecord;
  }

  async recoverOpen() {
    const sessions = await this.readSessions();
    return sessions
      .filter((session) => !session.ended_at)
      .sort(sortByNewestStartedAt);
  }
}
