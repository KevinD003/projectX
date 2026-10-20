/**
 * Which navigation entry is the current one.
 *
 * Its own module, and deliberately so. The client component that renders the
 * navigation needs this function and nothing else from the navigation layer;
 * `lib/navigation.js` reaches `lib/session.js`, which imports `next/headers`,
 * and a client component that transitively imports `next/headers` fails the
 * build. Splitting the pure predicate out keeps the browser bundle free of the
 * server-only read while leaving one implementation of the rule.
 *
 * @module lib/active-path
 */

/**
 * Whether a path is the active one, for `aria-current`.
 *
 * Prefix matching, so `/organizer/events/abc` still marks the `Events` entry —
 * but anchored at a segment boundary, because a naive `startsWith` would let
 * `/privacy-policy` light up `/privacy`. The root is compared exactly for the
 * same reason: every path starts with a slash.
 *
 * @param {string} href The entry's destination, query string and all.
 * @param {string|null|undefined} pathname The current path.
 * @returns {boolean} True when the entry should be marked current.
 */
export function isActivePath(href, pathname) {
  if (!pathname) return false

  const target = href.split('?')[0]

  if (target === '/') return pathname === '/'
  if (pathname === target) return true

  return pathname.startsWith(`${target}/`)
}

/**
 * Whether a path's percent-escapes decode.
 *
 * @param {string} pathname The path.
 * @returns {boolean} True when they do.
 */
function decodes(pathname) {
  try {
    decodeURIComponent(pathname)

    return true
  } catch {
    return false
  }
}

/**
 * Pages that live at their own address but belong to another entry's
 * section. A seating map's version (`/organizer/map-versions/abc`) is reached
 * from a venue and is about that venue, so the rail marks "Venues" rather
 * than letting the prefix rule fall back to "Overview".
 *
 * @type {ReadonlyArray<Array<string>>}
 */
export const SECTION_OF = Object.freeze([['/organizer/map-versions', '/organizer/venues']])

/**
 * The path a page is filed under for navigation.
 *
 * @param {string|null|undefined} pathname The current path.
 * @returns {string|null|undefined} The section's path, or the path itself.
 */
function filedUnder(pathname) {
  if (!pathname) return pathname

  for (const [prefix, section] of SECTION_OF) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return section
  }

  return pathname
}

/**
 * The one entry, out of a list, that names the current page.
 *
 * `isActivePath` ignores the query string, which is right for a single link
 * and wrong for a row of them: "All events", "Garba" and "Comedy" all point at
 * `/events`, and before Phase 4 all three carried `aria-current="page"` on
 * every events page — a screen reader was told it was in three places at once.
 *
 * So among the entries whose path matches, the one whose query parameters are
 * all present in the current URL, with the most of them, wins; ties go to the
 * longer path. At most one entry is ever current.
 *
 * @param {ReadonlyArray<{href: string}>} items The entries.
 * @param {string|null|undefined} pathname The current path.
 * @param {URLSearchParams|{get: function(string): (string|null)}|null} [search] The current query.
 * @returns {string|null} The href of the current entry, or null when none is.
 */
export function currentHref(items, pathname, search = null) {
  // An address that cannot be decoded is in no section: it is answered by the
  // page for an unreadable address (`src/proxy.js`), which the server renders
  // at its own path, so marking a section here would also make the browser's
  // navigation disagree with the server's.
  if (pathname && !decodes(pathname)) return null

  const filed = filedUnder(pathname)
  let best = null
  let bestScore = -1

  for (const item of items) {
    if (!isActivePath(item.href, filed)) continue

    const [path, query = ''] = item.href.split('?')
    const wanted = [...new URLSearchParams(query)]
    const satisfied = wanted.every(([key, value]) => search?.get?.(key) === value)

    if (!satisfied) continue

    // More matched parameters beat fewer; a longer path beats a shorter one.
    const score = wanted.length * 1000 + path.length

    if (score > bestScore) {
      best = item.href
      bestScore = score
    }
  }

  return best
}
