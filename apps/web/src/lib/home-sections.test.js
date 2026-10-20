import { describe, expect, it } from 'vitest'

import {
  calendarLeaf,
  groupCitiesByZone,
  homeAgenda,
  notYetOver,
  organisersWithNext,
  topCities,
  weekendDates,
} from './home-sections.js'

/** An instant in October, when the US zones are on daylight time. */
const OCTOBER = new Date('2026-10-01T12:00:00.000Z')

/**
 * A listing summary with only what these helpers read.
 *
 * @param {object} fields Overrides.
 * @returns {object} The summary.
 */
function summary(fields) {
  return {
    slug: 'an-event',
    startsAt: '2026-10-11T23:30:00.000Z',
    timezone: 'America/New_York',
    ...fields,
  }
}

describe('groupCitiesByZone', () => {
  const events = [
    summary({ city: 'Santa Clara', timezone: 'America/Los_Angeles' }),
    summary({ city: 'Edison', timezone: 'America/New_York' }),
    summary({ city: 'Houston', timezone: 'America/Chicago' }),
    summary({ city: 'Queens', timezone: 'America/New_York' }),
  ]
  const facets = [
    { value: 'Queens', count: 2 },
    { value: 'Houston', count: 3 },
    { value: 'Edison', count: 4 },
    { value: 'Santa Clara', count: 2 },
  ]

  it('groups the cities east to west, by the zone their events are held in', () => {
    const groups = groupCitiesByZone(facets, events, { at: OCTOBER })

    expect(groups.map((group) => group.name)).toEqual([
      'Eastern Time',
      'Central Time',
      'Pacific Time',
    ])
    expect(groups.map((group) => group.short)).toEqual(['ET', 'CT', 'PT'])
  })

  it('lists each group’s cities alphabetically, with the facets’ own counts', () => {
    const [eastern] = groupCitiesByZone(facets, events, { at: OCTOBER })

    expect(eastern.cities).toEqual([
      { city: 'Edison', count: 4 },
      { city: 'Queens', count: 2 },
    ])
  })

  it('does not guess a zone for a city with no event on the page', () => {
    const groups = groupCitiesByZone([...facets, { value: 'Bellevue', count: 1 }], events, {
      at: OCTOBER,
    })
    const last = groups.at(-1)

    expect(last).toEqual({
      key: 'other',
      name: 'More cities',
      short: null,
      cities: [{ city: 'Bellevue', count: 1 }],
    })
  })

  it('shows no count rather than a made-up one when the facet has none', () => {
    const [eastern] = groupCitiesByZone([{ value: 'Edison' }], events, { at: OCTOBER })

    expect(eastern.cities).toEqual([{ city: 'Edison', count: null }])
  })

  it('returns nothing when the facets could not be read', () => {
    expect(groupCitiesByZone(undefined, events)).toEqual([])
    expect(groupCitiesByZone([], events)).toEqual([])
  })

  it('puts a city under "More cities" when its zone is not one the runtime knows', () => {
    const groups = groupCitiesByZone(
      [{ value: 'Nowhere', count: 1 }],
      [summary({ city: 'Nowhere', timezone: 'Not/AZone' })],
      { at: OCTOBER },
    )

    expect(groups).toEqual([
      { key: 'other', name: 'More cities', short: null, cities: [{ city: 'Nowhere', count: 1 }] },
    ])
  })
})

describe('calendarLeaf', () => {
  it('names the month and day in the event’s own zone', () => {
    // 02:30 UTC on the 12th is still the evening of the 11th in Santa Clara.
    expect(
      calendarLeaf(
        summary({ startsAt: '2026-10-12T02:30:00.000Z', timezone: 'America/Los_Angeles' }),
      ),
    ).toEqual({ month: 'Oct', day: '11' })
    expect(
      calendarLeaf(summary({ startsAt: '2026-10-12T02:30:00.000Z', timezone: 'America/New_York' })),
    ).toEqual({ month: 'Oct', day: '11' })
    expect(
      calendarLeaf(summary({ startsAt: '2026-10-12T05:30:00.000Z', timezone: 'America/New_York' })),
    ).toEqual({ month: 'Oct', day: '12' })
  })

  it('has nothing to say about an event with no start', () => {
    expect(calendarLeaf(summary({ startsAt: null }))).toBeNull()
    expect(calendarLeaf(null)).toBeNull()
  })
})

describe('organisersWithNext', () => {
  const events = [
    summary({
      slug: 'b-first',
      startsAt: '2026-10-03T23:00:00.000Z',
      organizationName: 'Mirrorwork Events',
      organizationSlug: 'mirrorwork-events',
    }),
    summary({
      slug: 'c-second',
      startsAt: '2026-10-06T00:00:00.000Z',
      organizationName: 'Chaniya Collective',
      organizationSlug: 'chaniya-collective',
    }),
    summary({
      slug: 'b-again',
      startsAt: '2026-10-11T23:30:00.000Z',
      organizationName: 'Mirrorwork Events',
      organizationSlug: 'mirrorwork-events',
    }),
    summary({ slug: 'no-page', organizationName: 'Somebody Without A Page' }),
  ]

  it('names each organiser once, with their soonest night', () => {
    expect(organisersWithNext(events)).toEqual([
      { name: 'Mirrorwork Events', slug: 'mirrorwork-events', next: events[0] },
      { name: 'Chaniya Collective', slug: 'chaniya-collective', next: events[1] },
    ])
  })

  it('orders by the soonest night, not by how many each has', () => {
    const reordered = [events[1], events[2], events[0]]

    expect(organisersWithNext(reordered).map((entry) => entry.slug)).toEqual([
      'mirrorwork-events',
      'chaniya-collective',
    ])
  })

  it('leaves out an organiser with no page to link to, and stops at the limit', () => {
    expect(organisersWithNext(events, 1)).toHaveLength(1)
    expect(organisersWithNext(events).map((entry) => entry.name)).not.toContain(
      'Somebody Without A Page',
    )
    expect(organisersWithNext(undefined)).toEqual([])
  })
})

describe('notYetOver', () => {
  const now = Date.parse('2026-10-11T12:00:00.000Z')

  it('keeps what is still to come or happening now, in the order given', () => {
    const later = summary({ slug: 'later', startsAt: '2026-10-12T23:30:00.000Z' })
    const tonight = summary({
      slug: 'tonight',
      startsAt: '2026-10-11T10:00:00.000Z',
      endsAt: '2026-10-11T15:00:00.000Z',
    })

    expect(notYetOver([later, tonight], now)).toEqual([later, tonight])
  })

  it('drops a night that has already ended, whatever its status says', () => {
    const finished = summary({
      slug: 'finished',
      status: 'ON_SALE',
      startsAt: '2026-10-02T23:30:00.000Z',
      endsAt: '2026-10-03T04:00:00.000Z',
    })

    expect(notYetOver([finished], now)).toEqual([])
  })

  it('falls back to the start when there is no end, and drops what has neither', () => {
    expect(notYetOver([summary({ slug: 'no-end' })], now)).toHaveLength(1)
    expect(notYetOver([summary({ startsAt: null })], now)).toEqual([])
    expect(notYetOver(undefined, now)).toEqual([])
  })
})

describe('weekendDates', () => {
  // 2026-10-19 is a Monday; 23, 24 and 25 October are Friday to Sunday.
  it('names the coming Friday to Sunday from Monday to Thursday', () => {
    expect(weekendDates(Date.parse('2026-10-19T15:00:00Z'), 'America/New_York')).toEqual({
      from: '2026-10-23',
      to: '2026-10-25',
    })
    expect(weekendDates(Date.parse('2026-10-22T15:00:00Z'), 'America/New_York')).toEqual({
      from: '2026-10-23',
      to: '2026-10-25',
    })
  })

  it('starts from today once the weekend is under way', () => {
    expect(weekendDates(Date.parse('2026-10-24T15:00:00Z'), 'America/New_York')).toEqual({
      from: '2026-10-24',
      to: '2026-10-25',
    })
    expect(weekendDates(Date.parse('2026-10-25T15:00:00Z'), 'America/New_York')).toEqual({
      from: '2026-10-25',
      to: '2026-10-25',
    })
  })

  it('reads the day in the zone asked about', () => {
    // Friday 01:00 in New York is still Thursday evening in Los Angeles.
    const now = Date.parse('2026-10-23T05:00:00Z')

    expect(weekendDates(now, 'America/New_York').from).toBe('2026-10-23')
    expect(weekendDates(now, 'America/Los_Angeles')).toEqual({
      from: '2026-10-23',
      to: '2026-10-25',
    })
  })
})

describe('homeAgenda', () => {
  const MONDAY = Date.parse('2026-10-19T15:00:00Z')
  const at = (iso, fields = {}) => summary({ slug: iso, startsAt: iso, endsAt: null, ...fields })

  it('lists this weekend’s events, by day, when the weekend has any', () => {
    const events = [
      at('2026-10-20T23:00:00Z'),
      at('2026-10-23T23:00:00Z'),
      at('2026-10-24T01:00:00Z'),
      at('2026-10-24T23:00:00Z'),
      at('2026-10-27T23:00:00Z'),
    ]
    const agenda = homeAgenda(events, { now: MONDAY })

    expect(agenda.kind).toBe('weekend')
    // 01:00 UTC on Saturday is still Friday evening in New York.
    expect(agenda.days.map((day) => [day.key, day.events.map((event) => event.slug)])).toEqual([
      ['2026-10-23', ['2026-10-23T23:00:00Z', '2026-10-24T01:00:00Z']],
      ['2026-10-24', ['2026-10-24T23:00:00Z']],
    ])
  })

  it('says "coming up" instead, and lists the soonest, when the weekend is empty', () => {
    const events = [at('2026-10-20T23:00:00Z'), at('2026-10-27T23:00:00Z')]
    const agenda = homeAgenda(events, { now: MONDAY })

    expect(agenda.kind).toBe('upcoming')
    expect(agenda.events.map((event) => event.slug)).toEqual([
      '2026-10-20T23:00:00Z',
      '2026-10-27T23:00:00Z',
    ])
  })

  it('leaves out what has finished, and stops at the limit', () => {
    const events = [
      at('2026-10-18T23:00:00Z', { endsAt: '2026-10-19T03:00:00Z' }),
      ...Array.from({ length: 10 }, (_, index) => at(`2026-10-23T1${index}:00:00Z`)),
    ]
    const agenda = homeAgenda(events, { now: MONDAY, limit: 8 })

    expect(agenda.events).toHaveLength(8)
    expect(agenda.events.map((event) => event.slug)).not.toContain('2026-10-18T23:00:00Z')
  })

  it('has nothing to list when nothing is coming', () => {
    expect(homeAgenda([], { now: MONDAY })).toEqual({ kind: 'upcoming', events: [], days: [] })
  })
})

describe('topCities', () => {
  it('names the cities with the most events first, ties alphabetically, up to the limit', () => {
    const facets = [
      { value: 'Edison', count: 4 },
      { value: 'Atlanta', count: 9 },
      { value: 'Queens', count: 4 },
      { value: 'Frisco', count: 1 },
    ]

    expect(topCities(facets, 3)).toEqual([
      { city: 'Atlanta', count: 9 },
      { city: 'Edison', count: 4 },
      { city: 'Queens', count: 4 },
    ])
  })

  it('leaves out a city with no count it can show', () => {
    expect(
      topCities([{ value: 'Edison' }, { value: '', count: 3 }, { value: 'Queens', count: 0 }]),
    ).toEqual([])
    expect(topCities(undefined)).toEqual([])
  })
})
