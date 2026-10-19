import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

import { posterDesign } from '../lib/poster-art.js'
import { EventPoster, posterDate, posterPlace, reactAttributeName } from './poster.jsx'

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
