// Schools list: major filter, search, sort, category chips, and detail sheet.

import { store } from '../store.js';
import { icon } from '../icons.js';
import { estimateAll, estimateChance } from '../scoring.js';
import { WEIGHTS } from '../../config/weights.js';
import { esc, pct, segmented, bindSegmented, ring, updateRing, CATEGORY_COLOR } from './components.js';
import { openSheet } from './sheet.js';

let DATA = { majors: [], colleges: [] };
const cards = new Map(); // school id → card element (reused so rings animate)

const SORTS = [
  { value: 'chance', label: 'Best Chance' },
  { value: 'selectivity', label: 'Selectivity' },
  { value: 'name', label: 'Name' },
];
const POLICY = { required: 'Required', optional: 'Optional', blind: 'Test-blind' };

const majorName = (id) => (id === 'all' ? 'All Majors' : DATA.majors.find((m) => m.id === id)?.name ?? id);
const rateText = (r) => `${(r * 100).toFixed(r < 0.1 ? 1 : 0)}%`;

export function mountSchools(root, data) {
  DATA = data;
  const ui = store.ui;
  root.innerHTML = `
    <div class="notice" role="note">
      ${icon('info.circle', { size: 18 })}
      <span><b>Estimates, not guarantees.</b> Chances come from a simple, adjustable model using a sample dataset — real admissions are holistic and unpredictable. Tap any school to see how its number is calculated.</span>
    </div>
    <div class="toolbar">
      <button type="button" class="major-btn" id="major-btn" aria-haspopup="dialog">
        <span class="symbol-tile" style="background:var(--indigo)">${icon('graduationcap')}</span>
        <span class="row-label"><span class="eyebrow">Intended major</span><br><span class="value" id="major-value"></span></span>
        <span class="row-chevron">${icon('chevron.right', { size: 16 })}</span>
      </button>
      <label class="search" id="search">
        ${icon('magnifyingglass', { size: 17 })}
        <input type="search" id="search-input" placeholder="Search schools or states" autocomplete="off" aria-label="Search schools">
        <button type="button" class="clear" aria-label="Clear search">${icon('xmark.circle.fill', { size: 17 })}</button>
      </label>
      ${segmented('sort', SORTS, ui.sort, { label: 'Sort by' })}
      <div class="chips" id="cat-chips" role="group" aria-label="Filter by chance"></div>
    </div>
    <div class="result-meta"><span id="result-count"></span><span id="result-major"></span></div>
    <div class="school-list" id="school-list" aria-live="polite"></div>`;

  root.querySelector('#major-btn').addEventListener('click', openMajorPicker);
  const search = root.querySelector('#search');
  const input = root.querySelector('#search-input');
  input.addEventListener('input', () => {
    search.classList.toggle('has-text', !!input.value);
    store.setUI({ search: input.value });
  });
  search.querySelector('.clear').addEventListener('click', (e) => {
    e.preventDefault();
    input.value = '';
    search.classList.remove('has-text');
    store.setUI({ search: '' });
    input.focus();
  });
  bindSegmented(root, (name, value) => store.setUI({ [name]: value }));
  root.querySelector('#cat-chips').addEventListener('click', (e) => {
    const chip = e.target.closest('[data-cat]');
    if (chip) store.setUI({ category: chip.dataset.cat });
  });
  root.querySelector('#school-list').addEventListener('click', (e) => {
    const card = e.target.closest('[data-school]');
    if (card) openSchool(card.dataset.school);
  });

  let frame;
  const schedule = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => render(root));
  };
  store.subscribe(schedule);
  render(root);

  // Deep link: ?school=<id> opens that school's detail sheet.
  const deepLink = new URLSearchParams(location.search).get('school');
  if (DATA.colleges.some((c) => c.id === deepLink)) openSchool(deepLink);
}

function render(root) {
  const { major, sort, category, search } = store.ui;
  root.querySelector('#major-value').textContent = majorName(major);

  // 1. Filter by intended major, then estimate every remaining school.
  const offered = DATA.colleges.filter((c) => major === 'all' || c.majors.includes(major));
  const q = search.trim().toLowerCase();
  const searched = q
    ? offered.filter((c) => `${c.name} ${c.city} ${c.state}`.toLowerCase().includes(q))
    : offered;
  const results = estimateAll(store.profile, searched);

  // 2. Category chips with live counts.
  const counts = Object.fromEntries(WEIGHTS.categories.map((c) => [c.id, 0]));
  results.forEach((r) => counts[r.category.id]++);
  root.querySelector('#cat-chips').innerHTML = [
    { id: 'all', label: 'All', n: results.length },
    ...WEIGHTS.categories.map((c) => ({ ...c, n: counts[c.id] })),
  ]
    .map(
      (c) => `<button type="button" class="chip" data-cat="${c.id}" aria-pressed="${category === c.id}">
        ${c.id !== 'all' ? `<span class="dot" style="background:${CATEGORY_COLOR[c.id]}"></span>` : ''}${esc(c.label)} <span class="count">${c.n}</span>
      </button>`,
    )
    .join('');

  // 3. Category filter + sort.
  const shown = results.filter((r) => category === 'all' || r.category.id === category);
  const sorters = {
    chance: (a, b) => b.chance - a.chance || a.school.name.localeCompare(b.school.name),
    selectivity: (a, b) => a.school.acceptanceRate - b.school.acceptanceRate,
    name: (a, b) => a.school.name.localeCompare(b.school.name),
  };
  shown.sort(sorters[sort] ?? sorters.chance);

  root.querySelector('#result-count').textContent = `${shown.length} ${shown.length === 1 ? 'school' : 'schools'}`;
  root.querySelector('#result-major').textContent = major === 'all' ? '' : `offering ${majorName(major)}`;

  // 4. Keyed update so existing cards animate instead of being rebuilt.
  const list = root.querySelector('#school-list');
  const keep = new Set(shown.map((r) => r.school.id));
  for (const [id, el] of cards) if (!keep.has(id)) { el.remove(); cards.delete(id); }

  shown.forEach((r, i) => {
    let el = cards.get(r.school.id);
    if (!el) {
      el = createCard(r);
      el.style.animationDelay = `${Math.min(i, 12) * 18}ms`;
      cards.set(r.school.id, el);
    } else {
      updateCard(el, r);
    }
    if (list.children[i] !== el) list.insertBefore(el, list.children[i] ?? null);
  });

  const empty = list.querySelector('.empty');
  if (!shown.length && !empty) {
    list.insertAdjacentHTML(
      'beforeend',
      `<div class="empty">${icon('magnifyingglass', { size: 40 })}<h3>No Schools</h3><p>Try another major, search, or chance filter.</p></div>`,
    );
  } else if (shown.length && empty) empty.remove();
}

function createCard(r) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'school-card';
  el.dataset.school = r.school.id;
  const s = r.school;
  el.innerHTML = `
    ${ring(r.chance, { size: 58, stroke: 5.5, color: CATEGORY_COLOR[r.category.id], text: `${pct(r.chance)}<small style="font-size:10px;font-weight:600">%</small>`, fontSize: 16 })}
    <span class="school-info">
      <span class="school-name" style="display:block">${esc(s.name)}</span>
      <span class="school-sub" style="display:block">${esc(s.city)}, ${esc(s.state)} · ${s.type} · ${rateText(s.acceptanceRate)} admit</span>
      <span class="school-tags"><span class="pill"></span></span>
    </span>
    <span class="row-chevron">${icon('chevron.right', { size: 16 })}</span>`;
  updateCard(el, r);
  return el;
}

function updateCard(el, r) {
  updateRing(el.querySelector('.ring'), r.chance, {
    color: CATEGORY_COLOR[r.category.id],
    text: `${pct(r.chance)}<small style="font-size:10px;font-weight:600">%</small>`,
  });
  const pill = el.querySelector('.pill');
  pill.className = `pill cat-${r.category.id}`;
  pill.textContent = r.category.label;
  el.setAttribute('aria-label', `${r.school.name}, estimated ${pct(r.chance)} percent chance, ${r.category.label}`);
}

// ── Major picker sheet ──────────────────────────────────────────────────────

function openMajorPicker() {
  const counts = Object.fromEntries(DATA.majors.map((m) => [m.id, DATA.colleges.filter((c) => c.majors.includes(m.id)).length]));
  const items = [{ id: 'all', name: 'All Majors' }, ...DATA.majors];
  const rows = (q) =>
    items
      .filter((m) => m.name.toLowerCase().includes(q.toLowerCase()))
      .map(
        (m) => `<button type="button" class="row" data-major="${m.id}">
          <span class="row-label"><span class="row-title">${esc(m.name)}</span></span>
          <span class="row-value">${m.id === 'all' ? DATA.colleges.length : counts[m.id]}</span>
          <span class="check" style="width:20px">${store.ui.major === m.id ? icon('checkmark', { size: 20 }) : ''}</span>
        </button>`,
      )
      .join('') || `<div class="row"><span class="row-subtitle">No matching majors</span></div>`;

  openSheet({
    title: 'Intended Major',
    right: { label: 'Done' },
    body: `
      <label class="search" style="margin-bottom:16px">${icon('magnifyingglass', { size: 17 })}<input type="search" id="major-search" placeholder="Search majors" aria-label="Search majors"></label>
      <div class="group" id="major-list">${rows('')}</div>
      <p class="section-footer">Numbers show how many schools in the dataset offer each major.</p>`,
    onMount(el, api) {
      const list = el.querySelector('#major-list');
      el.querySelector('#major-search').addEventListener('input', (e) => (list.innerHTML = rows(e.target.value)));
      list.addEventListener('click', (e) => {
        const row = e.target.closest('[data-major]');
        if (!row) return;
        store.setUI({ major: row.dataset.major });
        api.close();
      });
    },
  });
}

// ── School detail sheet (shows the full calculation) ───────────────────────

function effectLabel(v) {
  const a = Math.abs(v);
  if (a < 0.05) return { text: 'Neutral', cls: 'effect-zero' };
  const strength = a >= 1 ? 'Strong ' : a >= 0.35 ? '' : 'Slight ';
  const text = `${strength}${v > 0 ? 'boost' : 'drag'}`;
  return { text: text[0].toUpperCase() + text.slice(1), cls: v > 0 ? 'effect-pos' : 'effect-neg' };
}

function openSchool(id) {
  const school = DATA.colleges.find((c) => c.id === id);
  const r = estimateChance(store.profile, school);
  const s = school;
  const factors = r.factors.filter((f) => f.id !== 'base');
  const maxAbs = Math.max(1.5, ...factors.map((f) => Math.abs(f.value)));

  const factorRows = factors
    .map((f) => {
      const e = effectLabel(f.value);
      const w = (Math.abs(f.value) / maxAbs) * 50;
      const left = f.value >= 0 ? 50 : 50 - w;
      return `<div class="row-block factor ${e.cls}">
        <span class="factor-name">${esc(f.label)}</span>
        <span class="factor-effect">${e.text} · ${f.value >= 0 ? '+' : '−'}${Math.abs(f.value).toFixed(2)}</span>
        <span class="factor-detail">${esc(f.detail)}</span>
        <span class="factor-bar"><span style="left:${left}%;width:${w}%"></span></span>
      </div>`;
    })
    .join('');

  const majorPills = [...s.majors]
    .sort((a, b) => majorName(a).localeCompare(majorName(b)))
    .map((m) => `<span class="pill ${m === store.ui.major ? 'current' : ''}">${esc(majorName(m))}</span>`)
    .join('');

  openSheet({
    title: s.name,
    right: { label: 'Done' },
    body: `
      <div class="detail-hero">
        ${ring(r.chance, { size: 132, stroke: 11, color: CATEGORY_COLOR[r.category.id], text: `${pct(r.chance)}<small style="font-size:18px">%</small>`, fontSize: 38 })}
        <h2>${esc(s.name)}</h2>
        <p>${esc(s.city)}, ${esc(s.state)} · ${s.type}</p>
        <span class="pill cat-${r.category.id}">${r.category.label}</span>
      </div>

      <div class="section">
        <div class="section-header">School profile</div>
        <div class="group stats">
          <div class="stat"><div class="stat-label">Acceptance rate</div><div class="stat-value">${rateText(s.acceptanceRate)}</div></div>
          <div class="stat"><div class="stat-label">Undergraduates</div><div class="stat-value">${s.size.toLocaleString()}</div></div>
          <div class="stat"><div class="stat-label">GPA middle 50%</div><div class="stat-value">${s.gpa25.toFixed(2)}–${s.gpa75.toFixed(2)}</div></div>
          <div class="stat"><div class="stat-label">SAT middle 50%</div><div class="stat-value">${s.sat25 ? `${s.sat25}–${s.sat75}` : '—'}</div></div>
          <div class="stat"><div class="stat-label">Testing</div><div class="stat-value">${POLICY[s.testPolicy]}</div></div>
          <div class="stat"><div class="stat-label">Majors offered</div><div class="stat-value">${s.majors.length} of ${DATA.majors.length}</div></div>
        </div>
      </div>

      <div class="section">
        <div class="section-header">How your estimate is calculated</div>
        <div class="group">
          <div class="row-block factor effect-zero">
            <span class="factor-name">Starting point</span>
            <span class="factor-effect">${rateText(s.acceptanceRate)} base rate</span>
            <span class="factor-detail">Every estimate starts from the school’s overall acceptance rate, then each factor below raises or lowers it.</span>
          </div>
          ${factorRows}
        </div>
        <p class="section-footer">Values are changes in log-odds (≈ +0.7 doubles your odds).${r.capped ? ` Capped at ${Math.round(r.cap * 100)}% because even top applicants are often rejected at schools this selective.` : ''} Weights live in <code>config/weights.js</code>.</p>
      </div>

      <div class="section">
        <div class="section-header">Majors</div>
        <div class="group major-tags">${majorPills}</div>
      </div>

      <div class="notice" role="note">${icon('info.circle', { size: 18 })}<span><b>This is an estimate, not a guarantee.</b> Essays, recommendations, interviews, demonstrated interest, residency, legacy, and institutional priorities aren’t modeled.</span></div>`,
  });
}
