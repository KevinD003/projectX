/**
 * The organiser's venues.
 *
 * Shows what this person may actually author, which is not the same as what
 * they can list an event at. A shared venue appears in event creation and not
 * here, because a hall a hundred organisers use is not one of them to edit —
 * and a list that mixed the two would teach people otherwise.
 *
 * @module app/organizer/venues/page
 */

import Link from 'next/link'

import { ReadRefusal } from '../../../components/read-refusal.jsx'
import { Badge, EmptyState } from '../../../components/ui.jsx'
import { PRIMARY_LINK, TEXT_LINK } from '../../../components/workspace-kit.jsx'
import { listVenues } from '../../../lib/organizer-api.js'
import { authoringOrganizations, readSession } from '../../../lib/session.js'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Your venues', robots: { index: false, follow: false } }

/**
 * The venue list.
 *
 * @returns {Promise<JSX.Element>} The rendered page.
 */
export default async function OrganizerVenuesPage() {
  const session = await readSession()
  const organizations = authoringOrganizations(session)

  let venues = []
  let failure = null

  try {
    // Every organisation this person may author in, then filtered to the ones
    // that are actually theirs. The API scopes this too; asking per
    // organisation is what keeps a shared venue out of an editing list.
    const lists = await Promise.all(
      organizations.map((organization) => listVenues(organization.organizationId)),
    )

    venues = lists.flat()
  } catch (error) {
    // No fallback: an organiser shown a list that is not their list would act
    // on it.
    failure = error
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-h2 text-ink">Your venues</h1>
        </div>
        <Link href="/organizer/venues/new" className={PRIMARY_LINK}>
          Add a venue
        </Link>
      </div>

      {failure ? <ReadRefusal error={failure} what="Your venues" action="see your venues" /> : null}

      {organizations.length === 0 ? (
        <p className="mt-6 text-ink-muted">
          You are not a member of an organisation that can manage venues. Ask an owner or admin to
          give you the event manager role.
        </p>
      ) : null}

      {!failure && organizations.length > 0 && venues.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="No venues of your own"
            description="You can still list an event at a shared venue: choose it when you create the event. Adding a venue here is for a hall you run, with its own seating maps."
          />
        </div>
      ) : null}

      {venues.length > 0 ? (
        <ul data-slot="venue-rows" className="mt-8 divide-y divide-line border-y border-line">
          {venues.map((venue) => (
            <li
              key={venue.id}
              className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-6 sm:px-3"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <h2 className="font-display text-title leading-snug font-bold break-words text-ink">
                    <Link href={`/organizer/venues/${venue.id}/maps`} className={TEXT_LINK}>
                      {venue.name}
                    </Link>
                  </h2>
                  {venue.shared ? (
                    <Badge variant="info" srLabel="Ownership:">
                      Shared
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-ink-muted tabular-nums">
                  {venue.city}
                  {venue.region ? `, ${venue.region}` : ''}
                  {venue.capacity ? ` · Capacity ${venue.capacity.toLocaleString('en-US')}` : ''}
                </p>
              </div>
              <p className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
                <Link href={`/organizer/venues/${venue.id}/maps`} className={TEXT_LINK}>
                  Seating maps
                </Link>
                <Link href={`/organizer/venues/${venue.id}/edit`} className={TEXT_LINK}>
                  Edit details
                </Link>
              </p>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
