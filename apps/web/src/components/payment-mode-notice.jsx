/**
 * What the buyer is told before they choose a quantity.
 *
 * The Desi Events has no payment integration. Checkout runs against an
 * in-memory provider that authorises, captures and refunds nothing, which is a
 * perfectly honest way to demonstrate a ticketing flow and a dishonest way to
 * present one. So the notice is rendered on every visit to a checkout, at the
 * head of the order summary, until the order is booked: not behind a toggle,
 * not only after a failure, and not only for developers.
 *
 * There is no payment-method selector anywhere on this page, because there is
 * no second method to select. Nothing a browser can send changes which provider
 * runs; see `packages/providers/src/payment-mode.js`.
 *
 * @module components/payment-mode-notice
 */

// The `./payments` subpath, not the barrel. Two strings from the barrel pull
// `entities.js` in behind them, and with it the *shape* of every private
// column — `Organization.contactEmail`, `Organization.payoutCurrency`. The
// values never reached a browser; the schema describing them did, in every
// bundle, since before this component existed. The browser-bundle scan now
// looks for exactly that, which is how it was found.
//
// Neither string is imported any more. PRODUCTION_PAYMENTS_DISABLED_MESSAGE is
// the deployment's and the operator's wording — "Phase 2 integration required"
// is a project milestone, not something a buyer can act on — and the notice
// used to promise that every order, receipt and ticket is "marked DEMO", when
// the pages a buyer then sees say "simulated" and never DEMO. The buyer is told
// what is true in the words the rest of the site uses.

import { Icon } from '@desi-event/ui/icons'

/**
 * The demonstration-payments notice: the one place on a checkout screen that
 * says payments are simulated.
 *
 * Said once, plainly, beside the money: it heads the order summary, so it is
 * read with the total and before the buyer reserves or pays. A shield on a
 * gold disc and the words on the quiet ground; no stripe, no alarm colour,
 * because a standing fact is not a warning. The text is ink, measured on that
 * ground; the colour carries nothing the words do not. The held notice, the
 * pay button and the confirmation do not repeat it as a notice.
 *
 * @returns {JSX.Element} The rendered notice.
 */
export function PaymentModeNotice() {
  return (
    <aside
      data-testid="payment-mode-notice"
      aria-labelledby="payment-mode-heading"
      className="flex items-start gap-3 rounded-control bg-surface-subtle p-4 text-ink"
    >
      <span
        aria-hidden="true"
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-highlight text-highlight-ink"
      >
        <Icon name="shield" className="size-4.5" />
      </span>
      <div className="min-w-0">
        <p id="payment-mode-heading" className="text-label font-bold text-ink">
          Payments on this site are simulated
        </p>
        <p className="mt-1 text-caption text-ink">
          Checkout uses a simulated payment provider. You will not be asked for a card, no money
          moves, and your order and tickets say the payment was simulated. A ticket issued here is a
          demonstration, not a ticket to a real event.
        </p>
      </div>
    </aside>
  )
}
