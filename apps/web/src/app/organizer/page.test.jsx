/**
 * The workspace front page says what the account looks after, organisation
 * by organisation, and leaves the way around the workspace to the rail.
 *
 * @module app/organizer/page.test
 */

import { PLATFORM_ROLE_CAPABILITIES } from '@desi-event/permissions'
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../lib/session.js', async () => ({
  readSession: vi.fn(),
  sessionCan: (await import('../../lib/capabilities.js')).sessionCan,
}))
vi.mock('../../lib/organizer-api.js', () => ({ listOrganizerEvents: vi.fn() }))

const { readSession } = await import('../../lib/session.js')
const { listOrganizerEvents } = await import('../../lib/organizer-api.js')
const { default: OrganizerHomePage, nextUp, todayMark, WAITING_SHOWN } = await import('./page.jsx')

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  listOrganizerEvents.mockReset()
})

/**
 * Render the page for a session.
 *
 * @param {object} session The session.
 * @returns {Promise<void>} Resolves once rendered.
 */
async function renderFor(session) {
  readSession.mockResolvedValue(session)
  render(await OrganizerHomePage())
}

/** An owner of one organisation. */
const OWNER = {
  user: { id: 'u1' },
  capabilities: [],
  memberships: [
    {
      organizationId: 'corgalpha00000000000001',
      organizationName: 'Alpha Garba',
      role: 'OWNER',
      capabilities: ['report:view', 'event:create', 'ticket:check_in'],
    },
  ],
}

describe('the workspace front page', () => {
  it('says, per organisation, what this account holds there, in words', async () => {
    await renderFor(OWNER)

    const section = screen.getByRole('region', { name: 'Your organisations' })
    const held = within(section).getByRole('list', { name: 'What this role lets you do' })

    expect(within(section).getByText('Alpha Garba')).toBeInTheDocument()
    expect(within(section).getByText('OWNER')).toBeInTheDocument()
    expect(
      within(held)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['Create and edit events', 'Admit people at the door', 'See how events are selling'])
  })

  it('repeats no menu: the rail beside it is the way around the workspace', async () => {
    // The page used to end in a grid of link cards, one per rail entry, which
    // with the rail and an area's tabs made three menus on one screen.
    await renderFor(OWNER)

    expect(screen.queryAllByRole('link')).toEqual([])
    expect(screen.queryByRole('region', { name: 'Events and venues' })).toBeNull()
  })

  it('says where a platform administrator’s reach comes from when they belong to no organisation', async () => {
    await renderFor({
      user: { id: 'u2' },
      capabilities: [...PLATFORM_ROLE_CAPABILITIES.ADMIN],
      memberships: [],
    })

    expect(
      screen.getByText(
        'You are not a member of any organisation. What you can open here comes from a platform role.',
      ),
    ).toBeInTheDocument()
    expect(screen.queryAllByRole('link')).toEqual([])
  })
})

/** 2026-10-19 at 15:00 UTC, which is 11:00 in New York. */
const NOW = Date.parse('2026-10-19T15:00:00.000Z')

/**
 * An event row as `GET /v1/events` lists it.
 *
 * @param {object} overrides Fields to change.
 * @returns {object} The row.
 */
function row(overrides = {}) {
  return {
    id: 'cevent000000000000000001',
    organizationId: 'corgalpha00000000000001',
    title: 'Diwali Mela',
    status: 'ON_SALE',
    startsAt: '2026-11-07T23:00:00.000Z',
    endsAt: '2026-11-08T04:00:00.000Z',
    timezone: 'America/New_York',
    venueName: 'Lamplight Hall',
    city: 'Edison',
    ...overrides,
  }
}

/** The owner again, now allowed to read the organisation's drafts. */
const READER = {
  ...OWNER,
  memberships: [
    {
      ...OWNER.memberships[0],
      capabilities: [...OWNER.memberships[0].capabilities, 'event:view_draft'],
    },
  ],
}

describe('next up', () => {
  it('is the soonest event that has not ended and is still going ahead', () => {
    const events = [
      row({ id: 'late', startsAt: '2026-12-01T00:00:00.000Z', endsAt: null }),
      row({ id: 'over', startsAt: '2026-10-01T00:00:00.000Z', endsAt: '2026-10-01T04:00:00.000Z' }),
      row({ id: 'off', status: 'CANCELLED', startsAt: '2026-10-20T00:00:00.000Z' }),
      row({ id: 'soon', startsAt: '2026-10-25T00:00:00.000Z', endsAt: null }),
      row({ id: 'gone', status: 'DELETED', startsAt: '2026-10-21T00:00:00.000Z' }),
    ]

    expect(nextUp(events, NOW).id).toBe('soon')
  })

  it('counts an event that has started but not ended', () => {
    const events = [
      row({ id: 'on', startsAt: '2026-10-19T14:00:00.000Z', endsAt: '2026-10-19T18:00:00.000Z' }),
      row({ id: 'later', startsAt: '2026-10-20T00:00:00.000Z' }),
    ]

    expect(nextUp(events, NOW).id).toBe('on')
  })

  it('is nothing when every event is over or off', () => {
    expect(nextUp([row({ status: 'ARCHIVED' })], NOW)).toBeNull()
    expect(nextUp([], NOW)).toBeNull()
  })
})

describe('the day mark', () => {
  it('says "on" once an event has started and until it ends', () => {
    expect(
      todayMark(
        row({ startsAt: '2026-10-19T14:00:00.000Z', endsAt: '2026-10-19T18:00:00.000Z' }),
        NOW,
      ),
    ).toBe('on')
  })

  it('says "today" on its day before it starts, in the event’s own time zone', () => {
    // 23:30 New York time on the 19th is already the 20th in UTC.
    const evening = row({ startsAt: '2026-10-20T03:30:00.000Z', endsAt: null })

    expect(todayMark(evening, NOW)).toBe('today')
    expect(todayMark({ ...evening, timezone: 'UTC' }, NOW)).toBeNull()
  })

  it('says nothing on any other day', () => {
    expect(todayMark(row(), NOW)).toBeNull()
    expect(todayMark(row({ startsAt: 'not a date' }), NOW)).toBeNull()
  })
})

describe('the overview, read from the organisation’s own events', () => {
  it('reads the events only of an organisation whose drafts this account may see', async () => {
    await renderFor(OWNER)

    expect(listOrganizerEvents).not.toHaveBeenCalled()
    expect(screen.queryByRole('heading', { name: 'Next up' })).toBeNull()
  })

  it('sets the next event as a plate with its date, place and state, linked to its editor', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: NOW })
    listOrganizerEvents.mockResolvedValue({ events: [row()], pagination: { hasNextPage: false } })

    await renderFor(READER)

    expect(listOrganizerEvents).toHaveBeenCalledWith({ organizationId: 'corgalpha00000000000001' })

    const plate = document.querySelector('[data-slot="next-up"]')

    expect(within(plate).getByRole('link', { name: 'Diwali Mela' })).toHaveAttribute(
      'href',
      '/organizer/events/cevent000000000000000001',
    )
    const when = plate.querySelector('time')

    expect(when).toHaveAttribute('dateTime', '2026-11-07T23:00:00.000Z')
    expect(when.parentElement.textContent).toMatch(
      /^Sat, Nov 7, 2026, 6:00\sPM · Lamplight Hall, Edison$/u,
    )
    expect(within(plate).getByText('On sale')).toBeInTheDocument()
    // Not its day: no mark and no door.
    expect(within(plate).queryByText('Today')).toBeNull()
    expect(within(plate).queryByRole('link', { name: 'Open check-in' })).toBeNull()
  })

  it('offers the door on the event’s day, to an account that admits people there', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: NOW })
    listOrganizerEvents.mockResolvedValue({
      events: [row({ startsAt: '2026-10-19T22:00:00.000Z', endsAt: '2026-10-20T03:00:00.000Z' })],
      pagination: null,
    })

    await renderFor(READER)

    const plate = document.querySelector('[data-slot="next-up"]')

    expect(within(plate).getByText('Today')).toBeInTheDocument()
    expect(within(plate).getByRole('link', { name: 'Open check-in' })).toHaveAttribute(
      'href',
      '/organizer/check-in',
    )
  })

  it('does not offer the door to an account that cannot admit anybody there', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: NOW })
    listOrganizerEvents.mockResolvedValue({
      events: [row({ startsAt: '2026-10-19T14:00:00.000Z', endsAt: '2026-10-19T20:00:00.000Z' })],
      pagination: null,
    })

    await renderFor({
      ...READER,
      memberships: [{ ...READER.memberships[0], capabilities: ['event:view_draft'] }],
    })

    const plate = document.querySelector('[data-slot="next-up"]')

    expect(within(plate).getByText('On now')).toBeInTheDocument()
    expect(within(plate).queryByRole('link', { name: 'Open check-in' })).toBeNull()
  })

  it('lists what is waiting on the organiser, and says how many more there are', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: NOW })
    const drafts = Array.from({ length: WAITING_SHOWN + 2 }, (_, index) =>
      row({ id: `cdraft${index}`, title: `Draft ${index + 1}`, status: 'DRAFT' }),
    )

    listOrganizerEvents.mockResolvedValue({
      events: [
        ...drafts,
        row({ id: 'cpending', title: 'With a moderator', status: 'PENDING_REVIEW' }),
      ],
      pagination: { hasNextPage: true },
    })

    await renderFor(READER)

    const heading = screen.getByRole('heading', { name: 'Waiting on you' })
    const column = heading.parentElement
    const items = within(column).getAllByRole('listitem')

    expect(items).toHaveLength(WAITING_SHOWN)
    expect(within(items[0]).getByRole('link', { name: 'Draft 1' })).toHaveAttribute(
      'href',
      '/organizer/events/cdraft0',
    )
    expect(within(items[0]).getByText('Draft')).toBeInTheDocument()
    expect(within(column).queryByRole('link', { name: 'With a moderator' })).toBeNull()
    expect(within(column).getByText('And 2 more in your events.')).toBeInTheDocument()
    expect(
      within(column).getByText('Counted from the 50 most recently created events.'),
    ).toBeInTheDocument()
  })

  it('says plainly when nothing is coming up and nothing is waiting', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: NOW })
    listOrganizerEvents.mockResolvedValue({ events: [], pagination: null })

    await renderFor(READER)

    expect(
      screen.getByText(
        'Nothing is coming up. An event appears here from when it is created until it ends.',
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Nothing. Every event here is with a moderator or needs nothing from you.'),
    ).toBeInTheDocument()
    expect(screen.queryByText(/Counted from/u)).toBeNull()
  })

  it('says the events could not be read, rather than showing an empty organisation', async () => {
    listOrganizerEvents.mockRejectedValue(new Error('down'))

    await renderFor(READER)

    expect(
      screen.getByText('This organisation’s events could not be read just now.'),
    ).toBeInTheDocument()
    expect(screen.queryByText(/Nothing is coming up/u)).toBeNull()
    expect(screen.queryByText(/^Nothing\./u)).toBeNull()
    // The rest of the page stands.
    expect(screen.getByRole('list', { name: 'What this role lets you do' })).toBeInTheDocument()
  })
})
