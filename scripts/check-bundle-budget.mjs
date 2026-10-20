/**
 * Fail when a route's client script grows past its budget.
 *
 *     pnpm run bundle:budget   (after `pnpm run build`; `bundle:scan` runs it too)
 *
 * See `scripts/lib/bundle-budget.mjs` for what is measured and why.
 *
 * @module scripts/check-bundle-budget
 */

import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import { measure } from './lib/bundle-budget.mjs'

const nextDir = path.join(fileURLToPath(new URL('..', import.meta.url)), 'apps/web/.next')

let lines

try {
  lines = await measure(nextDir)
} catch (error) {
  console.error(
    `bundle budget: cannot read the build (${error.message}). Run \`pnpm run build\` first.`,
  )
  process.exit(1)
}

for (const line of lines) {
  console.log(
    `${line.over ? 'OVER' : 'ok  '} ${line.route.padEnd(26)} ${String(line.kilobytes).padStart(6)} KB gz in ${String(line.chunks).padStart(2)} chunks (budget ${line.budget}, measured ${line.measured} when set, ${line.before} before the redesign)`,
  )
}

const over = lines.filter((line) => line.over)

if (over.length > 0) {
  console.error(`bundle budget: ${over.length} route(s) over budget.`)
  process.exit(1)
}

console.log('bundle budget: every route within budget.')
