export const FIELD = {
  HALF_W: 26.667,
  GOAL: 50,
  END: 60,
  HASH: 3.083,
  POST_HALF: 3.083,
  CROSSBAR: 3.333,
  UPRIGHT_TOP: 15,
};
export const PHYS = { DT: 1 / 60, GRAVITY: 18, PLAYER_GRAVITY: 30 };
export const PLAYER = {
  RADIUS: 0.42,
  HEIGHT: 1.9,
  BASE_SPEED: 6.4,
  SPEED_RANGE: 2.7,
  TURBO_MULT: 1.32,
  ACCEL: 26,
  TACKLE_RANGE: 1.05,
  CATCH_REACH: 1.05,
};
export const RULES = {
  KICKOFF_SPOT: 35,
  KICKOFF_TOUCHBACK: 25,
  KICKOFF_OOB: 40,
  PUNT_TOUCHBACK: 20,
  SAFETY_FREE_KICK: 20,
  XP_SPOT: 15,
  TWO_PT_SPOT: 2,
  TIMEOUTS_PER_HALF: 3,
  PLAY_CLOCK: 20,
  PLAY_SELECT_TIME: 20,
  HUDDLE_RUNOFF: 5,
};
export const DEFAULT_SETTINGS = {
  quarterMinutes: 3,
  difficulty: `pro`,
  penalties: true,
  announcer: true,
  music: true,
  sfx: true,
  bloom: true,
};
export const DIFFICULTY = {
  rookie: { cpuSpeed: 0.93, cpuReact: 1.5, cpuAccuracy: 0.8, cpuTackle: 0.8, humanCatch: 1.08 },
  pro: { cpuSpeed: 1, cpuReact: 1, cpuAccuracy: 1, cpuTackle: 1, humanCatch: 1 },
  legend: { cpuSpeed: 1.05, cpuReact: 0.7, cpuAccuracy: 1.12, cpuTackle: 1.15, humanCatch: 0.95 },
};
