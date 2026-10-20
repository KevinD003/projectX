/**
 * The API reference at /docs wears the brand, and every file it needs comes
 * from this host.
 *
 * Swagger UI is themed through @fastify/swagger-ui's own options: a stylesheet,
 * a small script, a favicon and a logo, read from `src/docs-theme/` once at
 * boot and served beside the stock bundle. These cases hold the theme to
 * being served as what it is, linked from the page, and to the page asking
 * no third party for anything, which the page's `default-src 'self'` would
 * refuse anyway and which a reader's browser should never be asked to do.
 */

import { describe, expect, it } from 'vitest'

import {
  DOCS_FONT_FILES,
  DOCS_THEME_PATH,
  DOCS_TITLE,
  DOCS_UI_CONFIG,
  loadDocsTheme,
} from '../src/plugins/docs.js'
import { createTestApp } from './helpers/app.js'

/**
 * Every URL a document names in an `href` or `src` attribute.
 *
 * @param {string} html The page.
 * @returns {string[]} The URLs, as written.
 */
function linkedUrls(html) {
  return [...html.matchAll(/\b(?:href|src)="([^"]*)"/gu)].map((match) => match[1])
}

describe('the docs theme', () => {
  it('serves its stylesheet from this host as CSS', async () => {
    const { app } = await createTestApp({ docs: true })

    const response = await app.inject({ method: 'GET', url: `${DOCS_THEME_PATH}/theme.css` })

    expect(response.statusCode).toBe(200)
    expect(response.headers['content-type']).toMatch(/^text\/css\b/u)
    expect(response.body).toBe(loadDocsTheme().theme.css[0].content)
    expect(response.body).toContain('.swagger-ui .opblock.opblock-get .opblock-summary-method')
    expect(response.body).toContain('@media (prefers-reduced-motion: reduce)')
    expect(response.body).toContain('html.dark-mode {')

    await app.close()
  })

  it('links the stylesheet, the script and the favicon from /docs, with no third-party host', async () => {
    const { app } = await createTestApp({ docs: true })

    const response = await app.inject({ method: 'GET', url: '/docs/' })
    const urls = linkedUrls(response.body)

    expect(response.statusCode).toBe(200)
    expect(response.headers['content-type']).toContain('text/html')
    expect(response.body).toContain(`<title>${DOCS_TITLE}</title>`)
    expect(urls).toContain('./static/theme/theme.css')
    expect(urls).toContain('./static/theme/theme.js')
    expect(urls).toContain('./static/theme/favicon.png')
    expect(urls).not.toContain('./static/favicon-32x32.png')
    for (const url of urls) {
      expect(url, `${url} is not served by this host`).toMatch(/^\.\//u)
    }
    expect(response.body).not.toMatch(/https?:\/\//u)

    await app.close()
  })

  it('names no third-party host in anything the page loads from the theme', async () => {
    const { app } = await createTestApp({ docs: true })

    for (const file of ['theme.css', 'theme.js']) {
      const response = await app.inject({ method: 'GET', url: `${DOCS_THEME_PATH}/${file}` })
      expect(response.statusCode).toBe(200)
      expect(response.body, file).not.toMatch(/https?:\/\//u)
      expect(response.body, file).not.toMatch(/fonts\.googleapis|gstatic|typekit|bunny\.net/u)
    }

    const script = await app.inject({ method: 'GET', url: `${DOCS_THEME_PATH}/theme.js` })
    expect(script.headers['content-type']).toMatch(/^application\/javascript\b/u)
    expect(script.body).not.toMatch(/localStorage|sessionStorage|document\.cookie|fetch\(/u)

    await app.close()
  })

  it('serves the faces the stylesheet sets, from beside it', async () => {
    const { app } = await createTestApp({ docs: true })
    const css = loadDocsTheme().theme.css[0].content
    const named = [...css.matchAll(/url\('\.\/fonts\/([^']+)'\)/gu)].map((match) => match[1])

    expect([...named].sort()).toEqual([...DOCS_FONT_FILES].sort())
    for (const name of DOCS_FONT_FILES) {
      const response = await app.inject({ method: 'GET', url: `${DOCS_THEME_PATH}/fonts/${name}` })
      expect(response.statusCode, name).toBe(200)
      expect(response.headers['content-type']).toBe('font/woff2')
      // A WOFF2 file starts with its signature, "wOF2".
      expect(response.rawPayload.subarray(0, 4).toString('latin1'), name).toBe('wOF2')
    }

    await app.close()
  })

  it('draws the brand D in the bar and the tab, not the stock logo', async () => {
    const { app } = await createTestApp({ docs: true })
    const { theme, logo } = loadDocsTheme()

    const favicon = await app.inject({ method: 'GET', url: `${DOCS_THEME_PATH}/favicon.png` })
    expect(favicon.statusCode).toBe(200)
    expect(favicon.headers['content-type']).toBe('image/png')
    expect(favicon.rawPayload.equals(theme.favicon[0].content)).toBe(true)

    // The logo travels inside the initializer as a data URL (`img-src data:`).
    const initializer = await app.inject({
      method: 'GET',
      url: '/docs/static/swagger-initializer.js',
    })
    expect(logo.type).toBe('image/webp')
    expect(initializer.body).toContain(
      `data:image/webp;base64,${Buffer.from(logo.content).toString('base64')}`,
    )

    await app.close()
  })

  it('opens folded, filters by tag, and never keeps a pasted token', async () => {
    const { app } = await createTestApp({ docs: true })

    const initializer = await app.inject({
      method: 'GET',
      url: '/docs/static/swagger-initializer.js',
    })

    expect(DOCS_UI_CONFIG).toMatchObject({
      docExpansion: 'none',
      deepLinking: true,
      filter: true,
      persistAuthorization: false,
    })
    expect(initializer.body).toContain('"docExpansion":"none"')
    expect(initializer.body).toContain('"persistAuthorization":false')
    expect(initializer.body).toMatch(/validatorUrl: null/u)

    await app.close()
  })

  it('keeps the page under the plugin’s self-only content security policy', async () => {
    const { app } = await createTestApp({ docs: true })

    const response = await app.inject({ method: 'GET', url: `${DOCS_THEME_PATH}/theme.css` })
    const policy = response.headers['content-security-policy']

    expect(policy).toContain("default-src 'self'")
    expect(policy).toMatch(/style-src 'self'/u)
    expect(policy).toMatch(/font-src 'self'/u)

    await app.close()
  })

  it('shows a reader real health values, not a placeholder string and the first log level', async () => {
    const { app } = await createTestApp({ docs: true })

    const document = JSON.parse((await app.inject({ method: 'GET', url: '/openapi.json' })).body)
    const schema = document.paths['/health'].get.responses['200'].content['application/json'].schema
    const { properties } = schema

    expect(properties.version.examples).toEqual(['0.1.0'])
    expect(properties.logLevel.examples).toEqual(['info'])
    expect(properties.uptimeSeconds.examples).toEqual([3600])
    // The payments block says what a demonstration instance sends, not "string".
    expect(properties.payments.properties.label.examples).toEqual(['DEMO'])
    expect(properties.payments.properties.message.examples).toEqual([
      'Production payments disabled: Phase 2 integration required.',
    ])

    await app.close()
  })
})

/**
 * A page as small as `theme.js` needs: elements found by selector, their
 * attributes, the root's classes and the observers it registers.
 *
 * @param {Record<string, object[]>} found Elements to hand back, by selector.
 * @returns {{window: object, document: object, observers: Function[], classes: Set<string>}} The stub.
 */
function stubPage(found) {
  const classes = new Set()
  const observers = []
  const root = {
    classList: {
      contains: (name) => classes.has(name),
      toggle: (name, on) => (on ? classes.add(name) : classes.delete(name)),
    },
  }
  const document = {
    head: { appendChild: () => {} },
    documentElement: root,
    createElement: () => ({}),
    querySelector: () => ({}),
    querySelectorAll: (selector) => found[selector] ?? [],
  }
  const window = {
    MutationObserver: class {
      constructor(callback) {
        observers.push(callback)
      }
      observe() {}
    },
  }
  return { window, document, observers, classes }
}

/**
 * An element that keeps its attributes.
 *
 * @returns {{getAttribute: Function, setAttribute: Function, attributes: Map<string, string>}} The stub.
 */
function stubElement() {
  const attributes = new Map()
  return {
    attributes,
    getAttribute: (name) => attributes.get(name) ?? null,
    setAttribute: (name, value) => attributes.set(name, String(value)),
  }
}

describe('the docs script', () => {
  it('names the logo, the dark-mode switch and the server picker Swagger UI leaves unnamed', () => {
    const logo = stubElement()
    const toggle = stubElement()
    const servers = stubElement()
    const page = stubPage({
      '.swagger-ui .topbar img': [logo],
      '.swagger-ui .dark-mode-toggle button': [toggle],
      '.swagger-ui select#servers': [servers],
    })
    const { js } = loadDocsTheme().theme

    new Function('window', 'document', js[0].content)(page.window, page.document)

    expect(logo.attributes.get('alt')).toBe('The Desi Events API')
    expect(toggle.attributes.get('aria-label')).toBe('Dark mode')
    expect(toggle.attributes.get('aria-pressed')).toBe('false')
    expect(servers.attributes.get('aria-label')).toBe('Server')

    // Swagger UI re-renders; each observed change names the controls again
    // and keeps the switch's state in step with the page's dark mode.
    expect(page.observers).toHaveLength(2)
    page.classes.add('dark-mode')
    logo.attributes.delete('alt')
    page.observers[1]()
    expect(toggle.attributes.get('aria-pressed')).toBe('true')
    expect(logo.attributes.get('alt')).toBe('The Desi Events API')
  })
})
