// Small reusable iOS-style controls, rendered as HTML strings + wired by helpers.

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const pct = (p) => (p < 0.01 ? '<1' : p > 0.99 ? '>99' : Math.round(p * 100));

/** Segmented control. options: [{value, label}] */
export function segmented(name, options, value, { label } = {}) {
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  return `<div class="segmented" role="radiogroup" ${label ? `aria-label="${esc(label)}"` : ''} data-seg="${name}" style="--count:${options.length};--index:${index}">
    ${options
      .map(
        (o) =>
          `<button type="button" role="radio" aria-checked="${o.value === value}" data-value="${esc(o.value)}">${esc(o.label)}</button>`,
      )
      .join('')}
  </div>`;
}

/** Wires every segmented control under root; onChange(name, value). */
export function bindSegmented(root, onChange) {
  root.querySelectorAll('.segmented').forEach((seg) => {
    seg.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-value]');
      if (!btn) return;
      const buttons = [...seg.querySelectorAll('button')];
      buttons.forEach((b) => b.setAttribute('aria-checked', String(b === btn)));
      seg.style.setProperty('--index', buttons.indexOf(btn));
      onChange(seg.dataset.seg, btn.dataset.value);
    });
    // Arrow-key support, like a native radio group
    seg.addEventListener('keydown', (e) => {
      if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
      const buttons = [...seg.querySelectorAll('button')];
      const i = buttons.findIndex((b) => b.getAttribute('aria-checked') === 'true');
      const next = buttons[(i + (e.key === 'ArrowRight' ? 1 : buttons.length - 1)) % buttons.length];
      next.focus();
      next.click();
    });
  });
}

export function toggle(id, checked, label) {
  return `<label class="toggle"><input type="checkbox" role="switch" id="${id}" ${checked ? 'checked' : ''} aria-label="${esc(label)}"><span></span></label>`;
}

/** Circular progress ring. Returns an element-ready HTML string. */
export function ring(value, { size = 56, stroke = 6, color = 'var(--blue)', text = '', fontSize = 15 } = {}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return `<div class="ring" style="width:${size}px;height:${size}px" data-c="${c}">
    <svg width="${size}" height="${size}">
      <circle class="track" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="${stroke}"/>
      <circle class="progress" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="${stroke}" stroke-linecap="round"
        stroke="${color}" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - value)}"/>
    </svg>
    <span class="ring-value" style="font-size:${fontSize}px">${text}</span>
  </div>`;
}

/** Updates an existing ring in place so the CSS transition animates it. */
export function updateRing(el, value, { color, text } = {}) {
  const c = Number(el.dataset.c);
  const prog = el.querySelector('.progress');
  prog.setAttribute('stroke-dashoffset', c * (1 - value));
  if (color) prog.setAttribute('stroke', color);
  if (text != null) el.querySelector('.ring-value').innerHTML = text;
}

export const CATEGORY_COLOR = {
  safety: 'var(--green)',
  target: 'var(--blue)',
  reach: 'var(--orange)',
  far: 'var(--red)',
};

/** Sets a range input's filled-track percentage. */
export function paintSlider(input) {
  const p = ((input.value - input.min) / (input.max - input.min)) * 100;
  input.style.setProperty('--pct', `${p}%`);
}
