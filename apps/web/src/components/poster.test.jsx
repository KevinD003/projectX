import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

import { HEADLINE_SHARE, drawingTop, posterArt, posterDesign } from '../lib/poster-art.js'
import {
  EventPoster,
  posterDate,
  posterLayout,
  posterPlace,
  reactAttributeName,
} from './poster.jsx'

const EVENT = Object.freeze({
  slug: 'navratri-night-one-edison',
  title: 'Navratri Night One: Garba Under the Lights',
  category: 'GARBA_DANDIYA',
  startsAt: '2026-11-07T00:30:00.000Z',
  timezone: 'America/New_York',
  city: 'Edison',
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('EventPoster', () => {
  it('is one image, named for the kind of night and whose poster it is', () => {
    render(<EventPoster event={EVENT} />)

    expect(
      screen.getByRole('img', {
        name: 'Garba & Dandiya poster for Navratri Night One: Garba Under the Lights',
      }),
    ).toBeInTheDocument()
  })

  it.each([
    ['COMEDY', 'Comedy poster for A class'],
    ['WORKSHOP', 'Workshops poster for A class'],
  ])('names a %s poster by its kind', (category, name) => {
    render(<EventPoster event={{ slug: 'a-class', title: 'A class', category }} />)

    expect(screen.getByRole('img', { name })).toBeInTheDocument()
  })

  it('still has a name when the event has no title', () => {
    render(<EventPoster event={{ slug: 'untitled', category: 'GARBA_DANDIYA' }} />)

    expect(screen.getByRole('img').getAttribute('aria-label')).toMatch(/ for this event$/)
  })

  it('letters the title huge, the rest under it, and the date and city on the snipe', () => {
    render(<EventPoster event={EVENT} variant="poster" />)

    const poster = screen.getByRole('img')
    const part = (name) => poster.querySelector(`[data-lettering-part="${name}"]`)

    expect(part('headline')).toHaveAttribute('data-lettering', 'Navratri Night One')
    expect(part('subline')).toHaveAttribute('data-lettering', 'Garba Under the Lights')
    // 7:30 PM on 6 November in New York, not 7 November in UTC.
    expect(part('snipe')).toHaveAttribute('data-lettering', 'Fri 6 Nov · Edison')
    expect(part('headline').parentElement.style.fontSize).toMatch(
      /^min\([0-9.]+cqi, [0-9.]+cqb, 6rem\)$/u,
    )
  })

  it('paints its lettering rather than writing it, so the page says the title once', () => {
    render(<EventPoster event={EVENT} variant="hero" registration />)

    const poster = screen.getByRole('img')
    const lettering = [...poster.querySelectorAll('[data-lettering]')]

    expect(poster.textContent).toBe('')
    expect(lettering.length).toBeGreaterThan(0)
    expect(
      lettering.every((element) =>
        element.className.includes('before:content-[attr(data-lettering)]'),
      ),
    ).toBe(true)
    expect(lettering.every((element) => element.closest('[aria-hidden="true"]'))).toBe(true)
  })

  it('anchors its drawing to the corner its design chose, cropping rather than letterboxing', () => {
    render(<EventPoster event={EVENT} />)

    const svg = screen.getByRole('img').querySelector('svg')
    const { anchor } = posterDesign({ seed: EVENT.slug, category: EVENT.category })

    expect(svg).toHaveAttribute('viewBox', '0 0 100 100')
    expect(svg).toHaveAttribute('preserveAspectRatio', anchor)
    expect(svg).toHaveAttribute('aria-hidden', 'true')
  })

  it('sizes a card at 3:2, a wall poster at 4:5, and a hero at 5:4 opening to 4:5', () => {
    const { rerender } = render(<EventPoster event={EVENT} className="rounded-card" />)

    expect(screen.getByRole('img')).toHaveClass('block', 'w-full', 'aspect-[3/2]', 'rounded-card')

    rerender(<EventPoster event={EVENT} variant="poster" />)
    expect(screen.getByRole('img')).toHaveClass('aspect-[4/5]')

    rerender(<EventPoster event={EVENT} variant="hero" />)
    expect(screen.getByRole('img')).toHaveClass('aspect-[5/4]', 'lg:aspect-[4/5]')
  })

  it('is its own size container, so its lettering scales with it and drops away on a thumbnail', () => {
    render(<EventPoster event={EVENT} />)

    const poster = screen.getByRole('img')

    expect(poster).toHaveClass('[container-type:size]')
    expect(poster.querySelector('div[aria-hidden="true"]')).toHaveClass('poster-lettering')
  })

  it('prints its impressions into register only when asked, and once', () => {
    const { rerender } = render(<EventPoster event={EVENT} />)

    expect(screen.getByRole('img')).not.toHaveAttribute('data-registration')
    expect(screen.getByRole('img').querySelectorAll('.poster-impression')).toHaveLength(0)

    rerender(<EventPoster event={EVENT} variant="hero" registration />)

    const poster = screen.getByRole('img')
    const impressions = [...poster.querySelectorAll('.poster-impression')]

    expect(poster).toHaveAttribute('data-registration', '')
    expect(impressions.map((element) => element.dataset.impression)).toEqual(['magenta', 'gold'])
    expect(impressions.every((element) => element.dataset.lettering === 'Navratri Night One')).toBe(
      true,
    )
    expect(poster.querySelector('[data-plate="ghost"]')).not.toBeNull()
  })

  it('renders the drawing as SVG elements, with no warning from React', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(<EventPoster event={EVENT} variant="hero" registration />)

    const svg = screen.getByRole('img').querySelector('svg')

    expect(svg.querySelector('rect')).toHaveAttribute('fill')
    expect(svg.querySelector('[data-plate="key"]')).not.toBeNull()
    expect(error).not.toHaveBeenCalled()
  })

  it('draws nothing but shapes: no text, script, link or foreign content in the drawing', () => {
    render(<EventPoster event={EVENT} variant="hero" />)

    expect(
      screen
        .getByRole('img')
        .querySelector('svg')
        .querySelector('text, script, a, foreignObject, image, use'),
    ).toBeNull()
  })

  it('keeps markup in a title as words', () => {
    render(<EventPoster event={{ ...EVENT, title: '<img src=x onerror=alert(1)> Raas' }} />)

    const poster = screen.getByRole('img')

    expect(poster.querySelector('img')).toBeNull()
    expect(poster.querySelector('[data-lettering-part="headline"]')).toHaveAttribute(
      'data-lettering',
      '<img src=x onerror=alert(1)> Raas',
    )
  })
})

/**
 * The longest titles in the seeded catalogue and the bundled imports, and the
 * ones the finish review found a shape running through, with the slugs and
 * categories that gave them their designs.
 */
const LONG_TITLES = Object.freeze([
  ['nach-stockton-nach-2', 'Nach Stockton Nach 2', 'GARBA_DANDIYA'],
  ['navratri-garba-nights', 'Navratri Garba Nights featuring Swar Sangam', 'GARBA_DANDIYA'],
  ['largest-garba-ohio', 'Largest Garba & Dandiya Event in Ohio - Vatsala Patil', 'GARBA_DANDIYA'],
  [
    'mithas-mitr-ensemble',
    'MITHAS Global Indian Artist and Kanakavalli present: Mitr, an Ensemble Collaboration between Kalanidhi Dance and Bijayini Satpathy Dance Collective',
    'MUSIC_CONCERT',
  ],
  [
    'challenger-direct-entry',
    'CHALLENGER - Direct Entry to Episode Production | International Indian Icon Season 10 (2026) - Chicago, Nov 27-29',
    'COMEDY',
  ],
  [
    'ghazal-sufi-bollywood',
    'Ghazal, Sufi, and Bollywood Music With Ustad Ghulam Ali, Aamir Ghulam Ali, and Jaspinder Narula Live In Bay Area',
    'MUSIC_CONCERT',
  ],
  [
    'nyc-comedy-roast-battle',
    'NYC South Asian Comedy Festival Roast Battle - India Vs Pakistan Vs Bangladesh Vs Sri Lanka',
    'COMEDY',
  ],
  [
    'dmv-high-school-garba',
    'DMV HIGH SCHOOL GARBA: Oakton | Westfield | Briar Woods | Freedom | John Champe | Fairfax',
    'GARBA_DANDIYA',
  ],
  [
    'mithas-arjun-verma',
    'MITHAS and LearnQuest present Arjun Verma (Hindustani Sitar) with Indranil Mallick',
    'MUSIC_CONCERT',
  ],
  ['mudita-raag-unfolds-salon-series', 'Mudita Raag Unfolds: Salon Series', 'MUSIC_CONCERT'],
])

/**
 * Where the drawn shape starts, worked out from the drawing itself: the top
 * of every element under the shape's group, carried through the keep-clear
 * scale when there is one.
 *
 * @param {object} art A `posterArt` drawing.
 * @returns {number} The shape's top, in its bottom-right drawing space.
 */
function drawnShapeTop(art) {
  const group = art.children[1]
  const [first] = group.children
  const keepClear = first?.attrs?.['data-keep-clear'] === ''

  if (!keepClear) return drawingTop(group.children)

  const [scale, , , , , ty] = /matrix\(([^)]*)\)/u
    .exec(first.attrs.transform)[1]
    .split(' ')
    .map(Number)

  return drawingTop(first.children) * scale + ty
}

describe('the title and the shape, each in its own band', () => {
  it.each(LONG_TITLES.flatMap((entry) => ['card', 'poster', 'hero'].map((v) => [v, ...entry])))(
    'a %s poster of “%s” keeps its shape below the lettering in every frame it takes',
    (variant, slug, title, category) => {
      const event = { slug, title, category }
      const layout = posterLayout(event, variant)
      const art = posterArt({ seed: slug, category, clearTop: layout.clearTop })
      const top = drawnShapeTop(art)

      for (const { aspect, depth } of layout.frames) {
        const shown = Math.min(1, aspect)
        // The shape's top as a share of the frame's height, from the title's edge.
        const shapeStarts = (top - 100 * (1 - shown)) / (100 * shown)

        expect(shapeStarts).toBeGreaterThanOrEqual(depth - 1e-9)
      }
      expect(top).toBeCloseTo(art.shapeTop, 6)
    },
  )

  it('sets a long headline small enough to stay inside its share of the height', () => {
    for (const [slug, title, category] of LONG_TITLES) {
      for (const variant of ['card', 'poster', 'hero']) {
        const { fit, frames } = posterLayout({ slug, title, category }, variant)

        for (const { aspect } of frames) {
          const cap = Number(/, ([0-9.]+)cqb/u.exec(fit.fontSize)[1])
          const height = Math.min((fit.lines * fit.size * 0.9) / aspect, cap * fit.lines * 0.9)

          expect(height).toBeLessThanOrEqual(HEADLINE_SHARE + 0.01)
        }
      }
    }
  })

  it('leaves a short title’s shape larger than a long title’s on the same design', () => {
    const slug = 'nach-stockton-nach-2'
    const category = 'GARBA_DANDIYA'
    const short = posterLayout({ slug, title: 'Holi', category }, 'poster')
    const long = posterLayout({ slug, title: LONG_TITLES[3][1], category }, 'poster')

    expect(short.clearTop).toBeLessThan(long.clearTop)
    expect(posterArt({ seed: slug, category, clearTop: short.clearTop }).shapeTop).toBeLessThan(
      posterArt({ seed: slug, category, clearTop: long.clearTop }).shapeTop,
    )
  })

  it('draws the keep-clear scale into the rendered poster', () => {
    const [slug, title, category] = LONG_TITLES[3]
    render(<EventPoster event={{ slug, title, category }} variant="poster" />)

    const group = screen.getByRole('img').querySelector('svg [data-keep-clear]')

    expect(group).not.toBeNull()
    expect(group.getAttribute('transform')).toMatch(
      /^matrix\(0\.\d+ 0 0 0\.\d+ [0-9.]+ [0-9.]+\)$/u,
    )
  })
})

describe('posterDate and posterPlace', () => {
  it('print the date in the event’s own zone and the city, or Online', () => {
    expect(posterDate(EVENT)).toBe('Fri 6 Nov')
    expect(posterDate({ startsAt: null })).toBeNull()
    expect(posterPlace(EVENT)).toBe('Edison')
    expect(posterPlace({ ...EVENT, isOnline: true })).toBe('Online')
    expect(posterPlace({ venue: { city: 'Brampton' } })).toBe('Brampton')
    expect(posterPlace({})).toBeNull()
  })
})

describe('reactAttributeName', () => {
  it.each([
    ['fill-opacity', 'fillOpacity'],
    ['stroke-width', 'strokeWidth'],
    ['data-plate', 'data-plate'],
    ['viewBox', 'viewBox'],
    ['cx', 'cx'],
  ])('spells %s as %s', (svg, react) => {
    expect(reactAttributeName(svg)).toBe(react)
  })
})

describe('EventPoster with a drawing it does not recognise', () => {
  it('renders only the elements the poster vocabulary allows', async () => {
    vi.resetModules()
    vi.doMock('../lib/poster-art.js', async () => {
      const actual = await vi.importActual('../lib/poster-art.js')

      return {
        ...actual,
        posterArt: () => ({
          viewBox: '0 0 100 100',
          palette: 'test',
          motif: 'sun',
          tone: 'inverse',
          titleAt: 'top',
          anchor: 'xMaxYMax slice',
          children: [
            { tag: 'rect', attrs: { width: 100, height: 100, fill: 'none' }, children: [] },
            { tag: 'foreignObject', attrs: {}, children: [] },
            { tag: 'script', attrs: {}, children: [] },
          ],
        }),
      }
    })

    const { EventPoster: Mocked } = await import('./poster.jsx')

    render(<Mocked event={EVENT} />)

    const svg = screen.getByRole('img').querySelector('svg')

    expect(svg.querySelector('rect')).not.toBeNull()
    expect(svg.querySelector('foreignObject, script')).toBeNull()

    vi.doUnmock('../lib/poster-art.js')
  })
})
