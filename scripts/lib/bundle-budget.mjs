/**
 * How much script a route asks the browser for, and the most it may.
 *
 * Measured the way the finish review measured it: every client chunk a
 * route's client-reference manifest names (`.next/server/app/<route>_client-
 * reference-manifest.js`), each gzipped, summed. That is what a first visit
 * to the route downloads before it can hydrate, shared chunks included.
 *
 * Each budget is the figure measured on the build that set it plus a margin
 * of `MARGIN_KB`: room for ordinary growth (a component, some copy), not for
 * another library. The figure on `main` before the redesign is kept beside
 * it, and no budget may be half again over it: the regression this guards
 * against put Base UI and Sonner in the chunk every route loads, through one
 * client barrel and a root toaster, and nearly doubled every page.
 *
 * When a change moves a figure on purpose, measure it (`pnpm run build`,
 * then `pnpm run bundle:budget`), write the new figure in `measured` and set
 * `budget` from it; `packages/config/tests/bundle-budget.test.js` holds the
 * two together.
 *
 * @module scripts/lib/bundle-budget
 */

import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { gzipSync } from 'node:zlib'

/** The headroom over a measured figure, in KB gzipped. */
export const MARGIN_KB = 8

/** How far over its pre-redesign figure a route's budget may be: half again. */
export const MAX_GROWTH = 1.5

/**
 * Each route checked: its manifest's path under `.next/server/app`, the
 * figure on `main` before the redesign, the figure measured when this
 * budget was set, and the budget (KB gzipped). Measured on the build of the
 * commit that split the client barrel; the review's before figures come from
 * a build of `main` measured the same way.
 *
 * @type {ReadonlyArray<{route: string, manifest: string, before: number, measured: number, budget: number}>}
 */
export const BUDGETS = Object.freeze([
  { route: '/', manifest: '(home)/page', before: 70.0, measured: 78.1, budget: 87 },
  { route: '/events', manifest: 'events/page', before: 75.0, measured: 83.2, budget: 92 },
  {
    route: '/events/[slug]',
    manifest: 'events/[slug]/page',
    before: 70.0,
    measured: 78.7,
    budget: 87,
  },
  {
    route: '/tickets/[id]',
    manifest: 'tickets/[id]/page',
    before: 88.1,
    measured: 106.9,
    budget: 115,
  },
  {
    route: '/organizer/check-in',
    manifest: 'organizer/check-in/page',
    before: 89.3,
    measured: 108.3,
    budget: 117,
  },
  {
    route: '/events/[slug]/checkout',
    manifest: 'events/[slug]/checkout/page',
    before: 190.1,
    measured: 95.0,
    budget: 103,
  },
  { route: '/admin', manifest: 'admin/page', before: 64.6, measured: 81.6, budget: 90 },
])

/**
 * The client chunks a client-reference manifest names, each once.
 *
 * @param {string} manifest The manifest's source.
 * @returns {string[]} Paths such as `static/chunks/abc.js`.
 */
export function chunksIn(manifest) {
  return [...new Set(manifest.match(/static\/chunks\/[A-Za-z0-9_.~-]+\.js/gu) ?? [])].sort()
}

/**
 * Sum the gzipped size of some files.
 *
 * @param {Buffer[]} contents The files' bytes.
 * @returns {number} Kilobytes, gzipped, to one decimal place.
 */
export function gzippedKilobytes(contents) {
  const bytes = contents.reduce((sum, content) => sum + gzipSync(content, { level: 9 }).length, 0)

  return Math.round((bytes / 1024) * 10) / 10
}

/**
 * Measure every budgeted route of a build.
 *
 * @param {string} nextDir The build's `.next` directory.
 * @returns {Promise<Array<{route: string, chunks: number, kilobytes: number, budget: number, measured: number, before: number, over: boolean}>>} One line per route.
 */
export async function measure(nextDir) {
  const lines = []

  for (const { route, manifest, before, measured, budget } of BUDGETS) {
    const file = path.join(nextDir, 'server', 'app', `${manifest}_client-reference-manifest.js`)
    const chunks = chunksIn(await readFile(file, 'utf8'))
    const contents = await Promise.all(chunks.map((chunk) => readFile(path.join(nextDir, chunk))))
    const kilobytes = gzippedKilobytes(contents)

    lines.push({
      route,
      chunks: chunks.length,
      kilobytes,
      budget,
      measured,
      before,
      over: kilobytes > budget,
    })
  }

  return lines
}
