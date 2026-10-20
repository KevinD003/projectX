/**
 * A night's date as a ledger prints it in its margin: the day of the month in
 * large figures over the month, in the venue's zone. The orders and transfers
 * lists use it where they once repeated the event's poster beside every row.
 *
 * The row's own "When" says the same in words, so this is hidden from
 * assistive technology rather than read twice. Below `sm` it is not drawn at
 * all; the row's facts carry the date there.
 *
 * @module components/ledger-date
 */

import { stubDate } from '../lib/wallet.js'

/**
 * The margin date.
 *
 * @param {object} props Component props.
 * @param {string|null|undefined} props.startsAt When the night starts.
 * @param {string|null|undefined} [props.timeZone] The venue's IANA zone.
 * @returns {JSX.Element} The date, or an empty margin when there is none to print.
 */
export function LedgerDate({ startsAt, timeZone }) {
  const date = stubDate(startsAt, timeZone || 'UTC')

  return (
    <p
      aria-hidden="true"
      data-slot="ledger-date"
      className="hidden w-16 shrink-0 flex-col items-start font-display leading-none text-ink sm:flex"
    >
      {date ? (
        <>
          <span className="text-h2 leading-[0.9] font-bold tabular-nums">{date.day}</span>
          <span className="mt-1 text-label font-bold uppercase">{date.month}</span>
        </>
      ) : null}
    </p>
  )
}

/** Classes for one row of a ledger list: the margin date, then the row's body. */
export const LEDGER_ROW = 'flex gap-6 border-b border-line py-6'
