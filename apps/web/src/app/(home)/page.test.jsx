/**
 * The home page says only what the catalogue says.
 *
 * Each section is read from the listing and the facets the page loaded: the
 * agenda, the cities and their counts, the categories, the next event
 * behind the hero's poster. These tests feed it the sample catalogue — the
 * same data the page falls back to — and a few hand-made edges, and hold it
 * to the rules the rest of the public site keeps: one `h1`, a search that
 * works without JavaScript, honest copy about payments and fees, and no
 * figure it cannot back.
 *
 * @module app/home/page.test
 */

import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'

vi.mock('../../lib/api.js', () => ({
  loadCatalogueOverview: vi.fn(),
  loadCatalogueFacets: vi.fn(),
}))
// The visit counting reads the session, which only a request has; it is
// tested on its own (`components/traffic-scope.test.jsx`). Here it is a marker,
// so the page can be checked for rendering it, once.
vi.mock('../../components/traffic-scope.jsx', () => ({
  TrafficScope: ({ view = null }) => (
    <span data-testid="traffic-scope" data-view={JSON.stringify(view)} />
  ),
}))

const HERE = path.dirname(fileURLToPath(import.meta.url))

const { loadCatalogueFacets, loadCatalogueOverview } = await import('../../lib/api.js')
const { sampleEventSummaries } = await import('../../lib/sample-data.js')
const { default: HomePage, metadata } = await import('./page.jsx')
const { homeAgenda, notYetOver } = await import('../../lib/home-sections.js')

/**
 * Facet counts for a set of summaries, as the API computes them.
 *
 * @param {object[]} events Summaries.
 * @returns {object} The facets.
 */
function facetsOf(events) {
  const count = (values) => {
    const tally = new Map()
    for (const value of values) tally.set(value, (tally.get(value) ?? 0) + 1)

    return [...tally].map(([value, n]) => ({ value, count: n }))
  }

  return {
    scope: { status: 'LISTED', total: events.length },
    categories: count(events.map((event) => event.category)),
    cities: count(events.map((event) => event.city).filter(Boolean)),
    languages: [],
    formats: [],
  }
}

/**
 * Render the page with a listing and facets.
 *
 * @param {object} [options] What the loaders answer.
 * @param {object[]} [options.events] The listing.
 * @param {object} [options.facets] The facets.
 * @param {boolean} [options.usedFallback] Whether the sample catalogue answered.
 * @returns {Promise<HTMLElement>} The render container.
 */
async function draw({ events = sampleEventSummaries(), facets, usedFallback = false } = {}) {
  loadCatalogueOverview.mockResolvedValue({
    events,
    pagination: { page: 1, total: events.length },
    usedFallback,
  })
  loadCatalogueFacets.mockResolvedValue({ facets: facets ?? facetsOf(events), usedFallback })

  const { container } = render(await HomePage())

  return container
}

beforeEach(() => {
  loadCatalogueOverview.mockReset()
  loadCatalogueFacets.mockReset()
})

afterEach(cleanup)

describe('the home page', () => {
  it('has one h1, and it reads as one sentence', async () => {
    await draw()

    const [heading] = screen.getAllByRole('heading', { level: 1 })

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(heading.textContent.replace(/\s+/g, ' ').trim()).toBe('Plans for the weekend, sorted.')
  })

  it('searches with a plain GET to the listing, offering every listed city', async () => {
    const events = sampleEventSummaries()

    await draw({ events })

    const search = screen.getByRole('search', { name: 'Find events' })
    const city = within(search).getByLabelText('City')
    const cities = new Set(events.map((event) => event.city))

    expect(search).toHaveAttribute('action', '/events')
    expect(search).toHaveAttribute('method', 'get')
    expect(city).toHaveAttribute('name', 'city')
    expect(within(search).getByLabelText('What')).toHaveAttribute('name', 'q')
    expect(within(city).getByRole('option', { name: 'All cities' })).toHaveValue('')
    expect(within(city).getAllByRole('option')).toHaveLength(cities.size + 1)
    expect(within(search).getByRole('button', { name: 'Find events' })).toHaveAttribute(
      'type',
      'submit',
    )
  })

  it('offers search for what the API searches: events, venues and organisers', async () => {
    // `GET /v1/events` matches every word against an event's own text, its
    // venue, the venue's city and its organiser (apps/api tests/events.test.js
    // and event-search-integration.test.js), so the page may invite all three.
    const container = await draw()
    const search = screen.getByRole('search', { name: 'Find events' })

    expect(within(search).getByLabelText('What')).toHaveAttribute(
      'placeholder',
      'Event, venue or organiser',
    )
    expect(container).toHaveTextContent(/search for an event, a venue or an organiser/i)
  })

  it('lists this weekend, or else the soonest events, earliest first, as a dated agenda', async () => {
    const events = sampleEventSummaries()

    await draw({ events })

    const list = screen.getByRole('list', { name: 'Upcoming events' })
    const titles = within(list)
      .getAllByRole('heading', { level: 3 })
      .map((heading) => heading.textContent)
    const agenda = homeAgenda(events, { limit: 8 })

    expect(titles.length).toBeGreaterThan(0)
    expect(titles.length).toBeLessThanOrEqual(8)
    expect(titles).toEqual(agenda.events.map((event) => event.title))
    expect(
      screen.getByRole('heading', {
        level: 2,
        name: agenda.kind === 'weekend' ? 'This weekend' : 'Coming up',
      }),
    ).toBeInTheDocument()
    // Each row says its start in words, zone and all, inside a machine date.
    for (const time of within(list).getAllByRole('time', { hidden: true })) {
      expect(time).toHaveAttribute('datetime')
    }
    expect(within(list).getAllByRole('listitem')).toHaveLength(titles.length)
  })

  it('is not a wall of cards: the agenda is a list of rows, with no poster announced', async () => {
    await draw()

    const list = screen.getByRole('list', { name: 'Upcoming events' })

    // The small posters beside each row are decoration: the row says it all.
    expect(within(list).queryAllByRole('img')).toHaveLength(0)
    expect(screen.getByRole('link', { name: 'See all events' })).toHaveAttribute('href', '/events')
  })

  it('leaves out a night that has already ended, whatever its status', async () => {
    const [first, ...rest] = sampleEventSummaries()
    const ended = {
      ...first,
      title: 'A Night That Has Ended',
      startsAt: '2020-10-10T23:00:00.000Z',
      endsAt: '2020-10-11T03:00:00.000Z',
    }

    const container = await draw({ events: [ended, ...rest] })

    expect(container.textContent).not.toContain('A Night That Has Ended')
  })

  it('puts the next event’s own poster in the hero, with a link to it', async () => {
    const events = sampleEventSummaries()
    const [next] = notYetOver(events)

    await draw({ events })

    const hero = screen.getByRole('region', { name: 'Plans for the weekend, sorted.' })
    const link = within(hero).getByRole('link', { name: /^Next up:/ })

    expect(link).toHaveAttribute('href', `/events/${next.slug}`)
    expect(link).toHaveAccessibleName(`Next up: ${next.title}`)
    expect(within(hero).getByRole('img')).toHaveAccessibleName(
      new RegExp(`for ${next.title.replace(/[:.()]/g, '.')}$`),
    )
    // The one plate moment on the page: the poster prints into register.
    expect(hero.querySelector('[data-slot="poster"]')).toHaveAttribute('data-registration')
  })

  it('features the next event of any kind, not only a garba night', async () => {
    const events = sampleEventSummaries().filter((event) => event.category === 'WORKSHOP')

    await draw({ events })

    const hero = screen.getByRole('region', { name: 'Plans for the weekend, sorted.' })

    expect(within(hero).getByRole('link', { name: /^Next up:/ })).toHaveAttribute(
      'href',
      `/events/${events[0].slug}`,
    )
  })

  it('groups the cities by time zone, with the facets’ counts said in words', async () => {
    await draw()

    const eastern = screen.getByRole('list', { name: 'Cities in Eastern Time' })
    const edison = within(eastern).getByRole('link', { name: /^Edison/ })

    expect(edison).toHaveAttribute('href', '/events?city=Edison')
    expect(edison).toHaveAccessibleName(/^Edison \d+ events? listed$/)
    expect(screen.getByRole('list', { name: 'Cities in Pacific Time' })).toBeInTheDocument()
  })

  it('names the busiest cities first in a short index, and keeps every city one disclosure away', async () => {
    const events = sampleEventSummaries()
    const container = await draw({ events })

    const top = screen.getByRole('list', { name: 'Cities with the most events' })
    const links = within(top).getAllByRole('link')
    const counts = links.map((link) => Number(/(\d+) events? listed$/.exec(link.textContent)[1]))

    expect(links.length).toBeGreaterThan(0)
    expect(links.length).toBeLessThanOrEqual(12)
    expect([...counts].sort((left, right) => right - left)).toEqual(counts)
    // The full list is there, closed: a phone is not handed a wall of cities.
    const every = container.querySelector('details')

    expect(every).not.toHaveAttribute('open')
    expect(within(every).getByText('Every city, by time zone')).toBeInTheDocument()
    expect(every.querySelectorAll('a[href^="/events?city="]').length).toBe(
      new Set(events.map((event) => event.city)).size,
    )
  })

  it('offers the categories that have something listed, and only those', async () => {
    await draw()

    const categories = screen.getByRole('list', { name: 'Browse by category' })
    const names = within(categories)
      .getAllByRole('heading', { level: 3 })
      .map((heading) => heading.textContent)

    expect(names).toContain('Garba & Dandiya')
    expect(names).toContain('Workshops')
    expect(names).not.toContain('Comedy')
  })

  it('names the next event of each kind, linked on its own', async () => {
    const events = sampleEventSummaries()

    await draw({ events })

    const categories = screen.getByRole('list', { name: 'Browse by category' })
    const garba = within(categories)
      .getAllByRole('listitem')
      .find((item) => within(item).queryByRole('heading', { name: 'Garba & Dandiya' }))
    const next = notYetOver(events).find((event) => event.category === 'GARBA_DANDIYA')

    expect(within(garba).getByRole('link', { name: /^Garba & Dandiya/ })).toHaveAttribute(
      'href',
      '/events?category=GARBA_DANDIYA',
    )
    expect(within(garba).getByRole('link', { name: next.title })).toHaveAttribute(
      'href',
      `/events/${next.slug}`,
    )
  })

  it('says in its own words that payments are simulated and tax is not calculated', async () => {
    const container = await draw()

    expect(container.textContent).toMatch(
      /Payments on this site are simulated\. No card is charged and no money moves\./,
    )
    expect(container.textContent).toMatch(/US sales tax is not calculated in this demo/)
  })

  it('says how booking works in plain sentences, not a numbered row of steps', async () => {
    await draw()

    const how = screen.getByRole('region', { name: 'How booking works' })

    expect(within(how).queryByRole('list')).toBeNull()
    expect(within(how).queryAllByRole('heading')).toHaveLength(1)
    expect(how.textContent.replace(/\s+/g, ' ')).toContain(
      'Search for an event, a venue or an organiser, pick your tickets, and we hold them while you check out. Tickets live in your account, so booking needs one. Payments on this site are simulated. No card is charged and no money moves.',
    )
    expect(
      within(how).getByRole('link', { name: 'Read what else this demo leaves out' }),
    ).toHaveAttribute('href', '/limitations')
  })

  it('speaks for the whole calendar across the USA and Canada, and says only tickets sold here are in US dollars', async () => {
    const container = await draw()
    const text = container.textContent.replace(/\s+/g, ' ')

    expect(text).toContain(
      'Concerts, stand-up, garba, Durga Puja, Diwali melas and Bollywood nights across the USA and Canada. Search for what you feel like, and see the full price before you book.',
    )
    expect(text).toContain(
      'Tickets sold here are priced in US dollars, or Canadian dollars at a venue in Canada. US sales tax is not calculated in this demo, so checkout shows it as $0.00.',
    )
    expect(text).not.toMatch(/Prices are in US dollars/)
    expect(text).not.toMatch(/Find your garba|Nine nights/)
  })

  it('is canonical at the site’s root', () => {
    expect(metadata).toEqual({ alternates: { canonical: '/' } })
  })

  it('points organisers at the workspace and at accepting an invitation, and says events are reviewed', async () => {
    const container = await draw()

    expect(screen.getByRole('link', { name: /Open the organiser workspace/ })).toHaveAttribute(
      'href',
      '/organizer',
    )
    expect(screen.getByRole('link', { name: 'What this site does not do' })).toHaveAttribute(
      'href',
      '/limitations',
    )
    expect(screen.getByRole('link', { name: 'Accept an organiser invitation' })).toHaveAttribute(
      'href',
      '/account/organizations/new',
    )
    expect(container.textContent).toMatch(
      /Organisers join The Desi Events by invitation from the team at The Desi Events, and every event is\s+reviewed by the team before it is published\./,
    )
    expect(container.textContent).toMatch(/There is no sign-up form for organisers on this site\./)
    // Organisations are not made from an account here.
    expect(screen.queryByRole('link', { name: /create an organisation/i })).toBeNull()
    expect(container.textContent).not.toMatch(/create an organisation/i)
    expect(container.textContent).not.toMatch(/no sign-up for an organisation/i)
  })

  it('invents no urgency and no popularity', async () => {
    const container = await draw()

    expect(container.textContent).not.toMatch(
      /selling fast|few left|hurry|popular|trending|coming soon|\bsoon\b/i,
    )
  })

  it('shows the sample notice when, and only when, the catalogue fell back', async () => {
    // One event a draw: the notice is about where the page came from, and the
    // whole catalogue's poster art, drawn twice, made this the slowest case in
    // the suite.
    const events = sampleEventSummaries().slice(0, 1)

    await draw({ events, usedFallback: true })
    expect(screen.getByText('Showing our sample programme')).toBeInTheDocument()

    cleanup()
    await draw({ events, usedFallback: false })
    expect(screen.queryByText('Showing our sample programme')).toBeNull()
  })

  it('leaves figures out, rather than showing zeros, when the facets could not be read', async () => {
    const container = await draw({
      facets: { scope: { status: 'LISTED', total: 0 }, categories: [], cities: [] },
    })

    expect(screen.queryByRole('list', { name: /^Cities in/ })).toBeNull()
    expect(screen.queryByRole('list', { name: 'Browse by category' })).toBeNull()
    expect(container.textContent).not.toMatch(/\b0 (cities|events)\b/)
  })

  it('says so plainly when nothing is listed', async () => {
    await draw({ events: [] })

    expect(screen.getByText(/Nothing is listed right now/)).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Upcoming events' })).toBeNull()
  })
})

describe('counting clicks on the home page', () => {
  it('counts the cards and the next night, scoped once for the page', async () => {
    const events = sampleEventSummaries().map((event, index) => ({
      ...event,
      id: `chomeevent${String(index).padStart(14, '0')}`,
      organizationId: 'corgalpha00000000000001',
    }))

    await draw({ events })

    expect(screen.getAllByTestId('traffic-scope')).toHaveLength(1)
    expect(screen.getByTestId('traffic-scope').dataset.view).toBe('null')

    const rail = screen.getByRole('list', { name: 'Upcoming events' })
    const cardLinks = within(rail).getAllByRole('link')

    expect(cardLinks.length).toBeGreaterThan(0)
    expect(cardLinks.every((link) => link.dataset.trafficPlacement === 'HOME')).toBe(true)
    expect(cardLinks.every((link) => link.dataset.trafficKind === 'CARD_CLICK')).toBe(true)

    // The hero's "next up" link and each kind of night's next event are card
    // clicks on the home page too.
    const marked = [...document.querySelectorAll('a[data-traffic-kind]')]
    const kinds = within(screen.getByRole('list', { name: 'Browse by category' }))
      .getAllByRole('link')
      .filter((link) => link.getAttribute('href').startsWith('/events/'))

    expect(kinds.length).toBeGreaterThan(0)
    expect(kinds.every((link) => link.dataset.trafficPlacement === 'HOME')).toBe(true)
    expect(marked.length).toBe(cardLinks.length + 1 + kinds.length)
  })

  it('counts nothing on sample data, whose events do not exist', async () => {
    await draw({ usedFallback: true })

    expect(document.querySelectorAll('[data-traffic-kind]')).toHaveLength(0)
  })
})

describe('who runs the site, for search engines', () => {
  it('publishes one Organization block with the company’s own channels', async () => {
    const container = await draw()

    const blocks = [...container.querySelectorAll('script[type="application/ld+json"]')].map(
      (script) => JSON.parse(script.textContent),
    )
    const organizations = blocks.filter((block) => block['@type'] === 'Organization')

    expect(organizations).toEqual([
      {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'The Desi Events',
        url: 'https://thedesievents.com',
        email: 'info@thedesievents.com',
        telephone: '+19726949043',
        sameAs: [
          'https://www.facebook.com/the.desievents',
          'https://www.instagram.com/the.desievents',
        ],
        logo: new URL(
          '/brand/logo-square-512.png',
          process.env.NEXT_PUBLIC_SITE_URL ?? 'http://127.0.0.1:3000',
        ).href,
      },
    ])
  })

  it('describes the site as a WebSite whose search is the listing’s own', async () => {
    const container = await draw()
    const blocks = [...container.querySelectorAll('script[type="application/ld+json"]')].map(
      (script) => JSON.parse(script.textContent),
    )
    const site = blocks.filter((block) => block['@type'] === 'WebSite')
    const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://127.0.0.1:3000'

    expect(site).toEqual([
      {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'The Desi Events',
        url: new URL('/', base).href,
        potentialAction: {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: `${new URL('/events', base).href}?q={search_term_string}`,
          },
          'query-input': 'required name=search_term_string',
        },
      },
    ])
  })

  it('names only a logo it has: an absolute address of the square logo this site serves', async () => {
    const container = await draw()
    const logos = [...container.querySelectorAll('script[type="application/ld+json"]')]
      .map((script) => JSON.parse(script.textContent))
      .filter((block) => 'logo' in block)
      .map((block) => block.logo)

    expect(logos).toHaveLength(1)

    const address = new URL(logos[0])

    // Absolute, as schema.org asks: it parses without a base.
    expect(address.protocol).toMatch(/^https?:$/u)
    expect(address.pathname).toBe('/brand/logo-square-512.png')
    expect(existsSync(path.join(HERE, '../../../public', address.pathname))).toBe(true)
  })
})
