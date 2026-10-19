/**
 * The organiser directory: who has upcoming events listed on The Desi Events.
 *
 * There is no list endpoint for organisers, and this page does not pretend
 * there is. It is derived the way the sitemap derives its organiser URLs: from
 * the public event listing, read a page at a time and collected into distinct
 * organisers with how many listed events each has (`deriveOrganizers` in
 * `lib/directory.js`). The listing is read from now on — every listed status,
 * events that have not started yet — because that is what the organiser's own
 * page lists as "Upcoming events", so the count on a card is the count behind
 * the link. That makes the framing exact rather than approximate: these are
 * the organisers with upcoming events listed, not every organiser the
 * platform has ever onboarded, and the page says so in those words.
 *
 * The walk is bounded to five pages of a hundred events. When it stops before
 * the end of the listing, the page says how many events it was built from
 * instead of implying the list is complete.
 *
 * No verified badge. The event listing does not carry verification, and a badge
 * inferred from anything else is an endorsement nobody made; the organiser's
 * own page shows the badge when the API says it has been earned.
 *
 * When the API cannot be reached, the listing comes from the sample catalogue
 * and the page says so. The links still lead somewhere: `loadOrganizerBySlug`
 * falls back to the same catalogue, so a sample organiser's page resolves.
 *
 * @module app/organizers/page
 */

import Link from 'next/link'

import { Empty } from '../../components/page-state.jsx'
import { PageHero } from '../../components/page-hero.jsx'
import { SampleDataNotice } from '../../components/sample-data-notice.jsx'
import { deriveOrganizers, organizerCountLabel } from '../../lib/directory.js'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Organisers',
  description:
    'The collectives and promoters with events coming up on The Desi Events: concerts, comedy, Durga Puja, garba and more. Open one to see everything they have on.',
  alternates: { canonical: '/organizers' },
}

/**
 * Say how much of the listing the directory was built from, when not all of it.
 *
 * @param {object} directory The directory `deriveOrganizers` returned.
 * @returns {string|null} A sentence, or `null` when the whole listing was read.
 */
function coverageSentence(directory) {
  if (!directory.truncated) return null

  const read = directory.eventsRead.toLocaleString('en-US')
  const of =
    directory.totalListed !== null && directory.totalListed > directory.eventsRead
      ? ` of ${directory.totalListed.toLocaleString('en-US')}`
      : ''
  // "the first 1 of 250 upcoming events": the noun agrees with the total when there is one.
  const noun = directory.eventsRead === 1 && of === '' ? 'event' : 'events'

  if (directory.interrupted) {
    return `Showing organisers from the first ${read}${of} upcoming ${noun}: the rest of the listing could not be read just now.`
  }

  return `Showing organisers from the first ${read}${of} upcoming ${noun}.`
}

/**
 * The organiser directory.
 *
 * @returns {Promise<JSX.Element>} The rendered page.
 */
export default async function OrganizersPage() {
  const directory = await deriveOrganizers()
  const coverage = coverageSentence(directory)

  return (
    <div>
      <PageHero
        headingId="organisers-heading"
        title="Who is putting on the nights"
        lead="The organisers with upcoming events listed on The Desi Events, and how many each has coming up. Open one to see what they have on and how they handle refunds."
      />

      <div className="mx-auto max-w-content px-4 pt-2 pb-20 sm:px-6 lg:pb-28">
        <SampleDataNotice show={directory.usedFallback} className="mb-6" />

        {coverage ? (
          <p data-testid="organizer-coverage" className="mb-6 text-sm font-semibold text-ink-muted">
            {coverage}
          </p>
        ) : null}

        {directory.organizers.length === 0 ? (
          <Empty
            title="No organisers have upcoming events listed"
            description="An organiser appears here while at least one of their upcoming events is listed."
          />
        ) : (
          <ul
            aria-label="Organisers"
            className="grid grid-cols-1 border-t-2 border-ink md:grid-cols-2 md:gap-x-12"
          >
            {directory.organizers.map((organizer) => (
              <li
                key={organizer.slug}
                className="flex items-baseline justify-between gap-4 border-b border-line py-4"
              >
                <h2 className="min-w-0 text-h3 text-ink sm:text-h2">
                  <Link
                    href={`/organizers/${encodeURIComponent(organizer.slug)}`}
                    className="inline-flex min-h-11 items-center rounded-sm underline-offset-4 transition-[color,font-stretch] duration-(--duration-base) ease-out hover:text-accent-strong hover:underline motion-safe:pointer-fine:hover:[font-stretch:100%]"
                  >
                    {organizer.name}
                  </Link>
                </h2>
                <p className="shrink-0 text-right text-caption text-ink-muted tabular-nums sm:text-label">
                  {organizerCountLabel(organizer.eventCount)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
