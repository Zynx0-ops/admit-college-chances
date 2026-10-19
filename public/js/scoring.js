/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  ADMISSION-CHANCE MODEL
 * ─────────────────────────────────────────────────────────────────────────────
 *  Pure functions, no DOM — the same file runs in the browser and in Node tests.
 *
 *  How it works (all tunable numbers are in config/weights.js):
 *
 *    log-odds = logit(school acceptance rate)       ← base rate
 *             + medianAdmitBoost                    ← admits beat avg applicant
 *             + GPA fit          (vs school middle 50%)
 *             + test fit         (vs school middle 50%, per test policy)
 *             + course rigor     (grades context)
 *             + grade trend
 *             + holistic fit     (activities + awards vs what the school expects)
 *
 *    chance   = sigmoid(log-odds), clamped to [floor, selectivity cap]
 *
 *  Each term is returned as a named "factor" so the UI can show exactly why a
 *  number is what it is.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { WEIGHTS, ACT_TO_SAT } from '../config/weights.js';

// ── math helpers ────────────────────────────────────────────────────────────

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const logit = (p) => Math.log(p / (1 - p));
const sigmoid = (x) => 1 / (1 + Math.exp(-x));

/** Linear interpolation over [{rate, <key>}] sorted by rate. */
function interpolate(table, rate, key) {
  if (rate <= table[0].rate) return table[0][key];
  for (let i = 1; i < table.length; i++) {
    const a = table[i - 1];
    const b = table[i];
    if (rate <= b.rate) {
      const t = (rate - a.rate) / (b.rate - a.rate);
      return a[key] + t * (b[key] - a[key]);
    }
  }
  return table[table.length - 1][key];
}

/**
 * Distance from the school's median in middle-50% widths, with dampening above
 * the median and clamping at the extremes.
 */
function fitZ(value, p25, p75, minSpread, w) {
  const mid = (p25 + p75) / 2;
  const spread = Math.max(p75 - p25, minSpread);
  let z = (value - mid) / spread;
  if (z > 0) z *= w.academics.aboveMedianDampening;
  return clamp(z, w.academics.zMin, w.academics.zMax);
}

// ── profile-level scores (independent of school) ────────────────────────────

/** Converts an ACT composite to an SAT-equivalent score. */
export function actToSat(act) {
  const rounded = clamp(Math.round(act), 9, 36);
  return ACT_TO_SAT[rounded];
}

/** The student's SAT-equivalent score, or null if they aren't submitting one. */
export function satEquivalent(profile) {
  if (!profile.submitTest) return null;
  return profile.testType === 'act' ? actToSat(profile.act) : profile.sat;
}

/** Points for a single extracurricular activity. */
export function activityPoints(a, w = WEIGHTS) {
  const cfg = w.activities;
  const base = cfg.reachPoints[a.reach] ?? cfg.reachPoints.school;
  const years = clamp(a.years ?? 1, 1, 4);
  const yearsFactor = cfg.minYearsFactor + (1 - cfg.minYearsFactor) * ((years - 1) / 3);
  const leadership = a.leadership ? cfg.leadershipMultiplier : 1;
  const hours = Math.min((a.hours ?? 0) * cfg.hoursBonusPerHour, cfg.hoursBonusCap);
  return base * yearsFactor * leadership + hours;
}

/** 0..1 score for all activities, counting only the strongest few. */
export function activitiesScore(activities = [], w = WEIGHTS) {
  const cfg = w.activities;
  const total = activities
    .map((a) => activityPoints(a, w))
    .sort((x, y) => y - x)
    .slice(0, cfg.maxCounted)
    .reduce((s, p) => s + p, 0);
  return 1 - Math.exp(-total / cfg.saturation);
}

/** 0..1 score for all awards, counting only the strongest few. */
export function awardsScore(awards = [], w = WEIGHTS) {
  const cfg = w.awards;
  const total = awards
    .map((a) => cfg.levelPoints[a.level] ?? cfg.levelPoints.school)
    .sort((x, y) => y - x)
    .slice(0, cfg.maxCounted)
    .reduce((s, p) => s + p, 0);
  return 1 - Math.exp(-total / cfg.saturation);
}

/** Combined 0..1 holistic score. */
export function holisticScore(profile, w = WEIGHTS) {
  const h = w.holistic;
  return (
    h.activitiesShare * activitiesScore(profile.activities, w) +
    h.awardsShare * awardsScore(profile.awards, w)
  );
}

// ── per-school estimate ─────────────────────────────────────────────────────

/** Maximum chance allowed at a school of the given acceptance rate. */
export function capFor(rate, w = WEIGHTS) {
  const row = w.limits.capsByAcceptance.find((r) => rate <= r.maxRate);
  return row ? row.cap : w.limits.capsByAcceptance.at(-1).cap;
}

/** Maps a chance (0..1) to a category such as Likely / Target / Reach. */
export function categoryFor(chance, w = WEIGHTS) {
  return w.categories.find((c) => chance >= c.min) ?? w.categories.at(-1);
}

/**
 * Estimates the chance of admission for one student at one school.
 *
 * @param {object} profile  student profile (see js/store.js for the shape)
 * @param {object} school   one entry from data/colleges.json
 * @param {object} [w]      weights (defaults to config/weights.js)
 * @returns {{ chance: number, category: object, logOdds: number,
 *             capped: boolean, factors: Array<{id, label, value, detail}> }}
 */
export function estimateChance(profile, school, w = WEIGHTS) {
  const factors = [];
  const rate = clamp(school.acceptanceRate, 0.005, 0.995);

  // 1. Base rate + median-admit boost
  factors.push({
    id: 'base',
    label: 'School selectivity',
    value: logit(rate) + w.baseline.medianAdmitBoost,
    detail: `${(rate * 100).toFixed(rate < 0.1 ? 1 : 0)}% overall acceptance rate`,
  });

  // 2. GPA fit
  const gpaZ = fitZ(profile.gpa, school.gpa25, school.gpa75, w.academics.minGpaSpread, w);
  factors.push({
    id: 'gpa',
    label: 'GPA',
    value: w.academics.gpaWeight * gpaZ,
    detail: `${profile.gpa.toFixed(2)} vs. middle 50% of ${school.gpa25.toFixed(2)}–${school.gpa75.toFixed(2)}`,
  });

  // 3. Test fit — depends on the school's testing policy
  const sat = satEquivalent(profile);
  let testValue = 0;
  let testDetail;
  if (school.testPolicy === 'blind' || school.sat25 == null) {
    testDetail = 'Test-blind — scores not considered';
  } else if (sat == null) {
    const required = school.testPolicy === 'required';
    testValue = required ? w.testing.notSubmittedRequired : w.testing.notSubmittedOptional;
    testDetail = required ? 'Scores required but not submitted' : 'Test-optional — not submitting';
  } else {
    const z = fitZ(sat, school.sat25, school.sat75, w.academics.minSatSpread, w);
    testValue = w.academics.testWeight * z;
    const shown = profile.testType === 'act' ? `ACT ${profile.act} (≈${sat} SAT)` : `SAT ${sat}`;
    testDetail = `${shown} vs. middle 50% of ${school.sat25}–${school.sat75}`;
  }
  factors.push({ id: 'test', label: 'Test scores', value: testValue, detail: testDetail });

  // 4. Course rigor & grade trend (the "grades" context behind the GPA)
  factors.push({
    id: 'rigor',
    label: 'Course rigor',
    value: w.academics.rigor[profile.rigor] ?? 0,
    detail: { standard: 'Mostly standard courses', moderate: 'Some honors / AP / IB', rigorous: 'Most rigorous available' }[profile.rigor] ?? '',
  });
  factors.push({
    id: 'trend',
    label: 'Grade trend',
    value: w.academics.trend[profile.trend] ?? 0,
    detail: { upward: 'Improving over time', steady: 'Consistent', downward: 'Declining over time' }[profile.trend] ?? '',
  });

  // 5. Holistic fit — activities + awards vs. what this school typically sees
  const holistic = holisticScore(profile, w);
  const expected = interpolate(w.holistic.expectedByAcceptance, rate, 'expected');
  const impact = interpolate(w.holistic.impactByAcceptance, rate, 'impact');
  const actScore = activitiesScore(profile.activities, w);
  const awdScore = awardsScore(profile.awards, w);
  factors.push({
    id: 'activities',
    label: 'Activities',
    value: impact * w.holistic.activitiesShare * (actScore - expected),
    detail: `${profile.activities.length} listed · strength ${Math.round(actScore * 100)}/100 (typical admit ≈ ${Math.round(expected * 100)})`,
  });
  factors.push({
    id: 'awards',
    label: 'Honors & awards',
    value: impact * w.holistic.awardsShare * (awdScore - expected),
    detail: `${profile.awards.length} listed · strength ${Math.round(awdScore * 100)}/100 (typical admit ≈ ${Math.round(expected * 100)})`,
  });

  // 6. Combine and clamp
  const logOdds = factors.reduce((s, f) => s + f.value, 0);
  const raw = sigmoid(logOdds);
  const cap = capFor(rate, w);
  const chance = clamp(raw, w.limits.floor, cap);

  return {
    chance,
    category: categoryFor(chance, w),
    logOdds,
    capped: raw > cap,
    cap,
    holistic,
    factors,
  };
}

/** Convenience: estimates for many schools at once. */
export function estimateAll(profile, schools, w = WEIGHTS) {
  return schools.map((school) => ({ school, ...estimateChance(profile, school, w) }));
}
