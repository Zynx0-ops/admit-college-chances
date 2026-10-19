// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  estimateChance,
  activitiesScore,
  awardsScore,
  actToSat,
  categoryFor,
} from '../public/js/scoring.js';
import { WEIGHTS } from '../public/config/weights.js';

const data = JSON.parse(readFileSync(new URL('../public/data/colleges.json', import.meta.url)));
const byId = (id) => data.colleges.find((c) => c.id === id);

const base = {
  gpa: 3.7,
  rigor: 'moderate',
  trend: 'steady',
  submitTest: true,
  testType: 'sat',
  sat: 1350,
  act: 29,
  activities: [{ reach: 'school', years: 3, hours: 5, leadership: false }],
  awards: [{ level: 'school' }],
};
const chance = (patch, id) => estimateChance({ ...base, ...patch }, byId(id)).chance;

test('dataset is well-formed', () => {
  const majorIds = new Set(data.majors.map((m) => m.id));
  assert.ok(data.colleges.length >= 30);
  for (const c of data.colleges) {
    assert.ok(c.acceptanceRate > 0 && c.acceptanceRate < 1, c.id);
    assert.ok(c.gpa25 <= c.gpa75, c.id);
    assert.ok(['required', 'optional', 'blind'].includes(c.testPolicy), c.id);
    if (c.testPolicy !== 'blind') assert.ok(c.sat25 < c.sat75, c.id);
    for (const m of c.majors) assert.ok(majorIds.has(m), `${c.id}: unknown major ${m}`);
  }
});

test('higher GPA increases chance', () => {
  assert.ok(chance({ gpa: 3.9 }, 'umich') > chance({ gpa: 3.5 }, 'umich'));
});

test('higher test score increases chance', () => {
  assert.ok(chance({ sat: 1500 }, 'uw') > chance({ sat: 1200 }, 'uw'));
});

test('more activities and awards increase chance', () => {
  const more = {
    activities: [...base.activities, { reach: 'national', years: 4, hours: 10, leadership: true }],
    awards: [...base.awards, { level: 'national' }],
  };
  assert.ok(chance(more, 'cornell') > chance({}, 'cornell'));
});

test('test-blind schools ignore scores', () => {
  assert.equal(chance({ sat: 1600 }, 'berkeley'), chance({ sat: 900 }, 'berkeley'));
  assert.equal(chance({ submitTest: false }, 'berkeley'), chance({}, 'berkeley'));
});

test('not submitting hurts more at test-required schools', () => {
  const dropRequired = chance({}, 'purdue') - chance({ submitTest: false }, 'purdue');
  const dropOptional = chance({}, 'osu') - chance({ submitTest: false }, 'osu');
  assert.ok(dropRequired > dropOptional);
});

test('ACT is converted to the SAT scale', () => {
  assert.equal(actToSat(36), 1590);
  assert.equal(actToSat(30), 1370);
  const sat = chance({ testType: 'sat', sat: 1370 }, 'uiuc');
  const act = chance({ testType: 'act', act: 30 }, 'uiuc');
  assert.equal(sat, act);
});

test('chances stay within floor and selectivity cap', () => {
  const star = {
    gpa: 4.0, rigor: 'rigorous', trend: 'upward', sat: 1600,
    activities: Array.from({ length: 10 }, () => ({ reach: 'national', years: 4, hours: 20, leadership: true })),
    awards: Array.from({ length: 5 }, () => ({ level: 'international' })),
  };
  for (const c of data.colleges) {
    const r = estimateChance({ ...base, ...star }, c);
    assert.ok(r.chance <= r.cap + 1e-9, c.id);
    const weak = estimateChance({ ...base, gpa: 2.0, sat: 800, activities: [], awards: [] }, c);
    assert.ok(weak.chance >= WEIGHTS.limits.floor - 1e-9, c.id);
  }
  assert.ok(estimateChance({ ...base, ...star }, byId('harvard')).chance <= 0.4);
});

test('less selective schools give higher chances to the same student', () => {
  assert.ok(chance({}, 'asu') > chance({}, 'wisconsin'));
  assert.ok(chance({}, 'wisconsin') > chance({}, 'harvard'));
});

test('scores have diminishing returns and stay in 0..1', () => {
  const many = Array.from({ length: 30 }, () => ({ reach: 'national', years: 4, hours: 40, leadership: true }));
  assert.ok(activitiesScore(many) < 1 && activitiesScore(many) > 0.9);
  assert.equal(activitiesScore([]), 0);
  assert.equal(awardsScore([]), 0);
});

test('categories map by threshold', () => {
  assert.equal(categoryFor(0.8).id, 'safety');
  assert.equal(categoryFor(0.5).id, 'target');
  assert.equal(categoryFor(0.2).id, 'reach');
  assert.equal(categoryFor(0.05).id, 'far');
});
