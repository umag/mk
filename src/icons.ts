// One coherent line-icon set: 24px viewBox, currentColor, no fills.
// The arrow is the product's signature glyph (advance).

const wrap = (paths: string, sw = 2) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

export const icons = {
  advance: wrap(`<path d="M5 12h13"/><path d="M13 6l6 6-6 6"/>`, 2.4),
  comment: wrap(`<path d="M21 11.5a8.4 8.4 0 0 1-11.6 7.8L3 21l1.7-6.4A8.4 8.4 0 1 1 21 11.5z"/>`, 1.8),
  plus: wrap(`<path d="M12 5v14M5 12h14"/>`, 2.2),
  calendar: wrap(`<rect x="3" y="4.5" width="18" height="16" rx="2"/><path d="M3 9h18M8 2.5v4M16 2.5v4"/>`, 1.9),
  clock: wrap(`<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>`, 1.9),
  close: wrap(`<path d="M6 6l12 12M18 6L6 18"/>`),
  check: wrap(`<path d="M5 12l5 5L20 7"/>`, 2.4),
  search: wrap(`<circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/>`, 1.9),
  grip: wrap(`<circle cx="9" cy="6" r="1.4" fill="currentColor" stroke="none"/><circle cx="15" cy="6" r="1.4" fill="currentColor" stroke="none"/><circle cx="9" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="9" cy="18" r="1.4" fill="currentColor" stroke="none"/><circle cx="15" cy="18" r="1.4" fill="currentColor" stroke="none"/>`),
  board: wrap(`<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16M15 4v16"/>`, 1.9),
  more: wrap(`<circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none"/>`),
  trash: wrap(`<path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13h10l1-13"/>`, 1.9),
  enter: wrap(`<path d="M9 10l-4 4 4 4"/><path d="M5 14h11a4 4 0 0 0 4-4V6"/>`, 1.9),
  jump: wrap(`<path d="M7 17 17 7M9 7h8v8"/>`, 1.9),
  column: wrap(`<rect x="4" y="4" width="6" height="16" rx="1.5"/><path d="M16 4v16"/>`, 1.9),
  sound: wrap(`<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8 8 0 0 1 0 12"/>`, 1.9),
  mute: wrap(`<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M22 9l-6 6M16 9l6 6"/>`, 1.9),
} as const;

export type IconName = keyof typeof icons;
