import { describe, expect, it } from 'vitest'

import { currentHref } from './active-path.js'

const DISCOVER = [
  { href: '/events' },
  { href: '/events?category=GARBA_DANDIYA' },
  { href: '/events?category=MUSIC_CONCERT' },
  { href: '/events?category=COMEDY' },
]

describe('currentHref', () => {
  it('marks nothing current on an address that cannot be decoded', () => {
    // The server renders such an address as the page for an unreadable
    // address, at its own path; marking "/events" current only in the
    // browser would make the two disagree.
    expect(currentHref(DISCOVER, '/events/%E0%A4%A', new URLSearchParams(''))).toBeNull()
    expect(currentHref(DISCOVER, '/events/%E0%A4%85', new URLSearchParams(''))).toBe('/events')
  })

  it('marks only the category the page is filtered to, not every link to /events', () => {
    expect(currentHref(DISCOVER, '/events', new URLSearchParams('category=COMEDY'))).toBe(
      '/events?category=COMEDY',
    )
  })

  it('marks the unfiltered entry when no category is chosen', () => {
    expect(currentHref(DISCOVER, '/events', new URLSearchParams(''))).toBe('/events')
  })

  it('ignores parameters an entry does not ask about', () => {
    expect(
      currentHref(DISCOVER, '/events', new URLSearchParams('category=COMEDY&city=Toronto')),
    ).toBe('/events?category=COMEDY')
  })

  it('marks the plain entry on a page beneath it', () => {
    expect(currentHref(DISCOVER, '/events/garba-night', null)).toBe('/events')
  })

  it('prefers the longer path when two entries both contain the page', () => {
    const items = [{ href: '/finance' }, { href: '/finance/connect' }]

    expect(currentHref(items, '/finance/connect', null)).toBe('/finance/connect')
    expect(currentHref(items, '/finance', null)).toBe('/finance')
  })

  it('marks nothing on a page no entry contains', () => {
    expect(currentHref(DISCOVER, '/tickets', null)).toBeNull()
    expect(currentHref(DISCOVER, null, null)).toBeNull()
  })

  it('never marks more than one entry', () => {
    const search = new URLSearchParams('category=GARBA_DANDIYA')
    const current = DISCOVER.filter(
      (item) => currentHref(DISCOVER, '/events', search) === item.href,
    )

    expect(current).toHaveLength(1)
  })

  it('files a seating map version under Venues, not under the Overview it shares a prefix with', () => {
    const rail = [
      { href: '/organizer' },
      { href: '/organizer/events' },
      { href: '/organizer/venues' },
    ]

    expect(currentHref(rail, '/organizer/map-versions/cmv123')).toBe('/organizer/venues')
    expect(currentHref(rail, '/organizer/map-versions')).toBe('/organizer/venues')
    // A path that only starts with the same letters is not filed there.
    expect(currentHref(rail, '/organizer/map-versionsx')).toBe('/organizer')
    expect(currentHref(rail, '/organizer')).toBe('/organizer')
  })
})
