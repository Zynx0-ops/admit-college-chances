// Profile + UI state, persisted to localStorage (per browser only — no accounts).

const KEY = 'admit.v1';

export const DEFAULT_PROFILE = {
  gpa: 3.7, // unweighted, 4.0 scale
  rigor: 'moderate', // standard | moderate | rigorous
  trend: 'steady', // upward | steady | downward
  submitTest: true,
  testType: 'sat', // sat | act
  sat: 1350,
  act: 29,
  activities: [
    { id: 'a1', name: 'Varsity Soccer', category: 'Athletics', reach: 'school', years: 3, hours: 10, leadership: false },
    { id: 'a2', name: 'Robotics Club', category: 'STEM', reach: 'community', years: 2, hours: 5, leadership: true },
  ],
  awards: [{ id: 'w1', name: 'Honor Roll', level: 'school' }],
};

export const DEFAULT_UI = {
  major: 'all',
  sort: 'chance', // chance | name | selectivity
  category: 'all',
  search: '',
  theme: 'system', // system | light | dark
};

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (saved) {
      return {
        profile: { ...structuredClone(DEFAULT_PROFILE), ...saved.profile },
        ui: { ...DEFAULT_UI, ...saved.ui, search: '' },
      };
    }
  } catch {
    /* private mode / corrupt data — fall back to defaults */
  }
  return { profile: structuredClone(DEFAULT_PROFILE), ui: { ...DEFAULT_UI } };
}

const state = load();
const listeners = new Set();
let saveTimer;

export const store = {
  get profile() {
    return state.profile;
  },
  get ui() {
    return state.ui;
  },
  /** Shallow-merge a patch into the profile and notify listeners. */
  setProfile(patch) {
    Object.assign(state.profile, patch);
    emit('profile');
  },
  setUI(patch) {
    Object.assign(state.ui, patch);
    emit('ui');
  },
  reset() {
    state.profile = structuredClone(DEFAULT_PROFILE);
    emit('profile');
  },
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

function emit(kind) {
  listeners.forEach((fn) => fn(kind));
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ profile: state.profile, ui: state.ui }));
    } catch {
      /* ignore */
    }
  }, 200);
}

export const uid = () => Math.random().toString(36).slice(2, 9);
