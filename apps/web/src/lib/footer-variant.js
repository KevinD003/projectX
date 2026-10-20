/**
 * Which footer a public page ends with.
 *
 * The persuading pages (home, the listings, an event, the directories) end
 * with the full plate: the tagline set large, the ways into the catalogue,
 * the organisers' note, the cities. A page somebody is using rather than
 * browsing (their tickets and account, signing in, a step of buying) ends
 * with the compact footer: the logo, how to reach the team, what the site
 * does not do, and the simulated-payment line. The full plate there was
 * taller than the account page it closed.
 *
 * @module lib/footer-variant
 */

/** Areas whose every page takes the compact footer. */
export const COMPACT_FOOTER_AREAS = Object.freeze(['/account', '/tickets', '/sign-in', '/register'])

/** The steps of buying under an event: its checkout and its seat maps. */
const BUYING_STEP = /^\/events\/[^/]+\/(?:checkout|seats)(?:\/|$)/u

/**
 * The footer a path ends with.
 *
 * @param {string|null|undefined} pathname The page's path, without its query.
 * @returns {'compact'|'full'} The variant.
 */
export function footerVariant(pathname) {
  const path = typeof pathname === 'string' && pathname !== '' ? pathname : '/'

  if (COMPACT_FOOTER_AREAS.some((area) => path === area || path.startsWith(`${area}/`))) {
    return 'compact'
  }

  return BUYING_STEP.test(path) ? 'compact' : 'full'
}
