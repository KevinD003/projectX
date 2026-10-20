/**
 * The organiser workspace's front page: what is next, what is waiting on
 * you, and what your role lets you do, organisation by organisation.
 *
 * ## What it reads
 *
 * The session's memberships (`GET /v1/auth/me`) and, for each organisation
 * whose drafts this account may see (`event:view_draft`), that
 * organisation's own event list (`GET /v1/events?organizationId=…`, the 50
 * most recently created), exactly as "Your events" reads it. Nothing else:
 * no sales, no money, no figure the page would have to estimate. Every
 * count here is a count of the rows it just read, and the page says so when
 * the list was cut.
 *
 * - **Next up** is the soonest event in that list that has not ended and is
 *   not cancelled, finished, archived, rejected or deleted. On the day it
 *   starts it carries a "Today" mark (or "On now" once it has started), and,
 *   for an account that admits people at that organisation's door, a link to
 *   check-in. That is the one task shortcut on the page.
 * - **Waiting on you** lists the events whose next move is the organiser's,
 *   in the same words the events list uses, each a link to its editor.
 *
 * ## What it does not do
 *
 * Repeat the rail. Its lower half used to be a grid of link cards, one per
 * rail entry; with the rail beside it that made two menus on one screen.
 * The links here go to particular events, and the door shortcut appears
 * only on an event's day.
 *
 * Fall back to anything when a list cannot be read: that organisation says
 * its events could not be read, and the rest of the page stands.
 *
 * @module app/organizer/page
 */

import Link from 'next/link'

import { Badge } from '../../components/ui.jsx'
import { PageHeader, Section, TEXT_LINK } from '../../components/workspace-kit.jsx'
import { statusReading } from '../../lib/event-status.js'
import { formatEventDate, formatEventTime } from '../../lib/format.js'
import { listOrganizerEvents } from '../../lib/organizer-api.js'
import { platformEditorRedirect } from '../../lib/platform-editor.js'
import { readSession, sessionCan } from '../../lib/session.js'
import { roleLabel } from './team/team-vocabulary.js'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Organiser workspace', robots: { index: false, follow: false } }

/**
 * What a capability lets somebody do, in words, for the ones worth saying.
 *
 * Capabilities not listed are held but not described: this is a summary for a
 * person, not an audit of their grants.
 *
 * @type {ReadonlyArray<Array<string>>}
 */
const PLAIN_WORDS = Object.freeze([
  ['event:create', 'Create and edit events'],
  ['venue:manage', 'Manage venues and seating maps'],
  ['ticket:check_in', 'Admit people at the door'],
  ['report:view', 'See how events are selling'],
  ['finance:view', 'See the money'],
  ['order:refund_approve', 'Approve refunds'],
  ['team:invite', 'Invite people to the team'],
  ['team:role_manage', 'Change who can do what'],
  ['privacy:redact', 'Handle erasure requests'],
])

/** States an event is never "next up" in: over, off or not going ahead. */
const NOT_UPCOMING = new Set(['CANCELLED', 'COMPLETED', 'ARCHIVED', 'REJECTED', 'DELETED'])

/** How many events "Waiting on you" names before it says how many more. */
export const WAITING_SHOWN = 5

/**
 * The soonest event in a list that has not ended and is still going ahead.
 *
 * @param {Array<{status: string, startsAt: string, endsAt?: string|null}>} events The list.
 * @param {number} now Milliseconds since the epoch.
 * @returns {object|null} The event, or null when there is none.
 */
export function nextUp(events, now) {
  return (
    events
      .filter((event) => !NOT_UPCOMING.has(event.status))
      .filter((event) => {
        const ends = Date.parse(event.endsAt ?? event.startsAt)

        return Number.isFinite(ends) && ends > now
      })
      .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))[0] ?? null
  )
}

/**
 * Whether an event is on today, in its own time zone, and in what way.
 *
 * @param {{startsAt: string, endsAt?: string|null, timezone?: string}} event The event.
 * @param {number} now Milliseconds since the epoch.
 * @returns {'on'|'today'|null} `on` once it has started, `today` on its day before then, else null.
 */
export function todayMark(event, now) {
  const starts = Date.parse(event.startsAt)
  const ends = Date.parse(event.endsAt ?? event.startsAt)

  if (!Number.isFinite(starts)) return null
  if (starts <= now && ends > now) return 'on'

  const zone = event.timezone ?? 'UTC'

  return starts > now && formatEventDate(event.startsAt, zone) === formatEventDate(now, zone)
    ? 'today'
    : null
}

/**
 * Read one organisation's events, reporting a failure rather than throwing it.
 *
 * @param {string} organizationId The organisation.
 * @returns {Promise<{events: object[]|null, truncated: boolean}>} Its events; null when unread.
 */
async function eventsOf(organizationId) {
  try {
    const result = await listOrganizerEvents({ organizationId })

    return { events: result.events, truncated: Boolean(result.pagination?.hasNextPage) }
  } catch {
    return { events: null, truncated: false }
  }
}

/**
 * The next event, as the page's one plate: the date set large on the purple,
 * the title beside it, and on its day the orange mark and the door.
 *
 * @param {object} props Component props.
 * @param {object} props.event The event.
 * @param {string} props.href Its editor.
 * @param {boolean} props.door Whether this account admits people at its door.
 * @param {number} props.now Milliseconds since the epoch.
 * @returns {JSX.Element} The plate.
 */
function NextUpPlate({ event, href, door, now }) {
  const zone = event.timezone ?? 'UTC'
  const mark = todayMark(event, now)
  const day = new Intl.DateTimeFormat('en-US', { day: 'numeric', timeZone: zone }).format(
    new Date(event.startsAt),
  )
  const month = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: zone }).format(
    new Date(event.startsAt),
  )
  const reading = statusReading(event.status)

  return (
    <div
      data-slot="next-up"
      className="flex flex-col gap-5 rounded-plate bg-surface-inverse p-5 text-ink-inverse sm:flex-row sm:p-6"
    >
      <p
        aria-hidden="true"
        className="flex shrink-0 flex-row items-baseline gap-2 font-display leading-none sm:w-24 sm:flex-col sm:items-start sm:gap-1"
      >
        <span className="text-display font-bold text-accent-inverse tabular-nums">{day}</span>
        <span className="text-h3 font-bold tracking-caps uppercase">{month}</span>
      </p>
      <div className="min-w-0 flex-1">
        {mark ? (
          <p className="mb-3 inline-flex rounded-plate bg-celebration px-2.5 py-1 text-sm font-semibold text-highlight-ink">
            {mark === 'on' ? 'On now' : 'Today'}
          </p>
        ) : null}
        <h3 className="text-h3 break-words">
          <Link
            href={href}
            className="rounded-sm text-ink-inverse underline decoration-ink-inverse/40 decoration-1 underline-offset-4 hover:decoration-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            {event.title}
          </Link>
        </h3>
        <p className="mt-2 text-sm text-ink-inverse-muted">
          <time dateTime={event.startsAt}>
            {formatEventDate(event.startsAt, zone)}, {formatEventTime(event.startsAt, zone)}
          </time>
          {event.venueName ? ` · ${event.venueName}` : ''}
          {event.city ? `, ${event.city}` : ''}
        </p>
        <p className="mt-1 text-sm text-ink-inverse-muted">
          {reading.label}
          {reading.whose === 'you' ? ', and the next move is yours' : ''}
        </p>
        {mark && door ? (
          <p className="mt-4">
            <Link
              href="/organizer/check-in"
              className="inline-flex min-h-11 items-center rounded-control bg-highlight px-5 text-sm font-semibold text-highlight-ink transition-colors duration-(--duration-fast) hover:bg-accent-inverse focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus motion-safe:active:scale-[0.98]"
            >
              Open check-in
            </Link>
          </p>
        ) : null}
      </div>
    </div>
  )
}

/**
 * The workspace front page.
 *
 * @returns {Promise<JSX.Element>} The rendered page.
 */
export default async function OrganizerHomePage() {
  const session = await readSession()
  const memberships = session?.memberships ?? []
  const now = Date.now()
  const lists = await Promise.all(
    memberships.map((membership) =>
      (membership.capabilities ?? []).includes('event:view_draft')
        ? eventsOf(membership.organizationId)
        : Promise.resolve(null),
    ),
  )

  return (
    <div>
      <PageHeader
        title="Organiser workspace"
        description="What is next, what is waiting on you, and what your role lets you do in each organisation."
      />

      <Section id="workspace-organisations" title="Your organisations" className="mt-10">
        {memberships.length === 0 ? (
          <p className="mt-3 text-ink-muted">
            You are not a member of any organisation. What you can open here comes from a platform
            role.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {memberships.map((membership, index) => {
              const held = PLAIN_WORDS.filter(([capability]) =>
                (membership.capabilities ?? []).includes(capability),
              )
              const list = lists[index]
              const events = list?.events ?? null
              const next = events ? nextUp(events, now) : null
              const waiting = events
                ? events.filter(
                    (event) =>
                      event.status !== 'DELETED' && statusReading(event.status).whose === 'you',
                  )
                : []
              const hrefOf = (event) =>
                platformEditorRedirect(session, event) ??
                `/organizer/events/${encodeURIComponent(event.id)}`
              const headingId = `organisation-${membership.organizationId}`

              return (
                <li key={membership.organizationId} aria-labelledby={headingId} className="py-6">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <p
                      id={headingId}
                      className="font-display text-h3 font-bold break-words text-ink"
                    >
                      {membership.organizationName ?? 'An organisation'}
                    </p>
                    <p className="text-sm text-ink-muted">
                      Your role:{' '}
                      <span className="font-semibold text-ink">{roleLabel(membership.role)}</span>
                    </p>
                  </div>

                  {list ? (
                    <div className="mt-5 grid gap-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
                      <div className="min-w-0">
                        <h3 className="text-title font-semibold text-ink">Next up</h3>
                        <div className="mt-3">
                          {events === null ? (
                            <p className="text-sm text-ink-muted">
                              This organisation’s events could not be read just now.
                            </p>
                          ) : next ? (
                            <NextUpPlate
                              event={next}
                              href={hrefOf(next)}
                              door={sessionCan(
                                session,
                                'ticket:check_in',
                                membership.organizationId,
                              )}
                              now={now}
                            />
                          ) : (
                            <p className="text-sm text-ink-muted">
                              Nothing is coming up. An event appears here from when it is created
                              until it ends.
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="min-w-0">
                        <h3 className="text-title font-semibold text-ink">Waiting on you</h3>
                        {events === null ? null : waiting.length === 0 ? (
                          <p className="mt-3 text-sm text-ink-muted">
                            Nothing. Every event here is with a moderator or needs nothing from you.
                          </p>
                        ) : (
                          <>
                            <ul className="mt-3 divide-y divide-line border-y border-line">
                              {waiting.slice(0, WAITING_SHOWN).map((event) => {
                                const reading = statusReading(event.status)

                                return (
                                  <li
                                    key={event.id}
                                    className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-3"
                                  >
                                    <Link
                                      href={hrefOf(event)}
                                      className={`${TEXT_LINK} min-w-0 text-sm break-words`}
                                    >
                                      {event.title}
                                    </Link>
                                    <Badge variant={reading.tone} srLabel="State:">
                                      {reading.label}
                                    </Badge>
                                  </li>
                                )
                              })}
                            </ul>
                            {waiting.length > WAITING_SHOWN ? (
                              <p className="mt-2 text-sm text-ink-muted">
                                And {waiting.length - WAITING_SHOWN} more in your events.
                              </p>
                            ) : null}
                          </>
                        )}
                        {list.truncated ? (
                          <p className="mt-2 text-sm text-ink-muted">
                            Counted from the 50 most recently created events.
                          </p>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  {held.length > 0 ? (
                    <ul
                      className="mt-6 flex flex-wrap gap-2"
                      aria-label="What this role lets you do"
                    >
                      {held.map(([capability, words]) => (
                        <li
                          key={capability}
                          className="rounded-full border border-accent-line bg-accent-soft px-3 py-1 text-xs font-medium text-ink"
                        >
                          {words}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </Section>
    </div>
  )
}
