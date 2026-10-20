/**
 * The finance overview prints money as money, says what produced it first,
 * and sets the ledger as tables a person can read down.
 *
 * The properties worth pinning:
 *
 *   - **A zero is "$0.00"**, never "Free". The shop's formatter calls a zero
 *     price free, which in a ledger turns "Tax payable" into a claim about
 *     tax. Found in the visual audit: every empty line of the finance screen
 *     read "Free".
 *   - **The mode banner comes before any figure.**
 *   - **The totals are one ruled statement**, the clearing accounts and the
 *     activity each a captioned table with right-aligned, tabular amounts.
 *   - **The export is offered beside the title**, as a link to the API's CSV.
 *
 * @module app/finance/page.test
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

  return { ...actual, getFinanceSummary: vi.fn() }
})

const { getFinanceSummary } = await import('../../lib/organizer-api.js')
const { default: FinancePage, MoneyCell } = await import('./page.jsx')

/** The organisation. */
const ORG = 'org00000000000000000001'

/**
 * A finance member of one organisation.
 *
 * @returns {object} The session.
 */
function finance() {
  return {
    user: {},
    capabilities: [],
    memberships: [
      {
        organizationId: ORG,
        organizationName: 'Mirrorwork Events',
        role: 'FINANCE',
        capabilities: ['finance:view'],
      },
    ],
  }
}

/** A movement with nothing in it. */
const NONE = { count: 0, amountCents: 0 }

/**
 * A summary like the seeded one: one order, no tax, no discount.
 *
 * @param {object} [overrides] Fields to replace.
 * @returns {object} The API's summary.
 */
function summary(overrides = {}) {
  return {
    mode: 'MOCK',
    modeNotice: 'No money moved.',
    currency: 'USD',
    integrity: { imbalances: [] },
    totals: {
      grossCollectedCents: 4865,
      faceValueCents: 4500,
      discountCents: 0,
      taxPayableCents: 0,
      platformFeeRevenueCents: 365,
      organizerPayableCents: 4500,
    },
    accounts: [
      {
        code: 'PROCESSOR',
        label: 'Held by the processor',
        debitCents: 4865,
        creditCents: 0,
        balanceCents: 4865,
      },
      { code: 'TAX', label: 'Tax payable', debitCents: 0, creditCents: 0, balanceCents: 0 },
    ],
    activity: {
      refundsRequested: NONE,
      refundsSettled: { count: 2, amountCents: 9730 },
      disputes: NONE,
      transfers: NONE,
      payouts: NONE,
    },
    ...overrides,
  }
}

/**
 * Render the page.
 *
 * @returns {Promise<void>} Once rendered.
 */
async function renderPage() {
  render(await FinancePage({ searchParams: Promise.resolve({}) }))
}

beforeEach(() => {
  vi.clearAllMocks()
  readSession.mockResolvedValue(finance())
  getFinanceSummary.mockResolvedValue(summary())
})

describe('Finance', () => {
  it('never calls a zero amount "Free"', async () => {
    await renderPage()

    expect(screen.queryByText('Free')).not.toBeInTheDocument()

    const totals = screen.getByRole('region', { name: 'Totals' })
    const tax = within(totals).getByText('Tax payable').closest('div')

    expect(tax).toHaveTextContent('Tax payable$0.00')
    expect(within(totals).getByText('$48.65')).toBeInTheDocument()
  })

  it('says what produced the figures before the totals', async () => {
    await renderPage()

    const banner = screen.getByRole('status')
    const totals = screen.getByRole('heading', { name: 'Totals', level: 2 })

    expect(banner).toHaveTextContent('Demonstration data: No money moved.')
    // In the reading order, the banner comes first.
    expect(banner.compareDocumentPosition(totals) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('sets the totals as one ruled statement, not a grid of cards', async () => {
    await renderPage()

    const totals = screen.getByRole('region', { name: 'Totals' })
    const list = totals.querySelector('dl')

    expect(list).toHaveAttribute('data-slot', 'figure-list')
    expect(within(list).getAllByRole('term')).toHaveLength(6)
  })

  it('lays the clearing accounts out as a table with right-aligned tabular amounts', async () => {
    await renderPage()

    const table = screen.getByRole('table', {
      name: 'Each account’s debits, credits and balance over the window',
    })
    const row = within(table).getByRole('rowheader', { name: 'Tax payable' }).closest('tr')
    const cells = within(row).getAllByRole('cell')

    expect(cells.map((cell) => cell.textContent)).toEqual(['$0.00', '$0.00', '$0.00'])
    for (const cell of cells) expect(cell).toHaveClass('text-right', 'tabular-nums')
  })

  it('counts and sums each movement in one table, zeros included', async () => {
    await renderPage()

    const table = screen.getByRole('table', {
      name: 'How many of each movement there were, and how much they came to',
    })
    const settled = within(table)
      .getByRole('rowheader', { name: /Refunds settled/u })
      .closest('tr')
    const disputes = within(table)
      .getByRole('rowheader', { name: /Disputes/u })
      .closest('tr')

    expect(
      within(settled)
        .getAllByRole('cell')
        .map((cell) => cell.textContent),
    ).toEqual(['2', '$97.30'])
    expect(
      within(disputes)
        .getAllByRole('cell')
        .map((cell) => cell.textContent),
    ).toEqual(['0', '$0.00'])
  })

  it('offers the export beside the title, for the organisation on screen', async () => {
    await renderPage()

    const link = screen.getByRole('link', { name: 'Download as a spreadsheet' })

    expect(link).toHaveAttribute('href', `/api/v1/finance/export.csv?organizationId=${ORG}`)
    expect(link).toHaveAttribute('download')
    expect(screen.getByRole('heading', { level: 1, name: 'Finance' })).toBeInTheDocument()
    expect(screen.queryByText('Workspace · Money')).not.toBeInTheDocument()
  })

  it('names a batch that does not add up, in money, with no dash for punctuation', async () => {
    getFinanceSummary.mockResolvedValue(
      summary({
        integrity: {
          imbalances: [
            {
              batchId: 'b1',
              reference: 'DE-US-200016',
              problem: 'debits and credits differ',
              actualDebitCents: 100,
              actualCreditCents: 0,
            },
          ],
        },
      }),
    )

    await renderPage()

    const alert = screen.getByRole('region', { name: '1 ledger batch does not add up' })

    expect(alert).toHaveTextContent(
      'DE-US-200016: debits and credits differ. Its entries total $1.00 debit against $0.00 credit.',
    )
    expect(alert.textContent).not.toMatch(/—/u)
  })
})

describe('MoneyCell', () => {
  it('mutes a zero and keeps every other amount in the ink', () => {
    render(
      <table>
        <tbody>
          <tr>
            <MoneyCell cents={0} currency="USD" />
            <MoneyCell cents={1234} currency="CAD" strong last />
          </tr>
        </tbody>
      </table>,
    )

    const [zero, amount] = screen.getAllByRole('cell')

    expect(zero).toHaveTextContent('$0.00')
    expect(zero).toHaveClass('text-ink-muted', 'pr-4')
    expect(amount).toHaveTextContent('CA$12.34')
    expect(amount).toHaveClass('text-ink', 'font-semibold')
    expect(amount).not.toHaveClass('pr-4')
  })
})
