/**
 * The operations board says what the machine could not finish, queue by
 * queue, and is calm when there is nothing.
 *
 * The properties worth pinning:
 *
 *   - **Each queue heads itself with its count and a status word**: "Clear"
 *     when it is empty, "N waiting" when it is not, so a glance down the
 *     page reads the state without reading the lists.
 *   - **An empty queue is one quiet line**, the human sentence kept, with a
 *     success glyph, not a dashed box the height of a card.
 *   - **A stuck item's state is a word with a glyph**, sentence case, never a
 *     raw enum or a lower-cased one.
 *   - **No figure for a queue that was not read**: the count tiles that
 *     repeated the headings are gone, so nothing shows a zero nobody counted.
 *
 * @module app/operations/page.test
 */

import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const readSession = vi.fn()

vi.mock('../../lib/session.js', async () => {
  const actual = await vi.importActual('../../lib/session.js')

  return { ...actual, readSession: (...args) => readSession(...args) }
})
vi.mock('../../lib/organizer-api.js', async () => {
  const actual = await vi.importActual('../../lib/organizer-api.js')

  return {
    ...actual,
    getReconciliationQueue: vi.fn(),
    getNotificationQueue: vi.fn(),
    getRefundQueue: vi.fn(),
  }
})

const { getNotificationQueue, getReconciliationQueue, getRefundQueue } =
  await import('../../lib/organizer-api.js')
const { default: OperationsPage, sentenceCase } = await import('./page.jsx')

/** A platform reader with no organisation of their own. */
const PLATFORM = {
  user: {},
  capabilities: ['reconciliation:manage'],
  memberships: [],
}

/**
 * Render the board.
 *
 * @returns {Promise<void>} Once rendered.
 */
async function renderPage() {
  render(await OperationsPage())
}

beforeEach(() => {
  vi.clearAllMocks()
  readSession.mockResolvedValue(PLATFORM)
  getReconciliationQueue.mockResolvedValue({ tasks: [], pagination: null })
  getNotificationQueue.mockResolvedValue({ messages: [], pagination: null })
  getRefundQueue.mockResolvedValue({ refunds: [], pagination: null })
})

describe('Operations', () => {
  it('opens on its title, with no eyebrow and no dash for punctuation', async () => {
    await renderPage()

    expect(screen.getByRole('heading', { level: 1, name: 'Operations' })).toBeInTheDocument()
    expect(
      screen.getByText(
        'What the machine could not finish on its own. Nothing is done from this page: each item links to where the work is done, behind its own second factor.',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByText(/Workspace ·/u)).toBeNull()
  })

  it('says an empty queue in one line, and heads it "Clear"', async () => {
    await renderPage()

    const reconciliation = screen.getByRole('region', { name: /^Payment reconciliation/u })

    expect(within(reconciliation).getByRole('heading', { level: 2 })).toHaveTextContent(
      'Payment reconciliation (0)',
    )
    expect(reconciliation.querySelector('[data-slot="status-word"]')).toHaveTextContent('Clear')
    expect(reconciliation.querySelector('[data-slot="all-clear"]')).toHaveTextContent(
      'Nothing unresolved. Every payment this system has taken agrees with what the provider says about it.',
    )
  })

  it('heads a queue with something in it "N waiting", and says each item’s state in words', async () => {
    getNotificationQueue.mockResolvedValue({
      messages: [
        {
          id: 'm1',
          template: 'order-confirmation',
          status: 'DEAD_LETTER',
          attempts: 5,
          maxAttempts: 5,
          lastError: 'mailbox Hidden email refused the message',
        },
        { id: 'm2', template: 'ticket-transfer', status: 'SENT', attempts: 1, maxAttempts: 5 },
      ],
      pagination: null,
    })

    await renderPage()

    const stuck = screen.getByRole('region', { name: /^Notifications that did not go/u })
    const [heading, item] = stuck.querySelectorAll('[data-slot="status-word"]')

    expect(heading).toHaveTextContent('1 waiting')
    expect(heading).toHaveAttribute('data-tone', 'warning')
    expect(item).toHaveTextContent('Dead letter · 5 of 5')
    expect(item).toHaveAttribute('data-tone', 'danger')
    expect(stuck).not.toHaveTextContent('ticket-transfer')
  })

  it('shows no figure for a queue it could not read', async () => {
    getReconciliationQueue.mockRejectedValue(
      Object.assign(new Error('Nope'), { status: 500, code: 'INTERNAL' }),
    )

    await renderPage()

    const reconciliation = screen.getByRole('region', { name: /^Payment reconciliation/u })

    expect(within(reconciliation).getByRole('heading', { level: 2 })).toHaveTextContent(
      /^Payment reconciliation$/u,
    )
    expect(reconciliation.querySelector('[data-slot="status-word"]')).toBeNull()
    expect(screen.queryByRole('term')).toBeNull()
  })
})

describe('sentenceCase', () => {
  it('reads an enum value as words with a capital first', () => {
    expect(sentenceCase('DEAD_LETTER')).toBe('Dead letter')
    expect(sentenceCase('RECONCILIATION_REQUIRED')).toBe('Reconciliation required')
    expect(sentenceCase(undefined)).toBe('')
  })
})
