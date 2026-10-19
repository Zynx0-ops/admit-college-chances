// Student profile form: academics, testing, activities, awards.
// Every change writes to the store, which recalculates every school's chance.

import { store, uid } from '../store.js';
import { icon } from '../icons.js';
import { activitiesScore, awardsScore, activityPoints } from '../scoring.js';
import { esc, segmented, bindSegmented, toggle, ring, updateRing, paintSlider } from './components.js';
import { openSheet } from './sheet.js';

const RIGOR = [
  { value: 'standard', label: 'Standard' },
  { value: 'moderate', label: 'Honors / AP' },
  { value: 'rigorous', label: 'Most Rigorous' },
];
const TREND = [
  { value: 'downward', label: 'Declining' },
  { value: 'steady', label: 'Steady' },
  { value: 'upward', label: 'Improving' },
];
const REACH = [
  { value: 'school', label: 'School' },
  { value: 'community', label: 'Local' },
  { value: 'state', label: 'State' },
  { value: 'national', label: 'National' },
];
const AWARD_LEVELS = [
  { value: 'school', label: 'School' },
  { value: 'regional', label: 'Regional' },
  { value: 'state', label: 'State' },
  { value: 'national', label: 'National' },
  { value: 'international', label: 'Int’l' },
];
const CATEGORIES = {
  Athletics: { icon: 'figure.run', color: 'var(--orange)' },
  Arts: { icon: 'star', color: 'var(--pink)' },
  STEM: { icon: 'slider.horizontal.3', color: 'var(--blue)' },
  Academic: { icon: 'book', color: 'var(--indigo)' },
  Service: { icon: 'person', color: 'var(--green)' },
  'Student Government': { icon: 'building.columns', color: 'var(--teal)' },
  Work: { icon: 'book', color: 'var(--label-2)' },
  Other: { icon: 'star', color: 'var(--label-2)' },
};
const AWARD_COLOR = { school: 'var(--label-2)', regional: 'var(--teal)', state: 'var(--blue)', national: 'var(--indigo)', international: 'var(--yellow)' };

const reachLabel = (v) => REACH.find((r) => r.value === v)?.label ?? v;
const levelLabel = (v) => AWARD_LEVELS.find((r) => r.value === v)?.label.replace('Int’l', 'International') ?? v;

let unsubscribe = null;

export function mountProfile(root) {
  unsubscribe?.();
  const p = store.profile;
  root.innerHTML = `
    <div class="section">
      <div class="group summary" id="summary">
        <div class="meter">${ring(p.gpa / 4, { size: 64, stroke: 6, color: 'var(--blue)', text: p.gpa.toFixed(2), fontSize: 15 })}<span class="meter-label">GPA</span></div>
        <div class="meter">${ring(0, { size: 64, stroke: 6, color: 'var(--green)', fontSize: 17 })}<span class="meter-label">Activities</span></div>
        <div class="meter">${ring(0, { size: 64, stroke: 6, color: 'var(--orange)', fontSize: 17 })}<span class="meter-label">Awards</span></div>
      </div>
    </div>

    <div class="section">
      <div class="section-header">Academics</div>
      <div class="group">
        <div class="row-block">
          <div class="field-head">
            <label class="field-label" for="gpa-input">Unweighted GPA</label>
            <input class="num-input" id="gpa-input" type="number" inputmode="decimal" min="0" max="4" step="0.01" value="${p.gpa.toFixed(2)}" aria-label="GPA value">
          </div>
          <input class="slider" id="gpa-slider" type="range" min="2" max="4" step="0.01" value="${p.gpa}" aria-label="GPA">
          <div class="scale-labels"><span>2.0</span><span>3.0</span><span>4.0</span></div>
        </div>
        <div class="row-block">
          <div class="field-head"><span class="field-label">Course rigor</span><span class="field-hint">Grades context</span></div>
          ${segmented('rigor', RIGOR, p.rigor, { label: 'Course rigor' })}
        </div>
        <div class="row-block">
          <div class="field-head"><span class="field-label">Grade trend</span></div>
          ${segmented('trend', TREND, p.trend, { label: 'Grade trend' })}
        </div>
      </div>
      <p class="section-footer">Use your unweighted GPA on a 4.0 scale. Course rigor and trend describe the grades behind it.</p>
    </div>

    <div class="section">
      <div class="section-header">Testing</div>
      <div class="group">
        <div class="row">
          <span class="row-label"><span class="row-title">Submit test scores</span></span>
          ${toggle('submit-test', p.submitTest, 'Submit test scores')}
        </div>
        <div class="row-block" id="test-block" ${p.submitTest ? '' : 'hidden'}>
          <div style="margin-bottom:14px">${segmented('testType', [{ value: 'sat', label: 'SAT' }, { value: 'act', label: 'ACT' }], p.testType, { label: 'Test type' })}</div>
          <div class="field-head">
            <label class="field-label" for="test-input" id="test-label"></label>
            <input class="num-input" id="test-input" type="number" inputmode="numeric" aria-label="Test score">
          </div>
          <input class="slider" id="test-slider" type="range" aria-label="Test score">
          <div class="scale-labels" id="test-scale"></div>
        </div>
      </div>
      <p class="section-footer">Test-optional schools won’t penalize you much for not submitting; test-required schools will. Test-blind schools ignore scores.</p>
    </div>

    <div class="section">
      <div class="section-header"><span>Activities</span><span id="act-count"></span></div>
      <div class="group" id="activities"></div>
      <p class="section-footer">Up to 10 count, strongest first. Reach, years, hours, and leadership all add weight.</p>
    </div>

    <div class="section">
      <div class="section-header"><span>Honors &amp; Awards</span><span id="award-count"></span></div>
      <div class="group" id="awards"></div>
      <p class="section-footer">Up to 5 count. Your profile is saved only in this browser.</p>
    </div>`;

  // ── GPA ──
  const gpaSlider = root.querySelector('#gpa-slider');
  const gpaInput = root.querySelector('#gpa-input');
  paintSlider(gpaSlider);
  gpaSlider.addEventListener('input', () => {
    paintSlider(gpaSlider);
    gpaInput.value = Number(gpaSlider.value).toFixed(2);
    store.setProfile({ gpa: Number(gpaSlider.value) });
  });
  gpaInput.addEventListener('change', () => {
    const v = Math.min(4, Math.max(0, Number(gpaInput.value) || 0));
    gpaInput.value = v.toFixed(2);
    gpaSlider.value = v;
    paintSlider(gpaSlider);
    store.setProfile({ gpa: v });
  });

  // ── Segmented controls ──
  bindSegmented(root, (name, value) => {
    store.setProfile({ [name]: value });
    if (name === 'testType') syncTestControls();
  });

  // ── Testing ──
  const testBlock = root.querySelector('#test-block');
  const testSlider = root.querySelector('#test-slider');
  const testInput = root.querySelector('#test-input');
  root.querySelector('#submit-test').addEventListener('change', (e) => {
    testBlock.hidden = !e.target.checked;
    store.setProfile({ submitTest: e.target.checked });
  });
  function syncTestControls() {
    const isAct = store.profile.testType === 'act';
    const [min, max, step] = isAct ? [1, 36, 1] : [400, 1600, 10];
    const value = isAct ? store.profile.act : store.profile.sat;
    Object.assign(testSlider, { min, max, step, value });
    Object.assign(testInput, { min, max, step, value });
    root.querySelector('#test-label').textContent = isAct ? 'ACT composite' : 'SAT total';
    root.querySelector('#test-scale').innerHTML = isAct
      ? '<span>1</span><span>18</span><span>36</span>'
      : '<span>400</span><span>1000</span><span>1600</span>';
    paintSlider(testSlider);
  }
  const setTest = (raw) => {
    const isAct = store.profile.testType === 'act';
    const v = Math.round(Math.min(testSlider.max, Math.max(testSlider.min, Number(raw) || 0)) / (isAct ? 1 : 10)) * (isAct ? 1 : 10);
    store.setProfile(isAct ? { act: v } : { sat: v });
    return v;
  };
  testSlider.addEventListener('input', () => {
    paintSlider(testSlider);
    testInput.value = setTest(testSlider.value);
  });
  testInput.addEventListener('change', () => {
    const v = setTest(testInput.value);
    testInput.value = v;
    testSlider.value = v;
    paintSlider(testSlider);
  });
  syncTestControls();

  // ── Lists ──
  root.querySelector('#activities').addEventListener('click', (e) => {
    const row = e.target.closest('[data-activity]');
    if (row) editActivity(row.dataset.activity === 'new' ? null : row.dataset.activity);
  });
  root.querySelector('#awards').addEventListener('click', (e) => {
    const row = e.target.closest('[data-award]');
    if (row) editAward(row.dataset.award === 'new' ? null : row.dataset.award);
  });

  renderLists(root);
  updateSummary(root);
  unsubscribe = store.subscribe((kind) => {
    if (kind !== 'profile') return;
    renderLists(root);
    updateSummary(root);
  });
}

function updateSummary(root) {
  const p = store.profile;
  const [gpaRing, actRing, awdRing] = root.querySelectorAll('#summary .ring');
  const a = activitiesScore(p.activities);
  const w = awardsScore(p.awards);
  updateRing(gpaRing, p.gpa / 4, { text: p.gpa.toFixed(2) });
  updateRing(actRing, a, { text: Math.round(a * 100) });
  updateRing(awdRing, w, { text: Math.round(w * 100) });
}

function renderLists(root) {
  const p = store.profile;
  const acts = [...p.activities].sort((x, y) => activityPoints(y) - activityPoints(x));
  root.querySelector('#act-count').textContent = p.activities.length ? `${p.activities.length}` : '';
  root.querySelector('#award-count').textContent = p.awards.length ? `${p.awards.length}` : '';

  root.querySelector('#activities').innerHTML =
    acts
      .map((a) => {
        const cat = CATEGORIES[a.category] ?? CATEGORIES.Other;
        const meta = [a.leadership ? 'Leader' : null, reachLabel(a.reach), `${a.years} yr${a.years > 1 ? 's' : ''}`, a.hours ? `${a.hours} h/wk` : null]
          .filter(Boolean)
          .join(' · ');
        return `<button type="button" class="row has-icon" data-activity="${a.id}">
          <span class="symbol-tile" style="background:${cat.color}">${icon(cat.icon)}</span>
          <span class="row-label"><span class="row-title">${esc(a.name || 'Untitled activity')}</span><span class="row-subtitle">${esc(meta)}</span></span>
          <span class="row-chevron">${icon('chevron.right', { size: 16 })}</span>
        </button>`;
      })
      .join('') +
    `<button type="button" class="row has-icon row-action" data-activity="new">
      <span class="symbol-tile" style="background:var(--blue)">${icon('plus')}</span>
      <span class="row-label">Add Activity</span>
    </button>`;

  root.querySelector('#awards').innerHTML =
    p.awards
      .map(
        (w) => `<button type="button" class="row has-icon" data-award="${w.id}">
          <span class="symbol-tile" style="background:${AWARD_COLOR[w.level] ?? 'var(--label-2)'}">${icon('trophy')}</span>
          <span class="row-label"><span class="row-title">${esc(w.name || 'Untitled award')}</span><span class="row-subtitle">${esc(levelLabel(w.level))} level</span></span>
          <span class="row-chevron">${icon('chevron.right', { size: 16 })}</span>
        </button>`,
      )
      .join('') +
    `<button type="button" class="row has-icon row-action" data-award="new">
      <span class="symbol-tile" style="background:var(--blue)">${icon('plus')}</span>
      <span class="row-label">Add Award</span>
    </button>`;
}

// ── Activity editor sheet ───────────────────────────────────────────────────

function stepperRow(id, label, value, unit) {
  return `<div class="row">
    <span class="row-label"><span class="row-title">${label}</span></span>
    <span class="stepper-value" id="${id}-value">${value} ${unit}</span>
    <span class="stepper" data-stepper="${id}">
      <button type="button" data-step="-1" aria-label="Decrease ${label}">−</button>
      <button type="button" data-step="1" aria-label="Increase ${label}">+</button>
    </span>
  </div>`;
}

function bindStepper(el, id, { min, max, get, set, unit }) {
  const wrap = el.querySelector(`[data-stepper="${id}"]`);
  const out = el.querySelector(`#${id}-value`);
  const sync = () => {
    const v = get();
    out.textContent = `${v} ${typeof unit === 'function' ? unit(v) : unit}`;
    wrap.children[0].disabled = v <= min;
    wrap.children[1].disabled = v >= max;
  };
  wrap.addEventListener('click', (e) => {
    const b = e.target.closest('[data-step]');
    if (!b) return;
    set(Math.min(max, Math.max(min, get() + Number(b.dataset.step))));
    sync();
  });
  sync();
}

function editActivity(id) {
  const existing = store.profile.activities.find((a) => a.id === id);
  const draft = existing
    ? { ...existing }
    : { id: uid(), name: '', category: 'Other', reach: 'school', years: 2, hours: 4, leadership: false };

  openSheet({
    title: existing ? 'Edit Activity' : 'New Activity',
    left: { label: 'Cancel' },
    right: {
      label: existing ? 'Done' : 'Add',
      onClick(api) {
        const list = store.profile.activities.filter((a) => a.id !== draft.id);
        draft.name = draft.name.trim() || 'Untitled activity';
        store.setProfile({ activities: existing ? store.profile.activities.map((a) => (a.id === draft.id ? draft : a)) : [...list, draft] });
        api.close();
      },
    },
    body: `
      <div class="section">
        <div class="group">
          <div class="row"><input class="text-input left" id="act-name" placeholder="Activity name" maxlength="60" value="${esc(draft.name)}" aria-label="Activity name"></div>
          <div class="row">
            <label class="row-label" for="act-cat"><span class="row-title">Category</span></label>
            <select class="select" id="act-cat">${Object.keys(CATEGORIES).map((c) => `<option ${c === draft.category ? 'selected' : ''}>${c}</option>`).join('')}</select>
          </div>
        </div>
      </div>
      <div class="section">
        <div class="section-header">Impact reach</div>
        <div class="group"><div class="row-block">${segmented('reach', REACH, draft.reach, { label: 'Impact reach' })}</div></div>
        <p class="section-footer">How far the impact or recognition of this activity extends.</p>
      </div>
      <div class="section">
        <div class="section-header">Commitment</div>
        <div class="group">
          ${stepperRow('years', 'Years', draft.years, 'yrs')}
          ${stepperRow('hours', 'Hours / week', draft.hours, 'h')}
          <div class="row">
            <span class="row-label"><span class="row-title">Leadership role</span><span class="row-subtitle">Captain, president, founder, lead…</span></span>
            ${toggle('act-lead', draft.leadership, 'Leadership role')}
          </div>
        </div>
      </div>
      ${existing ? `<div class="section"><div class="group"><button type="button" class="row row-destructive" id="act-delete">Delete Activity</button></div></div>` : ''}`,
    onMount(el, api) {
      el.querySelector('#act-name').addEventListener('input', (e) => (draft.name = e.target.value));
      el.querySelector('#act-name').addEventListener('keydown', (e) => e.key === 'Enter' && el.querySelector('[data-act="right"]').click());
      el.querySelector('#act-cat').addEventListener('change', (e) => (draft.category = e.target.value));
      el.querySelector('#act-lead').addEventListener('change', (e) => (draft.leadership = e.target.checked));
      bindSegmented(el, (_, v) => (draft.reach = v));
      bindStepper(el, 'years', { min: 1, max: 4, get: () => draft.years, set: (v) => (draft.years = v), unit: (v) => (v === 1 ? 'yr' : 'yrs') });
      bindStepper(el, 'hours', { min: 0, max: 40, get: () => draft.hours, set: (v) => (draft.hours = v), unit: 'h' });
      el.querySelector('#act-delete')?.addEventListener('click', () => {
        store.setProfile({ activities: store.profile.activities.filter((a) => a.id !== draft.id) });
        api.close();
      });
    },
  });
}

// ── Award editor sheet ──────────────────────────────────────────────────────

function editAward(id) {
  const existing = store.profile.awards.find((a) => a.id === id);
  const draft = existing ? { ...existing } : { id: uid(), name: '', level: 'school' };

  openSheet({
    title: existing ? 'Edit Award' : 'New Award',
    left: { label: 'Cancel' },
    right: {
      label: existing ? 'Done' : 'Add',
      onClick(api) {
        draft.name = draft.name.trim() || 'Untitled award';
        store.setProfile({ awards: existing ? store.profile.awards.map((a) => (a.id === draft.id ? draft : a)) : [...store.profile.awards, draft] });
        api.close();
      },
    },
    body: `
      <div class="section">
        <div class="group">
          <div class="row"><input class="text-input left" id="award-name" placeholder="Award name (e.g. AP Scholar)" maxlength="60" value="${esc(draft.name)}" aria-label="Award name"></div>
        </div>
      </div>
      <div class="section">
        <div class="section-header">Level of recognition</div>
        <div class="group"><div class="row-block">${segmented('level', AWARD_LEVELS, draft.level, { label: 'Level' })}</div></div>
        <p class="section-footer">National and international honors (e.g. National Merit, olympiads) carry the most weight.</p>
      </div>
      ${existing ? `<div class="section"><div class="group"><button type="button" class="row row-destructive" id="award-delete">Delete Award</button></div></div>` : ''}`,
    onMount(el, api) {
      el.querySelector('#award-name').addEventListener('input', (e) => (draft.name = e.target.value));
      el.querySelector('#award-name').addEventListener('keydown', (e) => e.key === 'Enter' && el.querySelector('[data-act="right"]').click());
      bindSegmented(el, (_, v) => (draft.level = v));
      el.querySelector('#award-delete')?.addEventListener('click', () => {
        store.setProfile({ awards: store.profile.awards.filter((a) => a.id !== draft.id) });
        api.close();
      });
    },
  });
}
