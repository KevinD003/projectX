/**
 * The door's motion, read from its stylesheet: what runs, for how long, and
 * that none of it runs for a reader who asked for less.
 *
 * The sweep (`accessibility-sweep.spec.js`, "the check-in screen does not
 * move") counts running animations on the door under reduced motion and
 * wants none; this pins the reason it finds none.
 */

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const here = path.dirname(fileURLToPath(import.meta.url))
const css = readFileSync(path.join(here, 'door.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//gu, '')
const page = readFileSync(path.join(here, 'page.jsx'), 'utf8')

const MOTION_SAFE = '@media (prefers-reduced-motion: no-preference) {'

/**
 * The body of the motion-safe block, braces balanced.
 *
 * @returns {string} What is inside it.
 */
function motionSafe() {
  const start = css.indexOf(MOTION_SAFE)

  expect(start).toBeGreaterThan(-1)

  let depth = 0

  for (let at = start + MOTION_SAFE.length - 1; at < css.length; at += 1) {
    if (css[at] === '{') depth += 1
    if (css[at] === '}') depth -= 1
    if (depth === 0) return css.slice(start + MOTION_SAFE.length, at)
  }

  throw new Error('The motion-safe block never closes.')
}

/** Everything outside the motion-safe block. */
const outside = css.replace(MOTION_SAFE + motionSafe() + '}', '')

describe('the door stylesheet', () => {
  it('is loaded by the check-in page', () => {
    expect(page).toContain("import './door.css'")
  })

  it('draws no scan line and no entrance outside the motion-safe block', () => {
    expect(outside).not.toMatch(/animation\s*:/u)
    expect(outside).not.toMatch(/@keyframes/u)
    expect(outside).toMatch(/\.door-scanline\s*\{[^}]*display:\s*none;/u)
  })

  it('runs the scan line on transform alone, and only where motion is welcome', () => {
    const safe = motionSafe()

    expect(safe).toMatch(
      /\.door-scanline\s*\{\s*display:\s*block;\s*animation:\s*door-scan 1\.8s linear infinite alternate;/u,
    )

    const scan = safe.match(/@keyframes door-scan\s*\{([\s\S]*?)\n {2}\}/u)?.[1] ?? ''

    expect(scan).toMatch(/transform:/u)
    expect(scan).not.toMatch(/\b(top|bottom|height|opacity|margin)\s*:/u)
  })

  it('reveals a verdict with clip-path in 200ms, never from opacity 0', () => {
    const safe = motionSafe()

    expect(safe).toMatch(
      /\.door-verdict\s*\{\s*animation:\s*door-verdict-in 200ms var\(--ease-out\) backwards;/u,
    )
    expect(safe).toMatch(/clip-path:\s*inset\(0 0 100% 0\)/u)
    expect(css).not.toMatch(/opacity\s*:\s*0\b/u)
  })

  it('locks the brackets in 160ms when a pass is read', () => {
    expect(outside).toMatch(
      /\.door-brackets\s*\{\s*transition:\s*transform 160ms var\(--ease-out\);/u,
    )
    expect(outside).toMatch(
      /\.door-viewfinder\[data-look='locked'\] \.door-brackets\s*\{\s*transform:\s*scale\(0\.96\);/u,
    )
  })

  it('takes every colour from the theme', () => {
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b|oklch\(|rgb\(/iu)
  })
})
