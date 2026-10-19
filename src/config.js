// Toot Tube: every tuning number in one place.

export const RAFT = {
  R: 2.3,
  ringR: 1.55,
  tubeR: 0.26,
  tubeCY: 0.2,
  hangR: 2.12,
};

export const PHYS = {
  dt: 1 / 60,
  linDrag: 0.75,
  quadDrag: 0.11,
  angDrag: 1.7,
  inertia: 1.9,
  thrust: 3.7,
  torqueK: 0.5,
  bankInset: 0.36,
  wallRest: 0.45,
  bumperRest: 0.9,
  whirlSpin: 1.6,
};

export const THRUST_MULT = [1, 1.65, 1.2, 1.0];

export const PLAYER = {
  height: 1.25,
  swim: 2.7,
  fartSwim: 0.55,
  accel: 9,
  hangY: -0.5,
  duckY: -1.35,
  breath: 1.6,
  breathRegen: 0.9,
  sectorPad: 0.2,
  gravity: 12.5,
};

export const GAS = {
  drain: 0.3,
  regen: 0.2,
  delay: 0.5,
  bean: 0.6,
  minPuff: 0.16,
};

export const NET = {
  rate: 1 / 15,
  interpDelay: 130,
  maxPlayers: 3,
};

export const ANIMALS = ['capybara', 'frog', 'pig', 'penguin', 'duck'];

export const ANIMAL_INFO = {
  capybara: { name: 'Capybara', color: '#c08552', pitch: 92 },
  frog: { name: 'Frog', color: '#6fd34f', pitch: 118 },
  pig: { name: 'Pig', color: '#ff8fbd', pitch: 140 },
  penguin: { name: 'Penguin', color: '#3b5bdb', pitch: 104 },
  duck: { name: 'Duck', color: '#ffc928', pitch: 128 },
};

export const SLOT_COLORS = ['#ffb020', '#2ec4b6', '#ff6fb5'];
