import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../lib/organizer-api.js', () => ({ listPlatformEvents: vi.fn() }))
vi.mock('../../../lib/session.js', () => ({ readSession: vi.fn() }))

const { listPlatformEvents } = await import('../../../lib/organizer-api.js')
const { readSession } = await import('../../../lib/session.js')
const {
  default: AdminEventsPage,
  DELETED_STATUS,
  EVENT_COLUMNS,
  EVENT_TABLE,
  INTRODUCTION,
  NOT_FOR_THIS_ACCOUNT,
  RESTORE_NOTE,
  readFilters,
} = await import('./page.jsx')

/** A platform administrator's session. */
const ADMIN = {
  user: { id: 'u1' },
  capabilities: ['organizer:invite', 'event:platform_edit', 'event:platform_delete'],
  memberships: [],
}

/**
 * A row of the platform list.
 *
 * @param {object} [overrides] Fields to change.
 * @returns {object} The row.
 */
function row(overrides = {}) {
  return {
    id: 'cevent0000000000000000001',
    title: 'Diwali Mela',
    slug: 'diwali-mela-2026',
    status: 'ON_SALE',
    startsAt: '2026-10-17T23:30:00.000Z',
    updatedAt: '2026-10-05T12:00:00.000Z',
    organization: { id: 'corg000000000000000000001', name: 'Rangoli Arts' },
    paidOrders: 12,
    picturesWaiting: 1,
    imported: false,
    deletion: null,
    ...overrides,
  }
}

/**
 * Render the page for a query.
 *
 * @param {object} [query] The search parameters.
 * @returns {Promise<void>} Resolves once rendered.
 */
async function renderPage(query = {}) {
  render(await AdminEventsPage({ searchParams: Promise.resolve(query) }))
}

beforeEach(() => {
  readSession.mockResolvedValue(ADMIN)
  listPlatformEvents.mockResolvedValue({
    events: [row()],
    pagination: { page: 1, perPage: 50, total: 1, totalPages: 1, hasNextPage: false },
  })
})

describe('All events', () => {
  it('lists every organisation’s events in a captioned table, with what each row offers', async () => {
    await renderPage()

    const table = screen.getByRole('table', {
      name: /Events: 1 in this list, recently changed first/,
    })
    const [, first] = within(table).getAllByRole('row')

    expect(within(first).getByRole('rowheader')).toHaveTextContent('Diwali Mela')
    // The state is said twice: in its own column, and below md in the row's
    // heading cell, where its column is left out.
    expect(within(within(first).getAllByRole('cell')[0]).getByText('On sale')).toBeInTheDocument()
    expect(
      within(first.querySelector('[data-slot="row-state-start"]')).getByText('On sale'),
    ).toBeInTheDocument()
    expect(within(first).getByText('12')).toBeInTheDocument()
    expect(within(first).getByRole('link', { name: /Public page/ })).toHaveAttribute(
      'href',
      '/events/diwali-mela-2026',
    )
    expect(within(first).getByRole('link', { name: /Open in the editor/ })).toHaveAttribute(
      'href',
      '/admin/events/cevent0000000000000000001',
    )
    expect(within(first).getByRole('link', { name: /Delete…/ })).toHaveAttribute(
      'href',
      '/admin/events/cevent0000000000000000001#delete-event',
    )
    expect(listPlatformEvents).toHaveBeenCalledWith({
      q: undefined,
      status: undefined,
      organizationId: undefined,
      deleted: 'exclude',
      sort: 'updatedAt:desc',
      page: 1,
      perPage: 50,
    })
  })

  it('lists deleted events on their own filter, each offering its record and a restore', async () => {
    listPlatformEvents.mockResolvedValue({
      events: [
        row({
          status: 'DELETED',
          deletion: {
            deletedAt: '2026-10-01T10:00:00.000Z',
            outcome: 'REMOVE',
            authority: 'PLATFORM',
            statusBefore: 'ON_SALE',
            restoreTo: 'SALES_PAUSED',
          },
        }),
      ],
      pagination: null,
    })

    await renderPage({ deleted: 'only' })

    expect(screen.getByRole('link', { name: 'Taken off the site (deleted)' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(screen.getByText(RESTORE_NOTE)).toBeInTheDocument()
    // In the State column, and below md in the row's heading cell.
    const [, deletedRow] = within(screen.getByRole('table')).getAllByRole('row')

    expect(
      within(within(deletedRow).getAllByRole('cell')[0]).getByText('Restores as sales paused'),
    ).toBeInTheDocument()
    expect(
      within(deletedRow.querySelector('[data-slot="row-state-start"]')).getByText(
        'Restores as sales paused',
      ),
    ).toBeInTheDocument()
    expect(screen.getAllByText('Restores as sales paused')).toHaveLength(2)
    expect(screen.getByRole('link', { name: /Open its record/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Restore…/ })).toHaveAttribute(
      'href',
      '/admin/events/cevent0000000000000000001#restore-event',
    )
    expect(screen.queryByRole('link', { name: /Public page/ })).not.toBeInTheDocument()
    expect(listPlatformEvents.mock.calls[0][0]).toMatchObject({ deleted: 'only' })
  })

  it('sends only filters the API takes, and drops the rest', () => {
    expect(
      readFilters({
        q: '  garba ',
        status: 'ON_SALE',
        organizationId: 'corg000000000000000000001',
        deleted: 'include',
        sort: 'startsAt:asc',
        page: '3',
      }),
    ).toEqual({
      q: 'garba',
      searchDropped: false,
      status: 'ON_SALE',
      organizationId: 'corg000000000000000000001',
      deleted: 'include',
      sort: 'startsAt:asc',
      page: 3,
    })
    expect(
      readFilters({
        q: 'x\u0000',
        status: 'BOGUS',
        organizationId: '../x',
        deleted: 'all',
        sort: 'x',
      }),
    ).toEqual({
      q: undefined,
      searchDropped: true,
      status: undefined,
      organizationId: undefined,
      deleted: 'exclude',
      sort: 'updatedAt:desc',
      page: 1,
    })
  })

  it('keeps every filter in the organisation link, and says whose events are shown', async () => {
    await renderPage({ organizationId: 'corg000000000000000000001', sort: 'startsAt:asc' })

    expect(screen.getByText('Showing Rangoli Arts’s events only.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Rangoli Arts/ })).toHaveAttribute(
      'href',
      '/admin/events?organizationId=corg000000000000000000001&sort=startsAt%3Aasc',
    )
  })

  it('offers every organisation’s events again from one organisation’s, keeping the other filters', async () => {
    await renderPage({ organizationId: 'corg000000000000000000001', sort: 'startsAt:asc' })

    expect(screen.getByRole('link', { name: 'Every organisation’s events' })).toHaveAttribute(
      'href',
      '/admin/events?sort=startsAt%3Aasc',
    )
  })

  it('says, politely, that an event was just deleted, and that it can be put back', async () => {
    await renderPage({ deleted: '1' })

    expect(screen.getByText(DELETED_STATUS)).toHaveAttribute('aria-live', 'polite')
    expect(DELETED_STATUS).toBe(
      'Event deleted: it is off the site. It can be put back at any time from “Taken off the site (deleted)”, with “Restore…”.',
    )
  })

  it('says plainly that deleting takes an event off the site and a restore puts it back, any time', async () => {
    await renderPage()

    expect(screen.getByText(INTRODUCTION)).toBeInTheDocument()
    expect(INTRODUCTION).toMatch(
      /to delete it, which takes it off the site; or, once it is deleted, to restore it, which puts it back\. Deleting erases nothing, so a deleted event can be restored at any time\./u,
    )
    // The way to the deleted events is one link away, from the default list.
    expect(screen.getByRole('link', { name: 'Taken off the site (deleted)' })).toHaveAttribute(
      'href',
      '/admin/events?deleted=only',
    )
    // The note about restoring is for the list of deleted events.
    expect(screen.queryByText(RESTORE_NOTE)).not.toBeInTheDocument()
    expect(RESTORE_NOTE).toMatch(/choose “Restore…” on a row to put that event back, at any time/u)
    expect(RESTORE_NOTE).toMatch(/A published event comes back published, at the same web address/u)
  })

  it('narrows the list to imported events, deleted ones included, keeping the other filters', async () => {
    listPlatformEvents.mockResolvedValue({
      events: [
        row({
          imported: true,
          status: 'DELETED',
          deletion: {
            deletedAt: '2026-10-01T10:00:00.000Z',
            outcome: 'REMOVE',
            authority: 'PLATFORM',
            statusBefore: 'PUBLISHED',
            restoreTo: 'PUBLISHED',
          },
        }),
      ],
      pagination: null,
    })

    await renderPage({ deleted: 'only', imported: 'only' })

    expect(listPlatformEvents.mock.calls[0][0]).toMatchObject({
      deleted: 'only',
      imported: 'only',
    })
    expect(screen.getByRole('link', { name: 'Imported from listings' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(screen.getByRole('link', { name: 'From every source' })).toHaveAttribute(
      'href',
      '/admin/events?deleted=only',
    )
    expect(screen.getByRole('link', { name: 'Current events' })).toHaveAttribute(
      'href',
      '/admin/events?imported=only',
    )
    expect(screen.getByText('Imported')).toBeInTheDocument()
    expect(screen.getAllByText('Restores as published')).toHaveLength(2)
    expect(
      within(
        within(screen.getByRole('table'))
          .getAllByRole('row')[1]
          .querySelector('[data-slot="row-state-start"]'),
      ).getByText('Restores as published'),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Restore…/ })).toHaveAttribute(
      'href',
      '/admin/events/cevent0000000000000000001#restore-event',
    )
    expect(readFilters({ imported: 'bogus' }).imported).toBeUndefined()
  })

  it('refuses an account that does not edit events as the team at The Desi Events, and asks nothing', async () => {
    readSession.mockResolvedValue({
      user: { id: 'u2' },
      capabilities: ['moderation:review'],
      memberships: [],
    })

    await renderPage()

    expect(screen.getByText(NOT_FOR_THIS_ACCOUNT)).toBeInTheDocument()
    expect(listPlatformEvents).not.toHaveBeenCalled()
  })

  it('shows the API’s refusal rather than an empty list', async () => {
    listPlatformEvents.mockRejectedValue(Object.assign(new Error('No.'), { status: 403 }))

    await renderPage()

    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.queryByText('Nothing here')).not.toBeInTheDocument()
  })
})

describe('the booking fee and paying at the venue in the list (SPEC3 §7.3)', () => {
  it('says each event’s booking fee and whether it can be paid for at the venue', async () => {
    listPlatformEvents.mockResolvedValue({
      events: [
        row({ id: 'cevent0000000000000000001', title: 'Default fee night' }),
        row({
          id: 'cevent0000000000000000002',
          title: 'Own fee night',
          feeSource: 'EVENT',
          feePercentageBps: 300,
          feeFlatCentsPerTicket: 149,
          feeCurrency: 'USD',
          venuePaymentEnabled: true,
          venuePaymentLimit: 50,
        }),
        row({
          id: 'cevent0000000000000000003',
          title: 'Free fee night',
          feeSource: 'EVENT',
          feePercentageBps: 0,
          feeFlatCentsPerTicket: 0,
          feeCurrency: 'USD',
        }),
      ],
      pagination: { page: 1, perPage: 50, total: 3, totalPages: 1, hasNextPage: false },
    })

    await renderPage()

    const table = screen.getByRole('table')

    expect(within(table).getByRole('columnheader', { name: 'Booking fee' })).toBeInTheDocument()
    expect(
      within(table).getByRole('columnheader', { name: 'Pay at the venue' }),
    ).toBeInTheDocument()

    const rowOf = (title) =>
      within(table)
        .getByRole('rowheader', { name: new RegExp(title, 'u') })
        .closest('tr')

    expect(rowOf('Default fee night')).toHaveTextContent('Site default')
    expect(rowOf('Default fee night')).toHaveTextContent('Off')
    expect(rowOf('Own fee night')).toHaveTextContent('3.00% + $1.49')
    expect(rowOf('Own fee night')).toHaveTextContent('On, up to 50 unpaid')
    expect(rowOf('Free fee night')).toHaveTextContent('No booking fee')
  })

  it('lays the list out in fixed columns from xl, every heading on its own, and as records below', async () => {
    await renderPage()

    const table = screen.getByRole('table')
    const headings = within(table)
      .getAllByRole('columnheader')
      .map((heading) => heading.textContent)

    // The old layout let nine headings share an auto-sized table, so at 1440
    // "Pictures waiting" ran into "Booking fee" and the last column was cut.
    expect(headings).toEqual(EVENT_COLUMNS.map((column) => column.heading))
    expect(table).toHaveClass('xl:table', 'xl:table-fixed', 'block')
    for (const column of EVENT_COLUMNS.slice(1)) {
      expect(within(table).getByRole('columnheader', { name: column.heading })).toHaveClass(
        column.width,
      )
    }
    expect(table.closest('div')).toHaveClass(...EVENT_TABLE.frame.split(' '))
    expect(within(table).getByRole('columnheader', { name: 'Paid orders' })).toHaveClass(
      'text-right',
    )
  })

  it('folds the smaller columns into one line on a phone, and leaves the table’s columns as they are', async () => {
    await renderPage()

    const table = screen.getByRole('table')
    const [, first] = within(table).getAllByRole('row')
    const header = within(first).getByRole('rowheader')
    const summary = header.querySelector('[data-slot="row-summary"]')

    // Inside the row's heading cell, shown below md only.
    expect(summary).toHaveClass('md:hidden')
    expect(summary.textContent).toMatch(
      /^\d[\d,]* paid orders? · \d+ pictures? waiting · .+ · Pay at the venue (on|off)/u,
    )
    // Above it, on one line below md: the state chip and the start, in UTC.
    const stateStart = header.querySelector('[data-slot="row-state-start"]')

    expect(stateStart).toHaveClass('md:hidden', 'flex', 'flex-wrap')
    expect(stateStart.querySelector('[data-slot="status-word"]')).toHaveTextContent(
      'State: On sale',
    )
    expect(stateStart.textContent).toBe('State: On sale·Starts Oct 17, 2026, 11:30 PM UTC')
    expect(stateStart.querySelector('time')).toHaveAttribute('datetime', '2026-10-17T23:30:00.000Z')
    expect(stateStart.compareDocumentPosition(summary)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    // The cells those two lines stand for are left out below md, the actions
    // are not, and every row keeps one cell per column.
    const cells = within(first).getAllByRole('cell')

    expect(cells).toHaveLength(EVENT_COLUMNS.length - 1)
    for (const [index, column] of EVENT_COLUMNS.slice(1).entries()) {
      const narrow = [
        'State',
        'Starts (UTC)',
        'Paid orders',
        'Pictures waiting',
        'Booking fee',
        'Pay at the venue',
        'Last changed',
      ]

      if (narrow.includes(column.heading))
        expect(cells[index], column.heading).toHaveClass('max-md:hidden')
      else expect(cells[index], column.heading).not.toHaveClass('max-md:hidden')
    }

    // Below md the actions sit under the summary with no label of their own,
    // on one line, in a row padded p-3 with gap-y-1.
    const actions = cells.at(-1)
    const actionsLabel = actions.querySelector('span[aria-hidden="true"]')

    expect(actionsLabel).toHaveTextContent('Actions')
    expect(actionsLabel).toHaveClass('hidden', 'md:block', 'xl:hidden')
    expect(actions).toHaveClass('col-span-full', 'md:col-span-1')
    expect(actions.querySelector('ul')).toHaveClass('flex-row', 'md:flex-col')
    expect(first).toHaveClass('p-3', 'gap-y-1', 'md:p-4', 'md:gap-y-3')
    // Every other cell keeps its label below xl.
    expect(cells[0].querySelector('span[aria-hidden="true"]')).toHaveClass('block', 'xl:hidden')
  })

  it('says the state as a word with its glyph, and the start as a day over a time', async () => {
    await renderPage()

    const [, first] = within(screen.getByRole('table')).getAllByRole('row')
    // In the State and Starts (UTC) columns, from md.
    const [stateCell, startsCell] = within(first).getAllByRole('cell')
    const state = stateCell.querySelector('[data-slot="status-word"]')
    const starts = startsCell.querySelector('time[datetime="2026-10-17T23:30:00.000Z"]')

    expect(state).toHaveTextContent('State: On sale')
    expect(state.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    expect([...starts.children].map((line) => line.textContent)).toEqual([
      'Oct 17, 2026',
      '11:30 PM UTC',
    ])
  })

  it('opens without an eyebrow, the title and introduction in the page header', async () => {
    await renderPage()

    expect(screen.getByRole('heading', { level: 1, name: 'All events' })).toBeInTheDocument()
    expect(screen.queryByText('Workspace · Platform administration')).not.toBeInTheDocument()
  })
})
