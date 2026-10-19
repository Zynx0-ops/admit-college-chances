/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  ADMISSION MODEL WEIGHTS
 * ─────────────────────────────────────────────────────────────────────────────
 *  Every tunable number used by the scoring model lives here, so you can adjust
 *  how much each part of a profile matters without touching any logic.
 *
 *  The model works in *log-odds* (see js/scoring.js). A contribution of +0.5
 *  roughly multiplies the odds of admission by e^0.5 ≈ 1.65; −0.5 divides them
 *  by the same amount. Small numbers (±0.1–1.0) are therefore meaningful.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const WEIGHTS = {
  /**
   * Starting point. The school's overall acceptance rate is the base rate.
   * Admitted students are stronger than the average *applicant*, so a student
   * sitting exactly at a school's admitted-student median gets a bump over the
   * raw acceptance rate.
   */
  baseline: {
    medianAdmitBoost: 0.4,
  },

  /** Academic fit: how your numbers compare to the school's middle 50%. */
  academics: {
    // Multipliers applied to your distance from the school's median, measured
    // in "middle-50% widths" (z ≈ (you − median) / (p75 − p25)).
    gpaWeight: 1.0,
    testWeight: 0.7,

    // Elite schools often report a 3.9–4.0 range; a tiny spread would make
    // every 0.01 GPA point look enormous, so we enforce a minimum width.
    minGpaSpread: 0.25,
    minSatSpread: 100,

    // Being above the median helps, but with diminishing returns versus being
    // below it (a 4.0 doesn't guarantee anything; a 3.0 can sink you).
    aboveMedianDampening: 0.6,

    // Clamp z so a single extreme value can't dominate.
    zMin: -3,
    zMax: 2,

    // Course rigor ("grades" context: how hard the classes behind the GPA were).
    rigor: {
      standard: -0.45,
      moderate: 0.0,
      rigorous: 0.4,
    },

    // Grade trend across high school.
    trend: {
      upward: 0.15,
      steady: 0.0,
      downward: -0.35,
    },
  },

  /** How a missing test score is treated, per school test policy. */
  testing: {
    notSubmittedOptional: -0.1, // test-optional: small signal loss
    notSubmittedRequired: -1.5, // test-required: application is weaker / incomplete
    // test-blind schools ignore scores entirely (contribution 0 either way)
  },

  /** Extracurricular activities (each activity is scored, then summed). */
  activities: {
    // Base points by how far the activity's impact reached.
    reachPoints: {
      school: 1.0,
      community: 1.6,
      state: 2.6,
      national: 4.0,
    },
    leadershipMultiplier: 1.4, // held a leadership / founder role
    // Years involved scale points from 50% (1 year) to 100% (4 years).
    minYearsFactor: 0.5,
    // Extra credit for depth of time commitment, per hour/week, capped.
    hoursBonusPerHour: 0.03,
    hoursBonusCap: 0.45,
    // Only the strongest N activities count (Common App lists 10).
    maxCounted: 10,
    // Total points → 0..1 score with diminishing returns: 1 − e^(−points / saturation)
    saturation: 9,
  },

  /** Honors and awards. */
  awards: {
    levelPoints: {
      school: 0.8,
      regional: 1.6,
      state: 2.8,
      national: 5.0,
      international: 7.0,
    },
    maxCounted: 5, // Common App lists 5 honors
    saturation: 7,
  },

  /** Holistic review: activities + awards combined into one 0..1 score. */
  holistic: {
    activitiesShare: 0.65,
    awardsShare: 0.35,

    // What a typical admit's holistic score looks like, by acceptance rate.
    // Values between points are linearly interpolated.
    expectedByAcceptance: [
      { rate: 0.03, expected: 0.62 },
      { rate: 0.10, expected: 0.52 },
      { rate: 0.25, expected: 0.4 },
      { rate: 0.5, expected: 0.3 },
      { rate: 0.9, expected: 0.15 },
    ],

    // How strongly being above/below that expectation moves the needle.
    // Selective schools lean much more on holistic review.
    impactByAcceptance: [
      { rate: 0.03, impact: 3.0 },
      { rate: 0.15, impact: 2.6 },
      { rate: 0.4, impact: 1.8 },
      { rate: 0.9, impact: 0.9 },
    ],
  },

  /**
   * Final guard rails. Even "perfect" applicants are rejected from the most
   * selective schools most of the time, so the chance is capped by selectivity.
   */
  limits: {
    floor: 0.01,
    capsByAcceptance: [
      { maxRate: 0.06, cap: 0.4 },
      { maxRate: 0.12, cap: 0.55 },
      { maxRate: 0.25, cap: 0.8 },
      { maxRate: 0.5, cap: 0.92 },
      { maxRate: 1.0, cap: 0.97 },
    ],
  },

  /** Labels shown in the UI. Chance thresholds are inclusive lower bounds. */
  categories: [
    { id: 'safety', label: 'Likely', min: 0.7 },
    { id: 'target', label: 'Target', min: 0.35 },
    { id: 'reach', label: 'Reach', min: 0.12 },
    { id: 'far', label: 'Far Reach', min: 0 },
  ],
};

/**
 * ACT → SAT concordance (abridged from the 2018 ACT/College Board tables).
 * Used so ACT takers are compared on the same scale as each school's SAT range.
 */
export const ACT_TO_SAT = {
  36: 1590, 35: 1550, 34: 1510, 33: 1480, 32: 1440, 31: 1410, 30: 1370,
  29: 1340, 28: 1310, 27: 1280, 26: 1240, 25: 1210, 24: 1180, 23: 1140,
  22: 1110, 21: 1080, 20: 1040, 19: 1010, 18: 970, 17: 930, 16: 890,
  15: 850, 14: 800, 13: 760, 12: 710, 11: 670, 10: 630, 9: 590,
};
