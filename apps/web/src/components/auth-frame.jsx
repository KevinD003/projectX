/**
 * The frame round the sign-in and account pages: the form on a white card, and
 * beside it on a wide screen a purple poster plate that says what an account
 * is for: one line set large, and three true sentences ruled off under it.
 *
 * The panel is not a second form and holds nothing to act on; everything a
 * person needs is in the card, which comes first in the reading order even
 * though the panel is drawn to its left. On a phone the panel is not drawn at
 * all, so the form is the first thing on the screen.
 *
 * @module components/auth-frame
 */

import { BrandLogo } from './brand-logo.jsx'

/** What an account is for, in three true sentences. */
const REASONS = Object.freeze([
  'Your tickets are kept in your account, with an entry pass for each.',
  'Orders and transfers are on your account pages; receipts are not emailed.',
  'Payments on this site are simulated. No card is charged and no money moves.',
])

/**
 * @typedef {object} AuthFrameProps
 * @property {string} headingId The `h1`'s id.
 * @property {string} title The page's heading.
 * @property {ReactNode} lead A sentence under it.
 * @property {ReactNode} children The form and the links below it.
 */

/**
 * The sign-in and account-creation layout.
 *
 * @param {AuthFrameProps} props Component props.
 * @returns {JSX.Element} The layout.
 */
export function AuthFrame({ headingId, title, lead, children }) {
  return (
    <div className="mx-auto grid max-w-content grid-cols-1 gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)] lg:items-stretch lg:gap-12">
      <div className="order-1 lg:order-2">
        <section
          aria-labelledby={headingId}
          className="rounded-card border border-line bg-surface-raised p-6 sm:p-8"
        >
          {/* The D alone, and decorative: the header above already names the
              brand, and the card's heading is what this page is. */}
          <BrandLogo variant="icon" decorative className="h-10 w-auto" />
          <h1 id={headingId} className="mt-5 text-h1 text-ink">
            {title}
          </h1>
          <p className="mt-3 text-ink-muted">{lead}</p>
          <div className="mt-8">{children}</div>
        </section>
      </div>

      <aside
        aria-label="What an account is for"
        className="order-2 hidden rounded-plate bg-surface-inverse p-10 text-ink-inverse lg:order-1 lg:flex lg:flex-col lg:justify-between lg:gap-16 xl:p-12"
      >
        <p className="max-w-[12ch] font-display text-display text-ink-inverse">
          One account for <span className="text-accent-inverse">every night out.</span>
        </p>
        <ul className="border-t border-ink-inverse/20">
          {REASONS.map((reason) => (
            <li
              key={reason}
              className="border-b border-ink-inverse/20 py-3 text-label text-ink-inverse-muted"
            >
              {reason}
            </li>
          ))}
        </ul>
      </aside>
    </div>
  )
}
