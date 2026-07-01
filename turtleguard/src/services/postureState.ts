export type PostureState =
  | 'IDLE'
  | 'CALIBRATING'
  | 'GOOD'
  | 'BAD'
  | 'AWAY'
  | 'PAUSED'
  | 'ERROR';

export interface PostureCounters {
  good_posture_seconds: number;
  bad_posture_seconds: number;
  away_seconds: number;
  warning_count: number;
}

export interface PostureRuntime {
  state: PostureState;
  noFaceSince: number | null;
  counters: PostureCounters;
}

export interface DetectionInput {
  hasFace: boolean;
  isBadPosture: boolean;
  now: number;
  awayGraceMs: number;
}

export function initialPostureRuntime(): PostureRuntime {
  return {
    state: 'IDLE',
    noFaceSince: null,
    counters: {
      good_posture_seconds: 0,
      bad_posture_seconds: 0,
      away_seconds: 0,
      warning_count: 0,
    },
  };
}

export function nextPostureState(
  previous: PostureRuntime,
  input: DetectionInput,
): PostureRuntime {
  if (previous.state === 'PAUSED' || previous.state === 'ERROR') {
    return previous;
  }

  if (!input.hasFace) {
    const noFaceSince = previous.noFaceSince ?? input.now;
    const state = input.now - noFaceSince >= input.awayGraceMs ? 'AWAY' : previous.state;

    return { ...previous, state, noFaceSince };
  }

  const nextState: PostureState = input.isBadPosture ? 'BAD' : 'GOOD';
  const enteredBad = previous.state !== 'BAD' && nextState === 'BAD';

  return {
    ...previous,
    state: nextState,
    noFaceSince: null,
    counters: {
      ...previous.counters,
      warning_count: previous.counters.warning_count + (enteredBad ? 1 : 0),
    },
  };
}

export function addElapsedSecond(runtime: PostureRuntime): PostureRuntime {
  if (runtime.state === 'GOOD') {
    return {
      ...runtime,
      counters: {
        ...runtime.counters,
        good_posture_seconds: runtime.counters.good_posture_seconds + 1,
      },
    };
  }

  if (runtime.state === 'BAD') {
    return {
      ...runtime,
      counters: {
        ...runtime.counters,
        bad_posture_seconds: runtime.counters.bad_posture_seconds + 1,
      },
    };
  }

  if (runtime.state === 'AWAY') {
    return {
      ...runtime,
      counters: {
        ...runtime.counters,
        away_seconds: runtime.counters.away_seconds + 1,
      },
    };
  }

  return runtime;
}
