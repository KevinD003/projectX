import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { CAPTION, NUM, ROW_TH, TD, TH, TH_NUM } from './report-table.js'

const here = path.dirname(fileURLToPath(import.meta.url))

/**
 * The classes of a constant, as a list.
 *
 * @param {string} value The class string.
 * @returns {string[]} Its classes.
 */
const classes = (value) => value.split(/\s+/u).filter(Boolean)

describe('the report table classes', () => {
  it('set a row header flush left, at body weight, with a cell’s padding and rule', () => {
    expect(classes(ROW_TH)).toEqual([...classes(TD), 'text-left', 'font-normal'])
    expect(ROW_TH).not.toMatch(/\btext-(center|right)\b/u)
  })

  it('set a column header flush left, and a numeric one right over its numbers', () => {
    expect(classes(TH)).toContain('text-left')
    expect(classes(TH_NUM)).toEqual([...classes(TH), 'text-right'])
    expect(classes(NUM)).toEqual([...classes(TD), 'text-right', 'tabular-nums'])
    expect(classes(CAPTION)).toContain('text-left')
  })

  it('are backed by a base rule that starts every header cell where its text starts', () => {
    const css = readFileSync(path.join(here, '..', 'app', 'globals.css'), 'utf8')
    const base = css.slice(css.indexOf('@layer base {'), css.indexOf('@layer components {'))

    expect(base).toMatch(/\n\s{2}th \{\n\s+text-align: start;\n\s{2}\}/u)
  })
})

describe('the row headers the money and operations tables write by hand', () => {
  it.each([
    ['finance/refunds/page.jsx', '`${TD} text-left font-normal`'],
    ['finance/refunds/[id]/page.jsx', '`${TD} text-left font-mono font-normal`'],
    ['operations/reconciliation/page.jsx', '`${TD} text-left font-normal`'],
    ['operations/reconciliation/[id]/page.jsx', '`${TD} text-left font-normal`'],
    ['operations/notifications/page.jsx', '`${TD} text-left font-normal`'],
  ])('%s sets its row header flush left', (file, expected) => {
    const source = readFileSync(path.join(here, '..', 'app', file), 'utf8')
    const rowHeaders = [...source.matchAll(/<th scope="row" className=\{(`[^`]*`)\}/gu)].map(
      ([, value]) => value,
    )

    expect(rowHeaders.length).toBeGreaterThan(0)
    for (const value of rowHeaders) expect(value).toBe(expected)
  })
})
