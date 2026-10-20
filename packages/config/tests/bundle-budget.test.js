import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  BUDGETS,
  MARGIN_KB,
  MAX_GROWTH,
  chunksIn,
  gzippedKilobytes,
  measure,
} from '../../../scripts/lib/bundle-budget.mjs'

describe('the bundle budget', () => {
  it('reads each client chunk a manifest names, once', () => {
    const manifest =
      'self.__RSC_MANIFEST={"a":{"chunks":["static/chunks/0stp_-po_lz8h.js","static/chunks/b~c.js"]},"b":{"chunks":["static/chunks/0stp_-po_lz8h.js","/_next/static/css/x.css"]}}'

    expect(chunksIn(manifest)).toEqual(['static/chunks/0stp_-po_lz8h.js', 'static/chunks/b~c.js'])
    expect(chunksIn('nothing here')).toEqual([])
  })

  it('sums gzipped sizes, in kilobytes', () => {
    expect(gzippedKilobytes([])).toBe(0)
    expect(gzippedKilobytes([Buffer.alloc(200_000, 'a')])).toBeLessThan(1)
    expect(
      gzippedKilobytes([Buffer.from(crypto.getRandomValues(new Uint8Array(30_000)))]),
    ).toBeGreaterThan(29)
  })

  it('sets every budget at its measured figure plus the margin, and none half again over main', () => {
    for (const entry of BUDGETS) {
      expect(entry.budget, entry.route).toBe(Math.ceil(entry.measured + MARGIN_KB))
      expect(entry.budget, entry.route).toBeLessThanOrEqual(entry.before * MAX_GROWTH)
    }
    expect(MARGIN_KB).toBe(8)
    expect(MAX_GROWTH).toBe(1.5)
  })

  it('holds the home page to 87 KB gzipped, against 70.0 on main before the redesign', () => {
    expect(BUDGETS.find((entry) => entry.route === '/')).toEqual({
      route: '/',
      manifest: '(home)/page',
      before: 70.0,
      measured: 78.1,
      budget: 87,
    })
  })

  it('checks the public pages, the wallet, the door, checkout and the admin overview', () => {
    expect(BUDGETS.map((entry) => entry.route)).toEqual([
      '/',
      '/events',
      '/events/[slug]',
      '/tickets/[id]',
      '/organizer/check-in',
      '/events/[slug]/checkout',
      '/admin',
    ])
  })

  it('reports a route over its budget, and reads a real build', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'bundle-budget-'))
    const manifestDir = path.join(root, 'server', 'app')
    const chunkDir = path.join(root, 'static', 'chunks')

    mkdirSync(chunkDir, { recursive: true })
    for (const entry of BUDGETS) {
      const file = path.join(manifestDir, `${entry.manifest}_client-reference-manifest.js`)
      const chunk = `static/chunks/${entry.manifest.replace(/[^a-z]/gu, '')}.js`

      mkdirSync(path.dirname(file), { recursive: true })
      writeFileSync(file, `self.__RSC_MANIFEST={"x":{"chunks":["${chunk}"]}}`)
      writeFileSync(path.join(root, chunk), 'x')
    }
    // The home page's one chunk: random bytes do not compress, so about 100 KB
    // of them is about 100 KB gzipped, over its 87. (getRandomValues fills at
    // most 64 KiB a call.)
    writeFileSync(
      path.join(chunkDir, 'homepage.js'),
      Buffer.concat([
        Buffer.from(crypto.getRandomValues(new Uint8Array(65_536))),
        Buffer.from(crypto.getRandomValues(new Uint8Array(37_000))),
      ]),
    )

    try {
      const lines = await measure(root)

      expect(lines.filter((line) => line.over).map((line) => line.route)).toEqual(['/'])
      expect(lines.find((line) => line.route === '/').kilobytes).toBeGreaterThan(100)
      expect(lines.find((line) => line.route === '/admin')).toMatchObject({
        chunks: 1,
        over: false,
      })
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
