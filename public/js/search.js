// School search: matches names, cities, states, and abbreviations.
// Pure functions — shared by the UI and Node tests.

/** Lowercases and strips everything except letters and digits ("UW–Madison" → "uwmadison"). */
export const normalize = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * True when the query matches the school. Names, cities and states match from
 * the start of any word; aliases match from their start, so "uc" finds UCLA
 * and UCB, and "ucla" finds only UCLA.
 */
export function matchesSchool(school, query) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  // Match from the start of a word, so "bu" finds Boston but not Pittsburgh.
  const text = `${school.name} ${school.city} ${school.state}`.toLowerCase();
  if (new RegExp(`(^|[^a-z0-9])${escapeRegExp(q)}`).test(text)) return true;
  const nq = normalize(q);
  if (!nq) return false;
  // Abbreviations come from the hand-written `aliases` in data/colleges.json
  // (auto-generated acronyms collide too often: Brown and Boston U are both "BU").
  return (school.aliases ?? []).some((a) => normalize(a).startsWith(nq));
}
