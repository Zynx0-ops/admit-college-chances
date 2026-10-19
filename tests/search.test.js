// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { matchesSchool, normalize } from '../public/js/search.js';

const { colleges } = JSON.parse(readFileSync(new URL('../public/data/colleges.json', import.meta.url)));
const find = (q) => colleges.filter((c) => matchesSchool(c, q)).map((c) => c.id).sort();

test('abbreviations find the right school', () => {
  assert.deepEqual(find('MIT'), ['mit']);
  assert.deepEqual(find('ucla'), ['ucla']);
  assert.deepEqual(find('UPenn'), ['upenn']);
  assert.deepEqual(find('georgia tech'), ['gatech']);
  assert.deepEqual(find('UW-Madison'), ['wisconsin']);
  assert.deepEqual(find('BU'), ['bu']);
});

test('alias prefixes match several schools', () => {
  const uc = find('UC');
  for (const id of ['ucla', 'berkeley', 'uchicago']) assert.ok(uc.includes(id), id);
  assert.ok(find('UW').includes('uw') && find('UW').includes('wisconsin'));
});

test('names, cities and states still match', () => {
  assert.deepEqual(find('stanford'), ['stanford']);
  assert.ok(find('Boston').includes('bu'));
  assert.ok(find('TX').includes('rice'));
  assert.equal(find('').length, colleges.length);
  assert.deepEqual(find('zzzz'), []);
});

test('aliases are well-formed and unique per school', () => {
  for (const c of colleges) {
    if (!c.aliases) continue;
    assert.ok(Array.isArray(c.aliases), c.id);
    const norm = c.aliases.map(normalize);
    assert.ok(norm.every(Boolean), c.id);
    assert.equal(new Set(norm).size, norm.length, `${c.id} has duplicate aliases`);
  }
});
