/**
 * The review queue is one ruled list, oldest first, each event's place in
 * the queue beside it and its state as a word with a glyph.
 *
 * @module app/moderation/events/page.test
 */

import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../lib/organizer-api.js', () => ({ getModerationQueue: vi.fn() }))

const { getModerationQueue } = await import('../../../lib/organizer-api.js')
const { default: ModerationQueuePage } = await import('./page.jsx')

/**
 * One event in the queue.
 *
 * @param {number} n Its number.
 * @returns {object} The event.
 */
function queued(n) {
  return {
    id: `cevent000000000000000000${n}`,
    title: `Raas Night ${n}`,
    slug: `raas-night-${n}`,
    status: 'REVIEW_PENDING',
    startsAt: '2026-10-23T23:30:00.000Z',
    timezone: 'America/Chicago',
    city: 'Plano',
    organizationName: 'Mirrorwork Events',
  }
}

/**
 * Render the queue for a query.
 *
 * @param {object} [query] The search parameters.
 * @returns {Promise<void>} Once rendered.
 */
async function renderPage(query = {}) {
  render(await ModerationQueuePage({ searchParams: Promise.resolve(query) }))
}

beforeEach(() => {
  vi.clearAllMocks()
  getModerationQueue.mockResolvedValue({ events: [queued(1), queued(2)], pagination: null })
})

describe('Review queue', () => {
  it('lists the events oldest first in one ordered list, each title linking to its review', async () => {
    await renderPage()

    const list = screen.getByRole('list', { name: 'Events, oldest submission first' })
    const items = within(list).getAllByRole('listitem')

    expect(list.tagName).toBe('OL')
    expect(list).toHaveClass('divide-y', 'rounded-card')
    expect(items).toHaveLength(2)
    expect(within(items[0]).getByRole('link', { name: 'Raas Night 1' })).toHaveAttribute(
      'href',
      '/moderation/events/cevent0000000000000000001',
    )
    expect(items[1]).toHaveTextContent('2')
  })

  it('says each state as a word with its glyph', async () => {
    await renderPage()

    const [first] = within(
      screen.getByRole('list', { name: 'Events, oldest submission first' }),
    ).getAllByRole('listitem')
    const state = first.querySelector('[data-slot="status-word"]')

    expect(state).toHaveTextContent('State: Waiting for review')
    expect(state.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it('filters by state with links, the current one marked', async () => {
    await renderPage({ status: 'APPROVED' })

    const filters = screen.getByRole('navigation', { name: 'Filter by state' })

    expect(within(filters).getByRole('link', { name: 'Approved' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(getModerationQueue).toHaveBeenCalledWith({ status: 'APPROVED' })
    expect(screen.getByRole('heading', { level: 1, name: 'Review queue' })).toBeInTheDocument()
  })

  it('says plainly when nothing is in the chosen state', async () => {
    getModerationQueue.mockResolvedValue({ events: [], pagination: null })

    await renderPage()

    expect(screen.getByText('Nothing waiting')).toBeInTheDocument()
  })
})
