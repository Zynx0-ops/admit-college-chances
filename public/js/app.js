// App entry: loads the dataset, mounts both panes, and wires navigation chrome.

import { store } from './store.js';
import { icon } from './icons.js';
import { mountProfile } from './views/profile.js';
import { mountSchools } from './views/schools.js';
import { openSheet } from './views/sheet.js';
import { segmented, bindSegmented } from './views/components.js';

const app = document.getElementById('app');
const params = new URLSearchParams(location.search);

// ── Theme (System / Light / Dark). ?theme=dark overrides for screenshots. ──
function applyTheme(theme) {
  if (theme === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', theme);
}
applyTheme(params.get('theme') ?? store.ui.theme);

// ── Tabs (mobile) ──
const TABS = { profile: { icon: 'person', label: 'Profile' }, schools: { icon: 'building.columns', label: 'Schools' } };
document.querySelectorAll('[data-tab-target]').forEach((btn) => {
  const t = TABS[btn.dataset.tabTarget];
  btn.innerHTML = `${icon(t.icon, { size: 26 })}<span>${t.label}</span>`;
  btn.addEventListener('click', () => setTab(btn.dataset.tabTarget));
});
function setTab(tab) {
  app.dataset.tab = tab;
  document.querySelectorAll('[data-tab-target]').forEach((b) => {
    b.classList.toggle('active', b.dataset.tabTarget === tab);
    b.setAttribute('aria-current', b.dataset.tabTarget === tab ? 'page' : 'false');
  });
  window.scrollTo({ top: 0 });
  updateScrolled();
}
setTab(params.get('tab') === 'profile' ? 'profile' : 'schools');

// ── Collapsing large titles ──
// Desktop: each pane scrolls itself. Mobile: the window scrolls.
function updateScrolled() {
  document.querySelectorAll('.pane').forEach((pane) => {
    const y = window.innerWidth < 900 ? window.scrollY : pane.scrollTop;
    pane.classList.toggle('scrolled', y > 30);
  });
}
document.querySelectorAll('.pane').forEach((p) => p.addEventListener('scroll', updateScrolled, { passive: true }));
window.addEventListener('scroll', updateScrolled, { passive: true });
window.addEventListener('resize', updateScrolled);

// ── Settings sheet ──
const settingsBtn = document.getElementById('settings-btn');
settingsBtn.innerHTML = icon('gearshape', { size: 20 });
settingsBtn.addEventListener('click', () =>
  openSheet({
    title: 'Settings',
    right: { label: 'Done' },
    body: `
      <div class="section">
        <div class="section-header">Appearance</div>
        <div class="group"><div class="row-block">${segmented('theme', [
          { value: 'system', label: 'System' },
          { value: 'light', label: 'Light' },
          { value: 'dark', label: 'Dark' },
        ], store.ui.theme, { label: 'Appearance' })}</div></div>
      </div>
      <div class="section">
        <div class="section-header">About the estimate</div>
        <div class="group prose">
          <p>Each school starts from its acceptance rate. Your GPA and test score are compared with the school’s middle 50% of admitted students; course rigor and grade trend adjust that. Activities and awards become a holistic score compared against what the school typically expects — selective schools weigh it more.</p>
          <div class="formula">log-odds = logit(acceptance) + boost
         + GPA + test + rigor + trend
         + activities + awards
chance   = sigmoid(log-odds), capped by selectivity</div>
          <p>All weights are in <code>public/config/weights.js</code> and school data is in <code>public/data/colleges.json</code>. The sample data is approximate.</p>
          <p><b>These are estimates, not guarantees.</b></p>
        </div>
      </div>
      <div class="section">
        <div class="group"><button type="button" class="row row-destructive" id="settings-reset">Reset Profile</button></div>
        <p class="section-footer">Everything stays on this device. No accounts, no servers, no tracking.</p>
      </div>`,
    onMount(el, api) {
      bindSegmented(el, (_, theme) => {
        store.setUI({ theme });
        applyTheme(theme);
      });
      el.querySelector('#settings-reset').addEventListener('click', () => {
        api.close();
        resetProfile();
      });
    },
  }),
);

// ── Reset ──
const profileRoot = document.getElementById('profile-root');
function resetProfile() {
  if (!confirm('Reset your profile to the sample student?')) return;
  store.reset();
  mountProfile(profileRoot);
}
document.getElementById('reset-btn').addEventListener('click', resetProfile);

// ── Boot ──
async function boot() {
  const res = await fetch('data/colleges.json');
  if (!res.ok) throw new Error(`Could not load data/colleges.json (${res.status})`);
  const data = await res.json();
  mountProfile(profileRoot);
  mountSchools(document.getElementById('schools-root'), data);
  if (params.get('major')) store.setUI({ major: params.get('major') });
}

boot().catch((err) => {
  document.getElementById('schools-root').innerHTML = `<div class="empty"><h3>Couldn’t load schools</h3><p>${err.message}. Start the app with <code>npm start</code> rather than opening the file directly.</p></div>`;
  console.error(err);
});
