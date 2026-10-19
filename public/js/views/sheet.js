// iOS-style modal sheet: slides up from the bottom on phones (swipe down to
// dismiss), and appears as a centered card on wider screens.

import { esc } from './components.js';

const root = () => document.getElementById('sheet-root');

/**
 * @param {object} opts
 * @param {string} opts.title
 * @param {string} opts.body                HTML for the sheet body
 * @param {{label:string, onClick?:Function}} [opts.left]   e.g. Cancel
 * @param {{label:string, onClick?:Function, bold?:boolean}} [opts.right]  e.g. Done / Save
 * @param {(el:HTMLElement, api:object)=>void} [opts.onMount]
 * @param {Function} [opts.onClose]
 */
export function openSheet({ title, body, left, right, onMount, onClose }) {
  const scrim = document.createElement('div');
  scrim.className = 'sheet-scrim';
  const sheet = document.createElement('div');
  sheet.className = 'sheet';
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');
  sheet.setAttribute('aria-label', title);
  sheet.innerHTML = `
    <div class="sheet-grabber" aria-hidden="true"></div>
    <div class="sheet-header">
      <div class="left">${left ? `<button type="button" class="nav-btn" data-act="left">${esc(left.label)}</button>` : ''}</div>
      <div class="sheet-title">${esc(title)}</div>
      <div class="right">${right ? `<button type="button" class="nav-btn ${right.bold !== false ? 'bold' : ''}" data-act="right">${esc(right.label)}</button>` : ''}</div>
    </div>
    <div class="sheet-body">${body}</div>`;

  const previousFocus = document.activeElement;
  root().append(scrim, sheet);
  document.body.style.overflow = 'hidden';

  let closed = false;
  const api = {
    el: sheet,
    close() {
      if (closed) return;
      closed = true;
      sheet.classList.remove('open');
      scrim.classList.remove('open');
      document.removeEventListener('keydown', onKey);
      setTimeout(() => {
        sheet.remove();
        scrim.remove();
        if (!root().children.length) document.body.style.overflow = '';
        previousFocus?.focus?.({ preventScroll: true });
      }, 420);
      onClose?.();
    },
    setRightEnabled(enabled) {
      const b = sheet.querySelector('[data-act="right"]');
      if (b) b.disabled = !enabled;
    },
  };

  const onKey = (e) => {
    if (e.key === 'Escape') api.close();
  };
  document.addEventListener('keydown', onKey);
  scrim.addEventListener('click', api.close);
  sheet.querySelector('[data-act="left"]')?.addEventListener('click', () => (left.onClick ? left.onClick(api) : api.close()));
  sheet.querySelector('[data-act="right"]')?.addEventListener('click', () => (right.onClick ? right.onClick(api) : api.close()));

  enableSwipeToDismiss(sheet, api);
  onMount?.(sheet, api);

  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      sheet.classList.add('open');
      scrim.classList.add('open');
      const first = sheet.querySelector('input:not([type=range]), .sheet-header button');
      first?.focus({ preventScroll: true });
    }),
  );
  return api;
}

function enableSwipeToDismiss(sheet, api) {
  const handle = sheet.querySelector('.sheet-header');
  let startY = null;
  let dy = 0;
  handle.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button') || window.innerWidth >= 700) return;
    startY = e.clientY;
    dy = 0;
    sheet.classList.add('dragging');
    handle.setPointerCapture(e.pointerId);
  });
  handle.addEventListener('pointermove', (e) => {
    if (startY == null) return;
    dy = Math.max(0, e.clientY - startY);
    sheet.style.transform = `translateY(${dy}px)`;
  });
  const end = () => {
    if (startY == null) return;
    startY = null;
    sheet.classList.remove('dragging');
    sheet.style.transform = '';
    if (dy > 110) api.close();
  };
  handle.addEventListener('pointerup', end);
  handle.addEventListener('pointercancel', end);
}
