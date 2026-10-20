/**
 * No em dash (U+2014) in the words the site, the API and its documentation
 * show to people.
 *
 * The house style (docs/DESIGN.md, the redesign's direction) keeps the em dash
 * out of visible copy: a colon, a comma, a full stop or parentheses says the
 * same thing, and an empty cell says "None" or "Not set" in words. Every
 * string literal, template-literal part and piece of JSX text under the web
 * app's and the API's sources, and the API contract (whose route and tag
 * descriptions become the Swagger page), is read through the parser ESLint
 * uses, so comments, which are developer documentation, are never strings.
 * The development seed is read too: its events, tiers and descriptions are
 * what every demonstration of the site shows.
 *
 * @module @desi-event/config/tests/no-em-dash
 */

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { sourceFilesUnder, stringsOf } from '../src/source-name-scan.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')

/** The sources whose strings people read. */
const ROOTS = ['apps/web/src', 'apps/api/src', 'packages/api-contract/src']

/** Single files whose strings people read: the development seed's events. */
const FILES = ['packages/db/scripts/seed.mjs']

/** The em dash. */
const EM_DASH = '—'

/**
 * Every string under the roots that holds an em dash, with where it is.
 *
 * @returns {string[]} Each as `file:line: text`.
 */
function stringsWithAnEmDash() {
  const places = []
  const files = [
    ...ROOTS.flatMap((root) => sourceFilesUnder(path.join(ROOT, root))),
    ...FILES.map((file) => path.join(ROOT, file)),
  ]

  for (const file of files) {
    for (const { text, line } of stringsOf(readFileSync(file, 'utf8'))) {
      if (text.includes(EM_DASH)) places.push(`${path.relative(ROOT, file)}:${line}: ${text}`)
    }
  }

  return places
}

describe('no em dash in visible copy', () => {
  it('reads strings, template parts and JSX text, and not comments', () => {
    const code = [
      '// A comment may use one — it is not shown.',
      "const a = 'one — two'",
      'const b = `three ${a} \\u2014 four`',
      'const c = <p>five — six</p>',
    ].join('\n')

    expect(
      stringsOf(code)
        .filter(({ text }) => text.includes(EM_DASH))
        .map(({ line }) => line),
    ).toEqual([2, 3, 4])
  })

  it('finds every source file under the three roots', () => {
    for (const root of ROOTS) {
      expect(sourceFilesUnder(path.join(ROOT, root)).length, root).toBeGreaterThan(0)
    }
  })

  it('finds none in apps/web/src, apps/api/src, packages/api-contract/src or the seed', () => {
    expect(stringsWithAnEmDash()).toEqual([])
  })
})
