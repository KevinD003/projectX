/**
 * The ticket's motion, read from its stylesheet.
 *
 * The pass reveal opens a clip over a panel that is already in place. What
 * matters as much as the reveal is what is left once it ends: nothing. A
 * clip-path that stays applied at rest cuts off every outline drawn outside
 * the panel's box, the focus ring on "Hide pass" included (WCAG 2.4.7).
 */

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const here = path.dirname(fileURLToPath(import.meta.url))
const css = readFileSync(path.join(here, 'commerce.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//gu, '')

describe('the pass reveal', () => {
  it('holds its clip only before and during the reveal, never at rest', () => {
    expect(css).toMatch(
      /\.ticket-reveal\s*\{\s*animation:\s*ticket-reveal 280ms var\(--ease-out\) backwards;\s*\}/u,
    )
    expect(css).not.toMatch(/ticket-reveal 280ms[^;]*\b(both|forwards)\b/u)
  })

  it('runs only for a reader who has not asked for less motion', () => {
    const safe = css.indexOf('@media (prefers-reduced-motion: no-preference)')
    const rule = css.indexOf('.ticket-reveal {')

    expect(safe).toBeGreaterThan(-1)
    expect(rule).toBeGreaterThan(safe)
  })

  it('sets no clip-path on the pass outside its keyframes', () => {
    const outsideKeyframes = css.replace(/@keyframes[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/gu, '')

    expect(outsideKeyframes).not.toMatch(/clip-path/u)
  })
})
