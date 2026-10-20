/**
 * The finance overview.
 *
 * Every figure here comes from the API, which derives it from the append-only
 * ledger. Nothing is computed in this file: a screen that did its own
 * arithmetic would be a second opinion about money, and two opinions about
 * money is one too many.
 *
 * ## What is above the numbers, and why
 *
 * Two things, in this order. The mode banner, because a mock-mode figure is not
 * an accounting record. Then the integrity alert, when there is one: a ledger
 * batch whose entries do not add up means the totals below it are built on
 * something that should be impossible, and a footnote under them would be read
 * after somebody had already believed them.
 *
 * ## Zero is money
 *
 * Every amount is printed with `formatAmount`, so a zero reads "$0.00". The
 * shop's `formatPrice` says "Free" for zero, which on a ticket is a gift and
 * in a ledger is nonsense: "Tax payable: Free".
 *
 * ## The organisation picker
 *
 * Links rather than a form, so it works with no JavaScript, is bookmarkable,
 * and announces the current one through `aria-current`. Only organisations the
 * session says the caller belongs to are offered; asking for another one is
 * refused by the API regardless, and offering it would be an invitation to try.
 *
 * @module app/finance/page
 */

import Link from 'next/link'

import { Figure, FigureList, ModeBanner, ScrollableTable } from '../../components/money-figure.jsx'
import { ReadRefusal } from '../../components/read-refusal.jsx'
import { PageHeader, SECONDARY_LINK } from '../../components/workspace-kit.jsx'
import { formatAmount } from '../../lib/pricing.js'
import { getFinanceSummary } from '../../lib/organizer-api.js'
import { readSession, sessionCan } from '../../lib/session.js'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Finance', robots: { index: false, follow: false } }

/**
 * How each activity row reads.
 *
 * @type {ReadonlyArray<{key: string, label: string, hint: string}>}
 */
const ACTIVITY = Object.freeze([
  {
    key: 'refundsRequested',
    label: 'Refunds in flight',
    hint: 'Asked for and still unsettled. Held back from what may be paid out.',
  },
  { key: 'refundsSettled', label: 'Refunds settled', hint: 'Money that has gone back.' },
  {
    key: 'disputes',
    label: 'Disputes',
    hint: 'Claimed back by a buyer. Held until the claim resolves.',
  },
  { key: 'transfers', label: 'Transfers', hint: 'Moved onward to a connected account.' },
  { key: 'payouts', label: 'Payouts', hint: 'Sent to an organiser’s bank.' },
])

/**
 * One amount in a ledger table: right-aligned in tabular figures, a zero
 * printed as money and set in the muted ink.
 *
 * @param {object} props Component props.
 * @param {number} props.cents The amount, in minor units.
 * @param {string} props.currency ISO 4217 code.
 * @param {boolean} [props.strong] Set the figure a weight heavier, for a balance.
 * @param {boolean} [props.last] The row's last cell, which has no gap after it.
 * @returns {JSX.Element} The cell.
 */
export function MoneyCell({ cents, currency, strong = false, last = false }) {
  const tone = cents === 0 ? 'text-ink-muted' : 'text-ink'

  return (
    <td
      className={`text-right whitespace-nowrap tabular-nums ${tone} ${strong ? 'font-semibold' : ''} ${
        last ? '' : 'pr-4'
      }`}
    >
      {formatAmount(cents, currency)}
    </td>
  )
}

/**
 * @typedef {object} FinancePageProps
 * @property {Promise<Record<string, string>>} searchParams The resolved query string.
 */

/**
 * The overview.
 *
 * @param {FinancePageProps} props Route props.
 * @returns {Promise<JSX.Element>} The rendered page.
 */
export default async function FinancePage({ searchParams }) {
  const query = await searchParams
  const session = await readSession()

  // Only what the session already says this caller belongs to. The API refuses
  // anything else anyway; offering it would be an invitation to try.
  const organizations = (session?.memberships ?? [])
    .filter((membership) => sessionCan(session, 'finance:view', membership.organizationId))
    .map((membership) => ({
      id: membership.organizationId,
      name: membership.organizationName ?? membership.organizationId,
    }))

  const requested = query?.organizationId
  const chosen = organizations.find((organization) => organization.id === requested)
  const organizationId = chosen?.id ?? organizations[0]?.id

  let summary = null
  let failure = null

  try {
    summary = await getFinanceSummary({ organizationId, currency: 'USD' })
  } catch (error) {
    // Drawn by `ReadRefusal`: a lapsed FINANCE_VIEW window is a step-up away,
    // not a failure, and the API's own words name an endpoint.
    failure = error
  }

  const exportHref = `/api/v1/finance/export.csv${organizationId ? `?organizationId=${organizationId}` : ''}`

  return (
    <div>
      <PageHeader
        title="Finance"
        description="Read from the ledger, which is only ever added to. An order total is written once at checkout and never corrected, and nothing on this page reads one."
        actions={
          summary ? (
            <a href={exportHref} className={SECONDARY_LINK} download>
              Download as a spreadsheet
            </a>
          ) : null
        }
      />

      {organizations.length > 1 ? (
        <nav aria-label="Choose an organisation" className="mt-6">
          <ul className="flex flex-wrap gap-2">
            {organizations.map((organization) => {
              const current = organization.id === organizationId

              return (
                <li key={organization.id}>
                  <Link
                    href={`/finance?organizationId=${organization.id}`}
                    aria-current={current ? 'page' : undefined}
                    className={`inline-flex min-h-11 items-center rounded-full px-4 text-sm transition-colors duration-(--duration-fast) focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-focus ${
                      current
                        ? 'bg-action-primary font-semibold text-action-primary-ink shadow-control'
                        : 'border border-line bg-surface-raised font-medium text-ink-muted hover:bg-surface-subtle hover:text-ink'
                    }`}
                  >
                    {organization.name}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
      ) : null}

      {failure ? (
        <ReadRefusal
          error={failure}
          what="The finance view"
          action="see this organisation’s finances"
        />
      ) : null}

      {summary ? (
        <>
          <ModeBanner mode={summary.mode} notice={summary.modeNotice} />

          {summary.integrity.imbalances.length > 0 ? (
            <section
              aria-labelledby="integrity-heading"
              className="mt-4 rounded-card border border-status-danger/25 bg-status-danger-soft p-4"
            >
              <h2 id="integrity-heading" className="font-semibold text-status-danger">
                {summary.integrity.imbalances.length} ledger{' '}
                {summary.integrity.imbalances.length === 1 ? 'batch does' : 'batches do'} not add up
              </h2>
              <p className="mt-1 text-sm text-status-danger">
                Every batch is balanced by a database check when it posts, so this should be
                impossible. Until somebody has looked, the figures below are built on something that
                should not exist.
              </p>
              <ul className="mt-3 space-y-1 text-sm text-status-danger">
                {summary.integrity.imbalances.map((imbalance) => (
                  <li key={imbalance.batchId}>
                    <span className="font-mono">{imbalance.reference}</span>: {imbalance.problem}.
                    Its entries total{' '}
                    <span className="tabular-nums">
                      {formatAmount(imbalance.actualDebitCents, summary.currency)}
                    </span>{' '}
                    debit against{' '}
                    <span className="tabular-nums">
                      {formatAmount(imbalance.actualCreditCents, summary.currency)}
                    </span>{' '}
                    credit.
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section aria-labelledby="totals-heading" className="mt-8">
            <h2 id="totals-heading" className="text-h3 font-semibold text-ink">
              Totals
            </h2>
            <FigureList>
              <Figure
                plain
                label="Gross collected"
                cents={summary.totals.grossCollectedCents}
                currency={summary.currency}
                hint="What buyers handed over, before anything went back."
              />
              <Figure
                plain
                label="Ticket face value"
                cents={summary.totals.faceValueCents}
                currency={summary.currency}
              />
              <Figure
                plain
                label="Discounts given"
                cents={summary.totals.discountCents}
                currency={summary.currency}
                hint="Contra-revenue: a discount reduces what was earned rather than costing anything."
              />
              <Figure
                plain
                label="Tax payable"
                cents={summary.totals.taxPayableCents}
                currency={summary.currency}
                hint="Collected on an authority’s behalf. Never revenue."
              />
              <Figure
                plain
                label="Platform fee revenue"
                cents={summary.totals.platformFeeRevenueCents}
                currency={summary.currency}
              />
              <Figure
                plain
                label="Owed to organisers"
                cents={summary.totals.organizerPayableCents}
                currency={summary.currency}
                hint="A liability. The buyer’s money is not the platform’s revenue."
              />
            </FigureList>
          </section>

          <section aria-labelledby="accounts-heading" className="mt-10">
            <h2 id="accounts-heading" className="text-h3 font-semibold text-ink">
              Clearing accounts
            </h2>
            <ScrollableTable label="Clearing accounts">
              <table className="w-full min-w-[20rem] border-collapse text-sm">
                <caption className="sr-only">
                  Each account’s debits, credits and balance over the window
                </caption>
                <thead>
                  <tr className="border-b border-line-strong text-left">
                    <th scope="col" className="pr-4 font-semibold text-ink">
                      Account
                    </th>
                    <th scope="col" className="w-24 pr-4 text-right font-semibold text-ink sm:w-36">
                      Debits
                    </th>
                    <th scope="col" className="w-24 pr-4 text-right font-semibold text-ink sm:w-36">
                      Credits
                    </th>
                    <th scope="col" className="w-24 text-right font-semibold text-ink sm:w-36">
                      Balance
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {summary.accounts.map((account) => (
                    <tr key={account.code} className="border-b border-line">
                      <th scope="row" className="pr-4 text-left font-normal text-ink">
                        {account.label}
                      </th>
                      <MoneyCell cents={account.debitCents} currency={summary.currency} />
                      <MoneyCell cents={account.creditCents} currency={summary.currency} />
                      <MoneyCell
                        cents={account.balanceCents}
                        currency={summary.currency}
                        strong
                        last
                      />
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollableTable>
          </section>

          <section aria-labelledby="activity-heading" className="mt-10">
            <h2 id="activity-heading" className="text-h3 font-semibold text-ink">
              Activity
            </h2>
            <ScrollableTable label="Activity">
              <table className="w-full min-w-[20rem] border-collapse text-sm">
                <caption className="sr-only">
                  How many of each movement there were, and how much they came to
                </caption>
                <thead>
                  <tr className="border-b border-line-strong text-left">
                    <th scope="col" className="pr-4 font-semibold text-ink">
                      Movement
                    </th>
                    <th scope="col" className="w-20 pr-4 text-right font-semibold text-ink sm:w-28">
                      How many
                    </th>
                    <th scope="col" className="w-24 text-right font-semibold text-ink sm:w-36">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ACTIVITY.map((row) => {
                    const { count, amountCents } = summary.activity[row.key]

                    return (
                      <tr key={row.key} className="border-b border-line align-top">
                        <th scope="row" className="pr-4 text-left font-normal text-ink">
                          <span className="block font-medium">{row.label}</span>
                          <span className="mt-0.5 block text-xs text-ink-muted">{row.hint}</span>
                        </th>
                        <td
                          className={`pr-4 text-right tabular-nums ${count === 0 ? 'text-ink-muted' : 'text-ink'}`}
                        >
                          {count.toLocaleString('en-US')}
                        </td>
                        <MoneyCell cents={amountCents} currency={summary.currency} last />
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </ScrollableTable>
          </section>

          <p className="mt-6 max-w-3xl text-xs text-ink-muted">
            The spreadsheet carries no buyer, no address and nothing about how anybody paid, and its
            first row says which mode produced the figures.
          </p>
        </>
      ) : null}
    </div>
  )
}
