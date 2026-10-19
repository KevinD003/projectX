/**
 * The booking, once the order has been placed.
 *
 * A polite status, not an assertive alert: it replaces the form the buyer just
 * pressed, and nothing about it is urgent. Shared by both checkouts.
 *
 * A booking to pay at the venue is booked, not paid (SPEC3 §12.1, SPEC3-XI
 * §12.1): its heading says so, it names what is paid at the door, what was paid
 * online (the booking fee, simulated) or that nothing was, and that unpaid
 * tickets can be cancelled by the organiser or The Desi Events until they are
 * paid for. It never reads "Paid".
 *
 * @module components/booked-order
 */

import Link from 'next/link'

import { formatAmount } from '../lib/pricing.js'
import { TicketObject } from './ticket-object.jsx'
import { Icon } from '@desi-event/ui/icons'
import { OUTLINE_LINK, PRIMARY_LINK } from './link-classes.js'

/** What a booking to pay at the venue says about the door, once booked. */
export const AT_THE_DOOR_SENTENCE =
  'Show your tickets at the door. The steward takes the payment before letting you in.'

/**
 * What a booking to pay at the venue says about cancelling unpaid tickets
 * (SPEC3-XI §12.1): the booking fee is not refunded if they are cancelled, or,
 * when a referral code removed it, nothing was paid online for them.
 *
 * @param {boolean} waived Whether a referral code removed the booking fee.
 * @returns {string} The sentence.
 */
export function unpaidCancellationSentence(waived) {
  return waived
    ? 'Until you pay at the door, the organiser or The Desi Events can cancel unpaid tickets, and nothing was paid online for them.'
    : 'Until you pay at the door, the organiser or The Desi Events can cancel unpaid tickets, and the booking fee is not refunded if they do.'
}

/**
 * The confirmation.
 *
 * @param {object} props Component props.
 * @param {object} props.order The order as the API returned it.
 * @param {object} [props.event] The event, for its title.
 * @param {boolean} [props.named] Whether the buyer gave any ticket a name.
 * @param {number|null} [props.venueDueCents] What the quote said is paid at the door, when the order does not say.
 * @returns {JSX.Element} The confirmation.
 */
export function BookedOrder({ order, event = null, named = false, venueDueCents = null }) {
  const tickets = (order.tickets ?? []).length
  const atVenue = order.paymentMethod === 'AT_VENUE'
  const due = order.venuePayment?.dueCents ?? venueDueCents ?? 0
  const waived = Boolean(order.referralApplied) || (order.feeWaivedCents ?? 0) > 0
  const online = order.totalCents ?? 0

  return (
    // The booking arrives as a ticket: the face says what was booked, the
    // stub where the tickets are. It is uncovered once from the top
    // (`ticket-reveal`, only without a reduced-motion setting); nothing
    // about it is urgent, so the status is polite.
    <section aria-labelledby="booked-heading" role="status" className="ticket-reveal">
      <TicketObject
        as="div"
        stubClassName="md:w-80"
        face={
          <>
            <h2
              id="booked-heading"
              className="flex items-start gap-3 font-display text-h1 font-bold text-balance text-ticket-ink"
            >
              <Icon name="check-circle" className="mt-[0.15em] size-[0.8em] text-status-success" />
              <span>{atVenue ? 'Booked — pay at the door' : 'Booked'}</span>
            </h2>
            {event?.title ? (
              <p className="mt-2 text-label font-semibold text-ticket-ink">{event.title}</p>
            ) : null}
            {atVenue ? (
              <p className="mt-4 font-semibold text-ticket-ink">
                Booked. Pay {formatAmount(due, order.currency)} at the door.
              </p>
            ) : null}
            <p className="mt-4 text-ticket-ink tabular-nums">
              Order <span className="font-mono font-semibold tracking-wide">{order.reference}</span>
              {tickets > 0 ? ` · ${tickets} ${tickets === 1 ? 'ticket' : 'tickets'}` : ''} ·{' '}
              {atVenue
                ? online > 0
                  ? `Paid online (simulated) ${formatAmount(online, order.currency)}`
                  : 'Nothing paid online'
                : formatAmount(order.totalCents, order.currency)}
            </p>
            {order.discountCents > 0 ? (
              <p className="mt-1 text-sm text-ink-muted">
                Including a discount of {formatAmount(order.discountCents, order.currency)}.
              </p>
            ) : null}
            {named ? (
              <p className="mt-1 text-sm text-ink-muted">
                Each ticket carries the name you gave it; a ticket you left blank carries yours.
              </p>
            ) : null}
            {atVenue ? (
              <>
                <p className="mt-3 max-w-prose text-sm text-ticket-ink">{AT_THE_DOOR_SENTENCE}</p>
                <p className="mt-2 max-w-prose text-sm text-ink-muted">
                  {unpaidCancellationSentence(waived)}
                </p>
                <p className="mt-2 max-w-prose text-sm text-ink-muted">
                  {online > 0
                    ? 'The booking fee payment was simulated: no card was asked for and no money moved. The tickets are in your account now.'
                    : 'The tickets are in your account now.'}
                </p>
              </>
            ) : (
              <p className="mt-3 max-w-prose text-sm text-ink-muted">
                The payment was simulated: no card was asked for and no money moved. The tickets are
                in your account now.
              </p>
            )}
          </>
        }
        stub={
          <div className="flex h-full flex-col gap-3 pt-2 md:justify-end md:pt-0 md:pl-2">
            <p className="text-caption text-ink-muted">
              Each ticket has its own pass, shown from its page in your tickets.
            </p>
            <Link href="/tickets" transitionTypes={['nav-forward']} className={PRIMARY_LINK}>
              Your tickets
            </Link>
            <Link
              href={`/account/orders/${encodeURIComponent(order.reference)}`}
              transitionTypes={['nav-forward']}
              className={OUTLINE_LINK}
            >
              This order
            </Link>
          </div>
        }
      />
    </section>
  )
}
