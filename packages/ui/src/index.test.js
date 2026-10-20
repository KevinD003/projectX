import { describe, it, expect } from 'vitest'
import * as ui from './index.js'

/**
 * The public surface other packages code against. Keeping this list explicit
 * means a rename shows up here rather than as a broken import in the web app.
 */
const PUBLIC_EXPORTS = [
  'cn',
  'Button',
  'Badge',
  'Card',
  'CardHeader',
  'CardBody',
  'CardFooter',
  'Input',
  'Textarea',
  'Select',
  'Label',
  'FormField',
  'Alert',
  'StatusIcon',
  'Spinner',
  'Skeleton',
  'EmptyState',
  'VisuallyHidden',
  'Modal',
  'Tabs',
  // Poster House additions.
  'ButtonLink',
  'buttonClasses',
  'textLinkClasses',
  'TextLink',
  'Sheet',
  'Popover',
  'Menu',
  'Tooltip',
  'Toaster',
  'toast',
  'Stat',
  'Kbd',
  'SegmentedControl',
  'Icon',
]

describe('@desi-event/ui entry point', () => {
  it('exports every documented name as a callable', () => {
    for (const name of PUBLIC_EXPORTS) {
      expect(typeof ui[name], `${name} should be exported`).toBe('function')
    }
  })

  it('exports nothing beyond the documented surface', () => {
    expect(Object.keys(ui).sort()).toEqual([...PUBLIC_EXPORTS].sort())
  })
})

describe('@desi-event/ui subpaths for Server Components', () => {
  it('serves the pure class helpers at ./classes, with no React in them', async () => {
    const classes = await import('./classes.js')

    expect(Object.keys(classes).sort()).toEqual(['buttonClasses', 'cn', 'textLinkClasses'])
  })

  it('serves the icon family at ./icons', async () => {
    const icons = await import('./icons/index.js')

    expect(Object.keys(icons).sort()).toEqual(['GLYPHS', 'ICON_STROKE', 'Icon', 'glyphNames'])
  })

  it('maps both subpaths in the package manifest', async () => {
    const { readFileSync } = await import('node:fs')
    const path = await import('node:path')
    const { fileURLToPath } = await import('node:url')
    const here = path.dirname(fileURLToPath(import.meta.url))
    const manifest = JSON.parse(readFileSync(path.join(here, '..', 'package.json'), 'utf8'))

    expect(manifest.exports['./classes']).toBe('./src/classes.js')
    expect(manifest.exports['./icons']).toBe('./src/icons/index.js')
  })
})

describe('@desi-event/ui subpaths that keep the heavy layers out of a shared chunk', () => {
  /** What the entry point exports that pulls a library in with it. */
  const HEAVY = ['Popover', 'Menu', 'Tooltip', 'Toaster', 'toast']

  it('serves every light primitive at ./primitives, and none of the floating layers', async () => {
    const primitives = await import('./primitives.js')

    expect(Object.keys(primitives).sort()).toEqual(
      PUBLIC_EXPORTS.filter((name) => !HEAVY.includes(name)).sort(),
    )
  })

  it('reaches neither Base UI nor Sonner from ./primitives, however deep', async () => {
    const { readFileSync } = await import('node:fs')
    const path = await import('node:path')
    const { fileURLToPath } = await import('node:url')
    const here = path.dirname(fileURLToPath(import.meta.url))
    const seen = new Set()
    const external = new Set()

    /**
     * Walk a module's relative imports, collecting the packages it names.
     *
     * @param {string} file An absolute path.
     * @returns {void}
     */
    function walk(file) {
      if (seen.has(file)) return
      seen.add(file)

      const source = readFileSync(file, 'utf8')

      for (const [, specifier] of source.matchAll(/from\s+'([^']+)'/gu)) {
        if (specifier.startsWith('.')) walk(path.resolve(path.dirname(file), specifier))
        else external.add(specifier)
      }
    }

    walk(path.join(here, 'primitives.js'))

    expect([...external].filter((name) => /base-ui|sonner/u.test(name))).toEqual([])
    expect(seen.size).toBeGreaterThan(10)
  })

  it('serves each floating layer at a subpath of its own', async () => {
    const { readFileSync } = await import('node:fs')
    const path = await import('node:path')
    const { fileURLToPath } = await import('node:url')
    const here = path.dirname(fileURLToPath(import.meta.url))
    const manifest = JSON.parse(readFileSync(path.join(here, '..', 'package.json'), 'utf8'))

    expect(manifest.exports['./primitives']).toBe('./src/primitives.js')
    expect(manifest.exports['./popover']).toBe('./src/Popover.jsx')
    expect(manifest.exports['./menu']).toBe('./src/Menu.jsx')
    expect(manifest.exports['./tooltip']).toBe('./src/Tooltip.jsx')
    expect(manifest.exports['./toast']).toBe('./src/Toast.jsx')

    expect(typeof (await import('./Popover.jsx')).Popover).toBe('function')
    expect(typeof (await import('./Menu.jsx')).Menu).toBe('function')
    expect(typeof (await import('./Tooltip.jsx')).Tooltip).toBe('function')
    expect(typeof (await import('./Toast.jsx')).Toaster).toBe('function')
  })
})
