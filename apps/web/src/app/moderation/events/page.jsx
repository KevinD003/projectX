/**
 * The review queue.
 *
 * Oldest submission first, and that is the whole ordering policy: an organiser
 * who submitted on Monday should not still be waiting because somebody more
 * recent looked more interesting. The server sorts it; this renders it.
 *
 * The filter is over the states a moderator actually works in. It is a set of
 * links rather than a form, so it works with no JavaScript, is bookmarkable,
 * and a screen reader announces the current one through `aria-current`.
 *
 * @module app/moderation/events/page
 */

import Link from 'next/link'

import { FilterLinks, StatusWord } from '../../../components/admin-kit.jsx'
import { ReadRefusal } from '../../../components/read-refusal.jsx'
import { EmptyState } from '../../../components/ui.jsx'
import { PageHeader, PosterThumb, TEXT_LINK } from '../../../components/workspace-kit.jsx'
import { getModerationQueue } from '../../../lib/organizer-api.js'
import { statusReading } from '../../../lib/event-status.js'
import { formatEventDate } from '../../../lib/format.js'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Review queue', robots: { index: false, follow: false } }

/**
 * The states a moderator filters by, and how each reads.
 *
 * @type {ReadonlyArray<{value: string|null, label: string}>}
 */
const FILTERS = Object.freeze([
  { value: null, label: 'Waiting for review' },
  { value: 'CHANGES_REQUIRED', label: 'Changes requested' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
])

/**
 * @typedef {object} ModerationQueuePageProps
 * @property {Promise<Record<string, string>>} searchParams The resolved query string.
 */

/**
 * The queue.
 *
 * @param {ModerationQueuePageProps} props Route props.
 * @returns {Promise<JSX.Element>} The rendered page.
 */
export default async function ModerationQueuePage({ searchParams }) {
  const query = await searchParams
  const status = FILTERS.some((filter) => filter.value === query?.status) ? query.status : undefined

  let events = []
  let failure = null

  try {
    const result = await getModerationQueue({ status })
    events = result.events
  } catch (error) {
    failure = error
  }

  return (
    <div>
      <PageHeader
        title="Review queue"
        description="Oldest submission first. Somebody who submitted on Monday should not still be waiting because a Thursday listing looked more interesting."
      />

      <FilterLinks
        label="Filter by state"
        className="mt-6"
        items={FILTERS.map((filter) => ({
          label: filter.label,
          href: filter.value ? `/moderation/events?status=${filter.value}` : '/moderation/events',
          current: (status ?? null) === filter.value,
        }))}
      />

      {failure ? (
        <ReadRefusal error={failure} what="The review queue" action="see the review queue" />
      ) : null}

      {!failure && events.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="Nothing waiting"
            description="No event is in this state. Organisers submit for review from their own editor."
          />
        </div>
      ) : null}

      {events.length > 0 ? (
        <ol
          aria-label="Events, oldest submission first"
          className="mt-6 divide-y divide-line overflow-hidden rounded-card border border-line bg-surface-raised shadow-card"
        >
          {events.map((event, index) => {
            const reading = statusReading(event.status)

            return (
              <li
                key={event.id}
                className="flex items-stretch gap-4 py-3 pr-4 pl-3 focus-within:outline-2 focus-within:-outline-offset-2 focus-within:outline-focus sm:pl-4"
              >
                {/* Its place in the queue: oldest first, so the first is the
                    one that has waited longest. */}
                <span
                  aria-hidden="true"
                  className="w-6 shrink-0 pt-0.5 text-right text-sm text-ink-subtle tabular-nums"
                >
                  {index + 1}
                </span>
                <PosterThumb event={event} className="hidden w-20 rounded-plate sm:block" />
                <div className="flex min-w-0 flex-1 flex-wrap items-start justify-between gap-x-4 gap-y-2">
                  <div className="min-w-0">
                    <h2 className="text-title font-semibold text-ink">
                      <Link href={`/moderation/events/${event.id}`} className={TEXT_LINK}>
                        {event.title}
                      </Link>
                    </h2>
                    <p className="mt-0.5 text-sm text-ink-muted">
                      {event.organizationName ?? 'Unnamed organisation'} ·{' '}
                      {formatEventDate(event.startsAt, event.timezone)}
                      {event.city ? ` · ${event.city}` : ''}
                    </p>
                  </div>

                  <StatusWord tone={reading.tone} srLabel="State:">
                    {reading.label}
                  </StatusWord>
                </div>
              </li>
            )
          })}
        </ol>
      ) : null}
    </div>
  )
}
