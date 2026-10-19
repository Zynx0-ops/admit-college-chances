// SF Symbols–style line icons drawn as inline SVG (SF Symbols themselves can't
// be redistributed on the web). Names mirror their SF Symbol counterparts.

const paths = {
  'graduationcap': '<path d="M2.5 9 12 4.5 21.5 9 12 13.5z"/><path d="M6.5 11v4.2c0 1.5 2.5 3.3 5.5 3.3s5.5-1.8 5.5-3.3V11"/><path d="M21.5 9v5"/>',
  'person': '<circle cx="12" cy="8" r="3.8"/><path d="M4.5 20c.8-3.8 3.8-6 7.5-6s6.7 2.2 7.5 6"/>',
  'building.columns': '<path d="M3 9.5 12 4l9 5.5z"/><path d="M5.5 10v7.5M9.8 10v7.5M14.2 10v7.5M18.5 10v7.5"/><path d="M3.5 20h17"/>',
  'plus': '<path d="M12 5v14M5 12h14"/>',
  'plus.circle.fill': '<circle cx="12" cy="12" r="9.5" fill="currentColor" stroke="none"/><path d="M12 7.5v9M7.5 12h9" stroke="var(--icon-on-fill,#fff)"/>',
  'chevron.right': '<path d="m9.5 5.5 6.5 6.5-6.5 6.5"/>',
  'chevron.down': '<path d="m5.5 9.5 6.5 6.5 6.5-6.5"/>',
  'xmark': '<path d="m6.5 6.5 11 11M17.5 6.5l-11 11"/>',
  'xmark.circle.fill': '<circle cx="12" cy="12" r="9.5" fill="currentColor" stroke="none"/><path d="m8.8 8.8 6.4 6.4M15.2 8.8l-6.4 6.4" stroke="var(--icon-on-fill,#fff)"/>',
  'gearshape': '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7"/><circle cx="12" cy="12" r="6.6"/>',
  'magnifyingglass': '<circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 5 5"/>',
  'trophy': '<path d="M7.5 4.5h9v5a4.5 4.5 0 0 1-9 0z"/><path d="M7.5 6.5H4.5v1.2a3 3 0 0 0 3 3M16.5 6.5h3v1.2a3 3 0 0 1-3 3"/><path d="M12 14v3.5M8.5 20h7M9.5 17.5h5"/>',
  'star': '<path d="m12 3.8 2.5 5.2 5.7.8-4.1 4 1 5.6L12 16.7l-5.1 2.7 1-5.6-4.1-4 5.7-.8z"/>',
  'figure.run': '<circle cx="14.5" cy="4.8" r="1.8"/><path d="m8 21 3-5.5 3 2.5 1-6-4.5-2-3.5 3.5M14.5 12l3 2.5 2.5-1"/>',
  'info.circle': '<circle cx="12" cy="12" r="9.5"/><path d="M12 11v5.5"/><circle cx="12" cy="7.6" r=".6" fill="currentColor"/>',
  'trash': '<path d="M4.5 6.5h15M9.5 6.5V4.5h5v2M6.5 6.5l1 13h9l1-13M10 10v6.5M14 10v6.5"/>',
  'arrow.counterclockwise': '<path d="M5 12a7 7 0 1 0 2.1-5"/><path d="M5 4.5V8h3.5"/>',
  'slider.horizontal.3': '<path d="M4 6.5h9M17 6.5h3M4 12h3M11 12h9M4 17.5h11M19 17.5h1"/><circle cx="15" cy="6.5" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="17.5" r="2"/>',
  'book': '<path d="M12 6.5C10 5 7 4.5 3.5 5v13c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5C17 4.5 14 5 12 6.5zM12 6.5v13"/>',
  'pencil': '<path d="m15.5 4.5 4 4L8.5 19.5H4.5v-4z"/>',
  'checkmark': '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
};

/** Returns an inline SVG string for the named icon. */
export function icon(name, { size = 20, cls = '' } = {}) {
  return `<svg class="icon ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ?? ''}</svg>`;
}
