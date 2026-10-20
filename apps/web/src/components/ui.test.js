/**
 * The app's client barrel stays light: every route loads it, so it must not
 * name the floating layers (Base UI's Popover, Menu, Tooltip) or the toaster
 * (Sonner), and nothing mounts a toaster nobody calls.
 */

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const here = path.dirname(fileURLToPath(import.meta.url))
const read = (...parts) => readFileSync(path.join(here, ...parts), 'utf8')

describe('components/ui.jsx', () => {
  it('re-exports the light primitives only, from their own entry', async () => {
    const source = read('ui.jsx')
    const ui = await import('./ui.jsx')

    expect(source).toMatch(/from '@desi-event\/ui\/primitives'/u)
    expect(source).not.toMatch(/from '@desi-event\/ui'\s*$/mu)
    for (const heavy of ['Popover', 'Menu', 'Tooltip', 'Toaster', 'toast']) {
      expect(ui, heavy).not.toHaveProperty(heavy)
    }
    expect(typeof ui.Button).toBe('function')
    expect(typeof ui.Modal).toBe('function')
  })

  it('leaves the root layout without a toaster, since nothing calls toast()', () => {
    expect(read('..', 'app', 'layout.jsx')).not.toMatch(/Toaster|toast/u)
  })

  it('loads the header search’s popover only on first use', () => {
    const search = read('header-search.jsx')

    expect(search).toMatch(/lazy\(load\)/u)
    expect(search).toMatch(/import\('\.\/header-search-popover\.jsx'\)/u)
    expect(search).not.toMatch(/@desi-event\/ui\/popover|Popover\b.*from/u)
    expect(read('header-search-popover.jsx')).toMatch(/from '@desi-event\/ui\/popover'/u)
  })

  it('loads the workspace bar’s menu, page finder and folded tooltips only on first use', () => {
    const nav = read('workspace-nav.jsx')

    expect(nav).toMatch(/import\('\.\/workspace-floating\.jsx'\)/u)
    expect(nav).not.toMatch(/from '@desi-event\/ui\/(menu|popover|tooltip)'/u)
    expect(nav).not.toMatch(/from '\.\/ui\.jsx'/u)

    const floating = read('workspace-floating.jsx')

    for (const layer of ['menu', 'popover', 'tooltip']) {
      expect(floating).toMatch(new RegExp(`from '@desi-event/ui/${layer}'`, 'u'))
    }
  })
})
