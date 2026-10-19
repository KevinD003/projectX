import { describe, expect, it } from 'vitest'

import { EVENT_CATEGORIES } from './catalog.js'
import {
  POSTER_ELEMENTS,
  croppedViewBox,
  POSTER_MOTIFS,
  POSTER_VIEWBOX,
  describePoster,
  fitHeadline,
  posterArt,
  posterDesign,
  posterTitle,
  toSvgString,
} from './poster-art.js'

/** Slugs from the sample catalogue, so the properties below hold for real posters. */
const SLUGS = [
  'navratri-night-one-edison',
  'mirrorwork-nine-nights-pass',
  'dandiya-dhol-houston',
  'lakeshore-raas-opening-night',
  'bay-lights-garba-opening',
  'peachtree-garba-saturday',
  'beginner-garba-workshop-jersey-city',
  'navratri-mela-queens',
  'mirrorwork-live-band-night',
  'garba-warm-up-night-atlanta',
  'kunal-kamra-live-toronto',
  'durga-puja-somerset',
  'holi-on-the-lawn-dallas',
  'qawwali-under-the-stars',
  'sangeet-workshop-edison',
  'diwali-mela-brampton',
]

/** Every category the site knows, and one it does not. */
const CATEGORIES = [...EVENT_CATEGORIES.map((category) => category.value), undefined]

/**
 * Every node in a drawing, depth first.
 *
 * @param {Array<object>} nodes The drawing's top-level nodes.
 * @returns {Array<object>} All of them, and all of their descendants.
 */
function walk(nodes) {
  return nodes.flatMap((node) => [node, ...walk(node.children)])
}

/**
 * The sRGB relative luminance of a hex colour (WCAG 2).
 *
 * @param {string} hex Such as `#32105e`.
 * @returns {number} Luminance, 0 to 1.
 */
function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((at) => {
    const channel = Number.parseInt(hex.slice(at, at + 2), 16) / 255

    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })

  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/**
 * The contrast ratio of two hex colours.
 *
 * @param {string} a A colour.
 * @param {string} b Another.
 * @returns {number} The ratio, 1 to 21.
 */
function contrast(a, b) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)

  return (light + 0.05) / (dark + 0.05)
}

/** The title's colour per tone, in the kit: white, or the kit's Royal Purple. */
const TONE_HEX = { inverse: '#ffffff', ink: '#32105e' }

describe('posterDesign', () => {
  it('chooses the same design for the same event, every time', () => {
    for (const seed of SLUGS) {
      for (const category of CATEGORIES) {
        expect(posterDesign({ seed, category })).toEqual(posterDesign({ seed, category }))
      }
    }
  })

  it('varies the scheme, the shape, the corner and the title’s place across a page of events', () => {
    const designs = SLUGS.map((seed) => posterDesign({ seed, category: 'GARBA_DANDIYA' }))

    expect(new Set(designs.map((design) => design.scheme.name)).size).toBeGreaterThanOrEqual(4)
    expect(new Set(designs.map((design) => design.motif)).size).toBe(3)
    expect(new Set(designs.map((design) => design.mirrored)).size).toBe(2)
    expect(new Set(designs.map((design) => design.titleAt)).size).toBe(2)
  })

  it('gives every kind of night shapes of its own, from the poster’s set', () => {
    const across = new Set()

    for (const { value } of EVENT_CATEGORIES) {
      const motifs = new Set(SLUGS.map((seed) => posterDesign({ seed, category: value }).motif))

      expect(motifs.size).toBeGreaterThanOrEqual(2)
      for (const motif of motifs) {
        expect(POSTER_MOTIFS).toContain(motif)
        across.add(motif)
      }
    }

    expect([...across].sort()).toEqual([...POSTER_MOTIFS].sort())
  })

  it('anchors the shape to the corner away from the title', () => {
    for (const seed of SLUGS) {
      const { anchor, mirrored, titleAt } = posterDesign({ seed })

      expect(anchor).toBe(
        `${mirrored ? 'xMin' : 'xMax'}${titleAt === 'top' ? 'YMax' : 'YMin'} slice`,
      )
    }
  })
})

describe('posterArt', () => {
  it('draws the same poster for the same event, every time', () => {
    for (const seed of SLUGS) {
      for (const category of CATEGORIES) {
        expect(posterArt({ seed, category })).toEqual(posterArt({ seed, category }))
        expect(toSvgString({ title: seed, seed, category })).toBe(
          toSvgString({ title: seed, seed, category }),
        )
      }
    }
  })

  it('draws a different picture for each shape', () => {
    const pictures = new Map()

    for (const seed of SLUGS) {
      for (const category of CATEGORIES) {
        const art = posterArt({ seed, category })

        pictures.set(art.motif, JSON.stringify(art.children))
      }
    }

    expect(pictures.size).toBe(POSTER_MOTIFS.length)
    expect(new Set(pictures.values()).size).toBe(POSTER_MOTIFS.length)
  })

  it('draws in a square tile, the first element a ground that outruns any frame', () => {
    expect(POSTER_VIEWBOX).toEqual({ width: 100, height: 100 })

    const art = posterArt({ seed: SLUGS[0] })

    expect(art.viewBox).toBe('0 0 100 100')
    expect(art.children[0]).toMatchObject({
      tag: 'rect',
      attrs: { x: -200, y: -200, width: 500, height: 500 },
    })
  })

  it('builds a tree of flat drawing elements only, with plain attribute values', () => {
    const allowed = new Set(POSTER_ELEMENTS)
    const breaches = []

    for (const seed of SLUGS) {
      for (const category of CATEGORIES) {
        const where = `${seed}/${category}`
        const nodes = walk(posterArt({ seed, category }).children)

        if (nodes.length < 4) breaches.push(`${where}: only ${nodes.length} elements`)

        for (const node of nodes) {
          if (!allowed.has(node.tag)) breaches.push(`${where}: <${node.tag}> is not drawable`)
          if (!Array.isArray(node.children)) breaches.push(`${where}: <${node.tag}> children`)

          for (const [name, value] of Object.entries(node.attrs)) {
            const at = `${where}: <${node.tag} ${name}=${value}>`

            if (!/^[a-z][a-z0-9-]*$/.test(name)) breaches.push(`${at} is not an SVG name`)
            if (name.startsWith('on')) breaches.push(`${at} is an event handler`)
            if (!['string', 'number'].includes(typeof value)) breaches.push(`${at} is not plain`)
            if (typeof value === 'number' && !Number.isFinite(value)) {
              breaches.push(`${at} is not finite`)
            }
            if (/[<>"]|javascript:|url\(/i.test(String(value))) breaches.push(`${at} could escape`)
          }
        }
      }
    }

    expect(breaches).toEqual([])
  })

  it('prints no text, no picture and no gradient: flat plates only', () => {
    for (const seed of SLUGS) {
      const tags = new Set(walk(posterArt({ seed }).children).map((node) => node.tag))

      for (const forbidden of ['text', 'image', 'use', 'linearGradient', 'radialGradient']) {
        expect(tags.has(forbidden)).toBe(false)
      }
    }
  })

  it('marks the shape’s two impressions, so the hero can bring them into register', () => {
    for (const seed of SLUGS) {
      const plates = walk(posterArt({ seed }).children)
        .map((node) => node.attrs['data-plate'])
        .filter(Boolean)

      expect(plates).toEqual(['ghost', 'key'])
    }
  })

  it('sets the title in a tone that reads on every plate it can land on', () => {
    // The title can sit on the ground, the shape's plate or its second
    // plate, so each of those has to carry the title at 4.5:1 or better.
    // The foil is kept to keylines and is not measured.
    for (const seed of SLUGS) {
      for (const category of CATEGORIES) {
        const { scheme, tone } = posterDesign({ seed, category })

        for (const ground of [scheme.ground, scheme.plate, scheme.second]) {
          expect(contrast(TONE_HEX[tone], ground)).toBeGreaterThanOrEqual(4.5)
        }
      }
    }
  })
})

describe('describePoster', () => {
  it('names the kind of night the poster advertises', () => {
    expect(describePoster('COMEDY')).toBe('Comedy poster')
    expect(describePoster('GARBA_DANDIYA')).toBe('Garba & Dandiya poster')
    expect(describePoster(undefined)).toBe('Event poster')
  })

  it('tells two kinds of night apart', () => {
    expect(describePoster('WORKSHOP')).not.toBe(describePoster('GARBA_DANDIYA'))
  })
})

describe('posterTitle', () => {
  it.each([
    ['Bay Lights Garba: Opening Night', 'Bay Lights Garba', 'Opening Night'],
    [
      'Navratri Garba 2026 in NJ - Art of Living Free Schools',
      'Navratri Garba 2026 in NJ',
      'Art of Living Free Schools',
    ],
    [
      'Navratri Garba Nights Featuring Swar Sangam Musical Group',
      'Navratri Garba Nights',
      'Featuring Swar Sangam Musical Group',
    ],
    ['Holi on the Lawn', 'Holi on the Lawn', null],
    [
      'Live Garba Band Night with the Mirrorwork Ensemble',
      'Live Garba Band Night',
      'with the Mirrorwork Ensemble',
    ],
  ])('sets “%s” as a headline and a line under it', (title, headline, subline) => {
    expect(posterTitle(title)).toEqual({ headline, subline })
  })

  it('keeps a short title whole, joint or no joint', () => {
    expect(posterTitle('A: B')).toEqual({ headline: 'A: B', subline: null })
    expect(posterTitle('  Raas   Night  ')).toEqual({ headline: 'Raas Night', subline: null })
  })
})

describe('fitHeadline', () => {
  it('sets a short headline larger than a long one, and never above the 6rem display ceiling', () => {
    const size = (headline) => Number(/^min\(([0-9.]+)cqi/.exec(fitHeadline(headline).fontSize)[1])

    expect(size('Holi')).toBeGreaterThan(size('Largest Garba and Dandiya Event in Ohio'))
    expect(fitHeadline('Holi').fontSize).toMatch(/, 6rem\)$/u)
  })

  it('never sets the longest word wider than the measure', () => {
    for (const headline of ['Supercalifragilistic', 'Navratri Garba Nights', 'MHJ Live Season 3']) {
      const { fontSize } = fitHeadline(headline)
      const size = Number(/^min\(([0-9.]+)cqi/.exec(fontSize)[1])
      const longest = Math.max(...headline.split(' ').map((word) => word.length))

      expect(size * 0.46 * longest).toBeLessThanOrEqual(84)
    }
  })

  it('caps the height by the lines it was fitted for, in the frame’s own units', () => {
    const { fontSize, lines } = fitHeadline('Charlotte’s Biggest Garba and Dandiya Festival')
    const cap = Number(/, ([0-9.]+)cqb/.exec(fontSize)[1])

    expect(lines).toBeGreaterThan(1)
    expect(cap * lines * 0.9).toBeLessThanOrEqual(54.01)
  })
})

describe('croppedViewBox', () => {
  it('cuts a tall frame toward the shape’s corner, as a browser’s slice would', () => {
    expect(croppedViewBox('xMaxYMin slice', 1.25)).toBe('20 0 80 100')
    expect(croppedViewBox('xMinYMax slice', 1.25)).toBe('0 0 80 100')
  })

  it('shows a wide frame the whole tile against its corner, the ground running on', () => {
    expect(croppedViewBox('xMaxYMax slice', 0.525)).toBe('-90.48 0 190.48 100')
    expect(croppedViewBox('xMinYMin slice', 0.525)).toBe('0 0 190.48 100')
  })
})

describe('toSvgString', () => {
  it('writes a standalone, titled SVG document anchored to its shape’s corner', () => {
    const svg = toSvgString({
      title: 'Navratri Night One',
      seed: SLUGS[0],
      category: 'GARBA_DANDIYA',
    })
    const { anchor } = posterDesign({ seed: SLUGS[0], category: 'GARBA_DANDIYA' })

    expect(
      svg.startsWith(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="${anchor}"`,
      ),
    ).toBe(true)
    expect(svg).toContain('role="img"')
    expect(svg).toContain('<title>Navratri Night One</title>')
    expect(svg.endsWith('</svg>')).toBe(true)
  })

  it('escapes the title, so an event name cannot become markup', () => {
    const svg = toSvgString({ title: 'Raas & "Garba" <script>', seed: SLUGS[0] })

    expect(svg).toContain('<title>Raas &amp; &quot;Garba&quot; &lt;script></title>')
    expect(svg).not.toContain('<script>')
  })
})
