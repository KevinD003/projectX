/**
 * An event's detail page: what it is, when and where it runs, what a seat
 * costs all in, and whether it is still happening.
 *
 * ## Saying when something is off
 *
 * A cancelled show whose page looks exactly like a live one is the failure this
 * page is built around. Three things have to agree, and they are derived from
 * one status so they cannot drift:
 *
 *   - the banner a person reads,
 *   - the `schema.org` `eventStatus` a search engine reads,
 *   - and whether the buy button does anything.
 *
 * `lib/event-jsonld.js` owns the first two; the third is here. A banner saying
 * "cancelled" above a working "Choose tickets" button is worse than either
 * alone.
 *
 * ## What is not on the page
 *
 * Only what the API gives an anonymous caller. The structured data is built
 * from the same payload the page renders rather than from a second read, so
 * there is one allow list rather than two — a second source is how an
 * organiser's contact address ends up inside a `<script>` tag after having been
 * kept out of the visible page.
 *
 * ## An imported event
 *
 * An event imported from an organiser's own listing (`importedFrom`) is sold
 * here like any other: its ticket types, "Choose tickets" and the simulated
 * checkout. Its page names the organiser the listing names, says its prices
 * are as the organiser listed them on the day the listing was read, never
 * shows a remaining count (its stock is an allowance, not the organiser's
 * figure), and adds "Reserve on WhatsApp" beside the checkout while it can
 * still be reserved (not once it is cancelled, postponed or over). It shows no
 * website link and no redirect at all: nothing on it leads to the site its
 * listing was read from (ADR 0015, addendum 2026-10-15 (2)).
 *
 * ## Counting visits
 *
 * A public event's page sends one page view, and "Choose tickets" and each
 * "Choose seats" link carry the attributes a click is counted by
 * (`TrafficScope`). Nothing is counted for sample data, for a page that is not
 * public, for staff at The Desi Events, or for the event's own team; for those readers
 * the website link carries `?count=no`, which can only stop a visit being
 * counted. The session is read once per request, however many components ask.
 *
 * @module app/events/slug/page
 */

import Link from 'next/link'
import { PUBLICLY_VISIBLE_STATUSES } from '@desi-event/schemas/lifecycle'

import { Alert, Badge } from '../../../components/ui.jsx'

import { accessibilityLabel, mergedAccessibility } from '../../../lib/accessibility.js'
import { loadEventBySlug } from '../../../lib/api.js'
import { categoryLabel } from '../../../lib/catalog.js'
import {
  allTiersSoldOut,
  eventAvailability,
  tierOnSaleNow,
} from '../../../lib/event-availability.js'
import { eventJsonLd, lifecycleNotice } from '../../../lib/event-jsonld.js'
import {
  formatEventDate,
  formatEventTime,
  formatEventWhen,
  formatTimeZoneLabel,
  formatVenueAddress,
  toDateTimeAttribute,
} from '../../../lib/format.js'
import { endTimeListed, reservableOnWhatsApp } from '../../../lib/imports.js'
import { formatPrice, priceSelection, taxLabelForPlace } from '../../../lib/pricing.js'
import { buildEventsHref } from '../../../lib/search-params.js'
import { readSession } from '../../../lib/session.js'
import { trafficAttributes } from '../../../lib/traffic-client.js'
import { excludesEvent, trafficExclusion } from '../../../lib/traffic.js'
import {
  ArrowRightIcon,
  CalendarIcon,
  CategoryIcon,
  CheckIcon,
  ClockIcon,
  PinIcon,
  ShieldIcon,
  TicketIcon,
  VerifiedIcon,
} from '../../../components/icons.jsx'
import { OUTLINE_LINK, PRIMARY_LINK, TEXT_LINK } from '../../../components/link-classes.js'
import { AvailabilityChip } from '../../../components/listing-card.jsx'
import { EventArt } from '../../../components/event-art.jsx'
import { EventGallery } from '../../../components/event-gallery.jsx'
import { EventWebsiteLink } from '../../../components/event-website-link.jsx'
import { ImportedEventPanel } from '../../../components/imported-event-panel.jsx'
import { JsonLd } from '../../../components/json-ld.jsx'
import {
  EventContact,
  EventDirections,
  EventDressCode,
  EventFaq,
  EventLineUp,
  EventRunningOrder,
  EventSocialLinks,
  EventSponsors,
} from '../../../components/event-content.jsx'
import { RichText } from '../../../components/rich-text.jsx'
import { NotFoundView } from '../../../components/not-found-view.jsx'
import { Breadcrumbs } from '../../../components/page-state.jsx'
import { SampleDataNotice } from '../../../components/sample-data-notice.jsx'
import { SessionList } from '../../../components/session-list.jsx'
import { StickyBuyBar } from '../../../components/sticky-buy-bar.jsx'
import { TicketTiers } from '../../../components/ticket-tiers.jsx'
import { TrafficScope } from '../../../components/traffic-scope.jsx'

export const dynamic = 'force-dynamic'

/** Where this deployment is served from. Mirrors the root layout and sitemap. */
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://127.0.0.1:3000'

/**
 * Statuses in which the buy button leads somewhere.
 *
 * `PUBLISHED` is on the list and `SALES_PAUSED` is not: an announced event
 * whose sales have not opened yet still takes you to a page that says when they
 * do, whereas a paused one has been stopped on purpose and a link into checkout
 * would be a lie with a loading spinner on the end of it.
 *
 * @type {ReadonlySet<string>}
 */
const BUYABLE_STATUSES = new Set(['PUBLISHED', 'ON_SALE'])

/**
 * What the tickets section says when buyers may pay the ticket price at the
 * door (SPEC3 §12.2): a note, not an alert.
 */
const VENUE_PAYMENT_NOTE =
  'You can pay at the venue for this event: pay the booking fee online now (simulated), and the ticket price at the door.'

/**
 * The cheapest ticket that can be bought now, used for the "from" price.
 *
 * "Can be bought" as the API's `salesOpen` means it (`tierOnSaleNow`): stock
 * left, the tier on sale, and now inside its sales window. Filtering on stock
 * alone quoted a tier whose sales had not opened, and put "On sale" above it
 * while the event's listing card said "Not on sale now".
 *
 * @param {object[]} ticketTypes Ticket tiers with availability folded in.
 * @param {Date} now The moment the page is rendered for.
 * @returns {object|null} The cheapest tier on sale now, or `null` when there is none.
 */
function cheapestAvailable(ticketTypes, now) {
  const available = ticketTypes.filter((tier) => tierOnSaleNow(tier, now))
  if (available.length === 0) return null

  return available.reduce((lowest, tier) => (tier.priceCents < lowest.priceCents ? tier : lowest))
}

/**
 * What one of a tier's tickets actually costs, fees and tax included.
 *
 * The number on the poster and the number on the card have to be the same
 * number. This computes the second one from the same tables the server charges
 * from — `@desi-event/pricing`, resolved against where the event is *held*
 * rather than what it is priced in — so the "from" line can show it before
 * anybody commits to anything.
 *
 * It is still an estimate in one honest sense: the server recomputes every
 * column from the ticket type rows when the order is placed, and that result is
 * what is charged. It cannot differ unless the tier changed underneath, which
 * is exactly when it should.
 *
 * @param {object|null} tier The cheapest available tier, or null.
 * @param {object|null} [venue] The venue, for the tax jurisdiction.
 * @param {Array<object>|null} [feeTerms] The fee terms the API published for the event.
 * @returns {{allInCents: number, feesCents: number, taxCents: number, taxLabel: string}|null} The breakdown, or null.
 */
function allInPrice(tier, venue, feeTerms = null) {
  if (!tier || !Number.isFinite(tier.priceCents)) return null

  const place = { country: venue?.country, region: venue?.region }

  const totals = priceSelection({
    lines: [
      {
        ticketTypeId: tier.id,
        name: tier.name,
        quantity: 1,
        unitPriceCents: tier.priceCents,
      },
    ],
    currency: tier.currency ?? 'USD',
    place,
    feeTerms,
  })

  return {
    allInCents: totals.totalCents,
    feesCents: totals.feesCents,
    taxCents: totals.taxCents,
    taxLabel: taxLabelForPlace(place),
  }
}

/**
 * Whether a text opens with another, ignoring spacing and case.
 *
 * @param {string|null|undefined} text The longer text.
 * @param {string} start What it may open with.
 * @returns {boolean} Whether it does.
 */
function opensWith(text, start) {
  const plain = (value) =>
    String(value ?? '')
      .replace(/\s+/gu, ' ')
      .trim()
      .toLowerCase()

  return plain(start) !== '' && plain(text).startsWith(plain(start))
}

/**
 * A zone's everyday name, read at the event's start: "Eastern Time", never
 * the database's `America/New_York`.
 *
 * @param {object} event The event, with `timezone` and `startsAt`.
 * @returns {string|null} The name, or null when it cannot be read.
 */
function genericZoneName(event) {
  try {
    return (
      new Intl.DateTimeFormat('en-US', { timeZone: event.timezone, timeZoneName: 'longGeneric' })
        .formatToParts(new Date(event.startsAt))
        .find((part) => part.type === 'timeZoneName')?.value ?? null
    )
  } catch {
    return null
  }
}

/**
 * Per-event metadata for search engines and link previews.
 *
 * @param {object} props Route props.
 * @param {Promise<{slug: string}>} props.params The resolved route parameters.
 * @returns {Promise<object>} A Next.js metadata object.
 */
export async function generateMetadata({ params }) {
  const { slug } = await params
  const { event } = await loadEventBySlug(slug)

  // A deleted event is not found, for everybody: even its own team, whose
  // session the API would answer with it, reads it in the workspace instead.
  if (!event || event.status === 'DELETED') {
    return { title: 'Event not found', robots: { index: false, follow: false } }
  }

  const where = event.venue ? `${event.venue.name}, ${event.venue.city}` : 'Online'
  const when = formatEventDate(event.startsAt, event.timezone)

  return {
    title: event.title,
    description: event.summary,
    alternates: { canonical: `/events/${event.slug}` },
    /*
     * A page that is not public does not get indexed, whatever reached it.
     *
     * The API is what decides who may load a draft, and it answers a stranger
     * with 404. This is the second lock: if a signed-in organiser previews
     * their own unannounced event and a crawler follows them in — a shared
     * link, a browser extension, a proxy that caches — the response still says
     * not to index it. The set is the lifecycle's, not a list written here.
     *
     * `CANCELLED` and `POSTPONED` stay indexable on purpose. They are the
     * states where a stale rich result does real harm, and the way to fix a
     * stale rich result is to let the crawler read the page and find
     * `EventCancelled` in the structured data — not to hide the page and leave
     * the old answer standing.
     */
    robots: PUBLICLY_VISIBLE_STATUSES.has(event.status)
      ? undefined
      : { index: false, follow: false },
    openGraph: {
      type: 'article',
      title: `${event.title} — ${when}, ${where}`,
      description: event.summary,
      url: `/events/${event.slug}`,
    },
    twitter: { card: 'summary_large_image', title: event.title, description: event.summary },
  }
}

/**
 * @typedef {object} EventDetailPageProps
 * @property {Promise<{slug: string}>} params The resolved route parameters.
 */

/**
 * The event detail page.
 *
 * @param {EventDetailPageProps} props Route props.
 * @returns {Promise<JSX.Element>} The rendered page.
 */
export default async function EventDetailPage({ params }) {
  const { slug } = await params
  const { event, usedFallback } = await loadEventBySlug(slug)

  // Next.js 16.3.5 answers `notFound()` with a document that has no body until
  // the browser hydrates, so a missing event renders the shared not-found view
  // here instead. See components/not-found-view.jsx. A deleted event is not
  // found for everybody, its own team included (SPEC2-XI X-S).
  if (!event || event.status === 'DELETED') return <NotFoundView />

  const ticketTypes = event.ticketTypes ?? []
  const sessions = event.sessions ?? []
  // An event imported from an organiser's listing (SPEC2-XI I-E): sold here
  // like any other, its organiser is the one the listing names, and an end the
  // listing did not give is never shown (the API keeps an estimate).
  const imported = event.importedFrom ?? null
  const endListed = endTimeListed(event)
  const shownEndsAt = endListed ? event.endsAt : null
  const presenter = imported?.presentedBy ?? event.organization?.name ?? null
  const cheapest = cheapestAvailable(ticketTypes, new Date())
  const soldOut = allTiersSoldOut(ticketTypes)
  const address = formatVenueAddress(event.venue)
  const zoneLabel = formatTimeZoneLabel(event)
  const zoneName = genericZoneName(event)

  const notice = lifecycleNotice(event.status)
  const buyable = BUYABLE_STATUSES.has(event.status) && Boolean(cheapest)
  const closedSentence = notice?.title
    ? `${notice.title}. Tickets cannot be bought here at the moment.`
    : 'Tickets are not on sale at the moment.'
  const allIn = allInPrice(cheapest, event.venue, event.feeTerms)
  const access = mergedAccessibility(event)
  const policies = event.policies ?? {}
  const place = event.venue ? { country: event.venue.country, region: event.venue.region } : null

  // The state a card would show, read from the status alone: cancelled,
  // postponed, finished, sold out or paused. An ordinary on-sale event has no
  // chip in the hero — the ticket box says so where it matters.
  const stateChip = eventAvailability({ status: event.status })
  // Sold out by stock, not merely "nothing to buy now": a tier whose sales have
  // not opened, or that is paused, has not sold out.
  const allTiersGone = soldOut && !stateChip
  const locality = event.venue
    ? [event.venue.city, event.venue.region].filter(Boolean).join(', ')
    : null
  const heroPrice = cheapest
    ? {
        amount: formatPrice(allIn ? allIn.allInCents : cheapest.priceCents, cheapest.currency),
        note: allIn
          ? `with fees${allIn.taxCents > 0 ? ' and tax' : ''}`
          : cheapest.priceCents === 0
            ? 'no charge'
            : 'before fees',
      }
    : null

  // The bar that keeps the price in reach on a phone: only while there is
  // something to buy.
  const showBuyBar = buyable && Boolean(heroPrice)

  // Emitted only for an event a stranger may load at all. For a draft being
  // previewed by its own organiser there is nothing a search engine should be
  // told, and a `<script>` block is the one part of a page that a `noindex`
  // header does not stop a scraper reading.
  const structuredData = PUBLICLY_VISIBLE_STATUSES.has(event.status)
    ? eventJsonLd(event, { siteUrl })
    : null

  // Visits are counted only to a real, public event: never to sample data,
  // and never to a draft or review preview, which only its own team sees.
  const traffic =
    !usedFallback && PUBLICLY_VISIBLE_STATUSES.has(event.status)
      ? { eventId: event.id, organizationId: event.organizationId }
      : null
  // The event's own team and staff at The Desi Events are not counted: their website
  // visits are marked so on the link, as their page views and clicks are left
  // out by the beacons.
  const uncounted = excludesEvent(trafficExclusion(await readSession()), event.organizationId)

  return (
    <article className={showBuyBar ? 'pb-24 lg:pb-0' : undefined}>
      <JsonLd data={structuredData} />

      <div className="mx-auto max-w-content px-4 pt-2 sm:px-6">
        <Breadcrumbs
          structured
          trail={[
            { href: '/', label: 'Home' },
            { href: '/events', label: 'Discover events' },
            {
              href: buildEventsHref({ category: event.category }),
              label: categoryLabel(event.category),
            },
            { href: null, label: event.title },
          ]}
        />
      </div>

      {/*
        The hero: the event's poster (or its approved cover) as the plate, and
        beside it, on the white page, the title and the facts a person decides
        on. The poster prints itself into register once as the page arrives,
        and when it was followed from a card on the listing it is the same
        object, moved and scaled into place. On a phone the poster leads, at a
        shorter 5:4 so the price is still on the first screen.
      */}
      <section
        aria-labelledby="event-title"
        className="mx-auto max-w-content px-4 pt-4 pb-12 sm:px-6 sm:pt-6 lg:pb-16"
      >
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-end lg:gap-12">
          <div className="min-w-0 lg:col-span-5">
            <div className="overflow-hidden rounded-plate bg-surface-subtle">
              <EventArt
                event={event}
                variant="hero"
                priority
                registration
                transitionName
                sizes="(min-width: 1024px) 28rem, 100vw"
              />
            </div>
          </div>

          <div className="min-w-0 lg:col-span-7 lg:pb-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex min-h-8 items-center gap-2 rounded-full bg-accent-secondary-soft px-3 text-label font-bold text-accent-secondary">
                <CategoryIcon category={event.category} className="h-4 w-4" />
                {categoryLabel(event.category)}
              </span>
              {stateChip ? (
                <span className="inline-flex min-h-8 items-center rounded-full bg-availability-closed-soft px-3 text-label font-bold text-availability-closed">
                  <span className="sr-only">Availability: </span>
                  {stateChip.label}
                </span>
              ) : null}
              {allTiersGone ? (
                <span className="inline-flex min-h-8 items-center rounded-full bg-availability-closed-soft px-3 text-label font-bold text-availability-closed">
                  <span className="sr-only">Availability: </span>
                  Sold out
                </span>
              ) : null}
              {/* A number, not a colour: "18+" is the whole fact, and a red dot is not. */}
              {event.ageRestriction ? (
                <Badge variant="warning" size="lg" srLabel="Age restriction:">
                  {event.ageRestriction}+
                </Badge>
              ) : null}
            </div>

            <h1
              id="event-title"
              className={`mt-4 text-ink [overflow-wrap:anywhere] ${
                String(event.title).length <= 36 ? 'text-display' : 'text-h1'
              }`}
            >
              {event.title}
            </h1>

            {/* Not when the description opens with the same words, as an
                imported listing's often does: it would be read twice. */}
            {event.summary && !opensWith(event.description, event.summary) ? (
              <p className="mt-4 max-w-[60ch] text-body text-ink-muted">{event.summary}</p>
            ) : null}

            {event.organization ? (
              <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-label text-ink-muted">
                <span>{`Presented by ${presenter}`}</span>
                {event.organization.verified && !imported ? (
                  <span className="inline-flex min-h-7 items-center gap-1.5 rounded-full bg-highlight px-2.5 text-caption font-bold text-highlight-ink">
                    <VerifiedIcon className="h-4 w-4" />
                    Verified organiser
                  </span>
                ) : null}
              </p>
            ) : null}

            <ul
              aria-label="Event details"
              className="mt-6 grid grid-cols-1 border-y border-line sm:grid-cols-3 sm:divide-x sm:divide-line"
            >
              <li className="flex items-start gap-3 py-4 sm:pr-5">
                <CalendarIcon className="mt-0.5 h-5 w-5 shrink-0 text-accent-strong" />
                <span className="min-w-0">
                  <span className="block text-label font-bold text-ink">
                    <time dateTime={toDateTimeAttribute(event.startsAt)}>
                      {formatEventDate(event.startsAt, event.timezone)}
                    </time>
                  </span>
                  <span className="block text-caption text-ink-muted tabular-nums">
                    {formatEventTime(event.startsAt, event.timezone)}
                    {shownEndsAt ? ` – ${formatEventTime(shownEndsAt, event.timezone)}` : ''}
                    {zoneLabel ? ` ${zoneLabel}` : ''}
                  </span>
                </span>
              </li>
              <li className="flex items-start gap-3 border-t border-line py-4 sm:border-t-0 sm:px-5">
                <PinIcon className="mt-0.5 h-5 w-5 shrink-0 text-accent-strong" />
                <span className="min-w-0">
                  <span className="block text-label font-bold text-ink">
                    {event.isOnline ? 'Online' : (event.venue?.name ?? 'Venue to be announced')}
                  </span>
                  {locality ? (
                    <span className="block text-caption text-ink-muted">{locality}</span>
                  ) : null}
                </span>
              </li>
              {heroPrice ? (
                <li className="flex items-start gap-3 border-t border-line py-4 sm:border-t-0 sm:pl-5">
                  <TicketIcon className="mt-0.5 h-5 w-5 shrink-0 text-accent-strong" />
                  <span className="min-w-0">
                    <span className="block text-label font-bold text-ink tabular-nums">
                      From {heroPrice.amount}
                    </span>
                    <span className="block text-caption text-ink-muted">{heroPrice.note}</span>
                  </span>
                </li>
              ) : null}
            </ul>

            {ticketTypes.length > 0 || imported ? (
              <a href="#tickets" className={`${OUTLINE_LINK} mt-6`}>
                <TicketIcon className="h-4.5 w-4.5" />
                Tickets and prices
              </a>
            ) : null}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-content px-4 sm:px-6">
        {/*
          Straight after the hero and carrying its own words. A person who has
          just been sent this link by a friend finds out here that the show is
          off, rather than after scrolling past the poster to a greyed button.
        */}
        {notice ? (
          <Alert variant={notice.variant} title={notice.title} className="mt-8 rounded-card">
            <p>{notice.body}</p>
            {event.status === 'POSTPONED' && event.previousStartsAt ? (
              <p className="mt-1">
                It was going to be on{' '}
                <time dateTime={toDateTimeAttribute(event.previousStartsAt)}>
                  {formatEventDate(event.previousStartsAt, event.timezone)}
                </time>
                .
              </p>
            ) : null}
          </Alert>
        ) : null}

        <SampleDataNotice show={usedFallback} className="mt-8" />

        <div className="mt-12 grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1fr)_25rem] lg:items-start lg:gap-16">
          <div className="min-w-0 space-y-14">
            <section aria-labelledby="about-heading">
              <h2 id="about-heading" className="text-h2 text-ink">
                About this event
              </h2>
              {/* The organiser's own formatting — paragraphs, lists, bold,
                  italic and https links — rendered as elements, never as
                  HTML. The first paragraph leads, as it always has. */}
              <RichText
                text={event.description}
                className="mt-5 text-body text-ink-muted [&>p:first-child]:text-[1.1875rem] [&>p:first-child]:leading-8 [&>p:first-child]:text-ink"
              />

              {event.languages?.length > 0 ? (
                <p className="mt-6 text-sm text-ink-muted">
                  <span className="font-bold text-ink">Languages: </span>
                  {event.languages.join(', ')}
                </p>
              ) : null}

              {/* Billing order, kept: for a lot of these events the order of the
                  names on the bill is the thing being negotiated. */}
              <EventLineUp performers={event.performers} artists={event.artists} />
            </section>

            {/* The organiser's approved pictures, in their order. Renders
                nothing for an event with none. */}
            <EventGallery images={event.gallery} />

            <section aria-labelledby="schedule-heading">
              <h2 id="schedule-heading" className="text-h2 text-ink">
                Schedule
              </h2>
              {sessions.length > 0 ? (
                <div className="mt-5">
                  <SessionList
                    sessions={sessions}
                    eventSlug={event.slug}
                    buyable={BUYABLE_STATUSES.has(event.status)}
                    ticketTypes={ticketTypes}
                    traffic={traffic}
                  />
                </div>
              ) : (
                <dl className="mt-5 grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
                  <ScheduleFact Icon={ClockIcon} term="Doors / start">
                    <time dateTime={toDateTimeAttribute(event.startsAt)}>
                      {formatEventDate(event.startsAt, event.timezone)} ·{' '}
                      {formatEventTime(event.startsAt, event.timezone)}
                    </time>
                  </ScheduleFact>
                  {shownEndsAt ? (
                    <ScheduleFact Icon={ClockIcon} term="Ends">
                      <time dateTime={toDateTimeAttribute(shownEndsAt)}>
                        {formatEventDate(shownEndsAt, event.timezone)} ·{' '}
                        {formatEventTime(shownEndsAt, event.timezone)}
                      </time>
                    </ScheduleFact>
                  ) : null}
                  <ScheduleFact Icon={PinIcon} term="Local time" wide>
                    All times are the venue’s own
                    {zoneName ? `, ${zoneName}` : ''}
                    {zoneLabel ? ` (${zoneLabel})` : ''}, not yours.
                  </ScheduleFact>
                </dl>
              )}
            </section>

            <EventRunningOrder
              items={event.runningOrder}
              timezone={event.timezone}
              startsAt={event.startsAt}
            />

            <section aria-labelledby="venue-heading">
              <h2 id="venue-heading" className="text-h2 text-ink">
                Venue
              </h2>
              {event.venue ? (
                <div className="mt-5 grid grid-cols-1 gap-6 border-t-2 border-ink pt-5 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <div className="min-w-0">
                    <p className="font-display text-h3 text-ink">
                      {/* Linked when there is a slug. Deriving one from the name
                          would produce a URL that looks right and 404s. */}
                      {event.venue.slug ? (
                        <Link href={`/venues/${event.venue.slug}`} className={TEXT_LINK}>
                          {event.venue.name}
                        </Link>
                      ) : (
                        event.venue.name
                      )}
                    </p>
                    <address className="mt-2 text-label leading-6 text-ink-muted not-italic">
                      {address.map((line) => (
                        <span key={line} className="block">
                          {line}
                        </span>
                      ))}
                    </address>
                    {event.venue.capacity ? (
                      <p className="mt-3 text-caption text-ink-muted tabular-nums">
                        Capacity {event.venue.capacity.toLocaleString('en-US')}
                      </p>
                    ) : null}
                  </div>
                  <PinIcon className="hidden h-10 w-10 text-accent-strong sm:block" />
                </div>
              ) : event.isOnline ? null : (
                <p className="mt-4 text-ink-muted">
                  The venue for this event has not been announced.
                </p>
              )}
              {/* The joining link is for ticket holders. It is never on this
                  page, in its markup or in its structured data. */}
              {event.isOnline ? (
                <p className="mt-4 rounded-control bg-surface-subtle px-4 py-3 text-ink-muted">
                  <span className="font-bold text-ink">This event is online.</span> The joining link
                  is on your ticket once you have booked.
                </p>
              ) : null}
            </section>

            {/* This event's own arrival notes, after the venue's address. */}
            <EventDirections text={event.directions} />

            {/*
              Before you come: the two questions that decide whether somebody can
              come at all, answered together rather than buried in a description.
              Rendered as text per claim rather than as an icon row — an icon is
              unreadable to a screen reader without a label nobody writes.
            */}
            {access.features.length > 0 || access.notes.length > 0 || event.ageRestriction ? (
              <section aria-labelledby="access-heading">
                <h2 id="access-heading" className="text-h2 text-ink">
                  Access and admission
                </h2>

                {event.ageRestriction ? (
                  <p className="mt-4 text-ink-muted">
                    <span className="font-bold text-ink">Age {event.ageRestriction} and over.</span>{' '}
                    {policies.ageNote ??
                      'Bring photo identification — the door may ask for it, and a ticket is not a way in without it.'}
                  </p>
                ) : null}

                {access.features.length > 0 ? (
                  <ul className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {access.features.map((code) => (
                      <li key={code} className="flex items-center gap-3 text-[0.9375rem] text-ink">
                        <span
                          aria-hidden="true"
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-secondary-soft text-accent-secondary"
                        >
                          <CheckIcon className="h-3.5 w-3.5" />
                        </span>
                        {accessibilityLabel(code)}
                      </li>
                    ))}
                  </ul>
                ) : null}

                {/* Attributed, because "ring the bell at Gate 3" and "this
                    performance is captioned" answer different questions. */}
                {access.notes.map((note) => (
                  <p key={note.source} className="mt-4 text-sm text-ink-muted">
                    <span className="font-bold text-ink">{note.source}: </span>
                    {note.text}
                  </p>
                ))}

                {access.features.length === 0 && access.notes.length === 0 ? (
                  <p className="mt-4 text-sm text-ink-muted">
                    No accessibility information has been published for this event. Ask the
                    organiser before you buy rather than assuming either way.
                  </p>
                ) : null}
              </section>
            ) : null}

            <EventDressCode text={event.dressCode} />

            <EventFaq items={event.faq} />

            {event.organization ? (
              <section aria-labelledby="organiser-heading">
                <h2 id="organiser-heading" className="text-h2 text-ink">
                  Presented by
                </h2>
                <div className="mt-5 border-t-2 border-ink pt-5">
                  {imported ? (
                    /*
                      The organiser the listing names, who has no page here;
                      then who holds the listing on The Desi Events, and why.
                    */
                    <>
                      <p className="font-display text-h3 font-bold text-ink">{presenter}</p>
                      <p className="mt-3 text-ink-muted">
                        Listed by the team at The Desi Events from the organiser’s own listing, and
                        sold here under{' '}
                        {event.organization.slug ? (
                          <Link
                            href={`/organizers/${event.organization.slug}`}
                            className={TEXT_LINK}
                          >
                            {event.organization.name}
                          </Link>
                        ) : (
                          event.organization.name
                        )}
                        .
                      </p>
                    </>
                  ) : (
                    <p className="flex flex-wrap items-center gap-3">
                      {/*
                      Linked when there is a slug to link to, plain text when
                      there is not. Building the href from the name would
                      produce a URL that looks right and 404s.
                    */}
                      {event.organization.slug ? (
                        <Link
                          href={`/organizers/${event.organization.slug}`}
                          className={`${TEXT_LINK} font-display text-h3`}
                        >
                          {event.organization.name}
                        </Link>
                      ) : (
                        <span className="font-display text-h3 font-bold text-ink">
                          {event.organization.name}
                        </span>
                      )}
                      {event.organization.verified ? (
                        <Badge variant="secondary" srLabel="Organiser status:">
                          <VerifiedIcon className="h-4 w-4" />
                          Verified organiser
                        </Badge>
                      ) : null}
                    </p>
                  )}
                  {event.organization.description && !imported ? (
                    <p className="mt-3 text-ink-muted">{event.organization.description}</p>
                  ) : null}
                </div>
              </section>
            ) : null}

            {/* Only while an administrator at The Desi Events has the link on and the
                page is public; the API sends no host otherwise. It goes through
                this site's redirect, never straight to the address. Never for
                an imported event: nothing on its page leads to another site. */}
            {imported ? null : (
              <EventWebsiteLink
                slug={event.slug}
                link={event.websiteLink ?? null}
                uncounted={uncounted}
              />
            )}

            <EventContact email={event.publicEmail} phone={event.publicPhone} />
            <EventSocialLinks links={event.socialLinks} />
            <EventSponsors items={event.sponsors} />

            {/*
              The refund rule first. It is the one a person needs when something
              has gone wrong, and burying it under entry conditions is how a
              policy block becomes decoration.
            */}
            {policies.refund || policies.entry || policies.conduct ? (
              <section aria-labelledby="policies-heading">
                <h2 id="policies-heading" className="text-h2 text-ink">
                  Policies
                </h2>
                <dl className="mt-5 divide-y divide-line border-t-2 border-ink">
                  {policies.refund ? (
                    <div className="grid grid-cols-1 gap-1 py-4 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-6">
                      <dt className="font-bold text-ink">Refunds</dt>
                      <dd className="text-ink">{policies.refund}</dd>
                    </div>
                  ) : null}
                  {policies.entry ? (
                    <div className="grid grid-cols-1 gap-1 py-4 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-6">
                      <dt className="font-bold text-ink">Getting in</dt>
                      <dd className="text-ink">{policies.entry}</dd>
                    </div>
                  ) : null}
                  {policies.conduct ? (
                    <div className="grid grid-cols-1 gap-1 py-4 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-6">
                      <dt className="font-bold text-ink">House rules</dt>
                      <dd className="text-ink">{policies.conduct}</dd>
                    </div>
                  ) : null}
                </dl>
                <p className="mt-5 text-sm text-ink-muted">
                  These are the terms as they stand now. The set in force for an order is the set
                  copied onto it when it was placed, so a later edit cannot change what you agreed
                  to.
                </p>
              </section>
            ) : null}
          </div>

          <aside
            id="tickets"
            aria-labelledby="tickets-heading"
            className="scroll-mt-24 lg:sticky lg:top-24"
          >
            <div className="overflow-hidden rounded-card border border-line-strong bg-surface-raised">
              <div className="p-6">
                <div className="flex items-center justify-between gap-3">
                  <h2 id="tickets-heading" className="text-h2 text-ink">
                    Tickets
                  </h2>
                  {buyable ? (
                    <AvailabilityChip availability={{ tone: 'open', label: 'On sale' }} />
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-ink-subtle">
                  {formatEventWhen({ ...event, endsAt: shownEndsAt })}
                  {zoneLabel ? ` ${zoneLabel}` : ''}
                </p>

                {ticketTypes.length === 0 ? (
                  <p className="mt-5 text-ink-muted">
                    {imported
                      ? 'No tickets for this event are on sale here yet.'
                      : 'The organiser has not put any tickets for this event on sale.'}
                  </p>
                ) : (
                  <>
                    <div className="mt-5 border-t border-line pt-5">
                      <TicketTiers
                        ticketTypes={ticketTypes}
                        place={place}
                        feeTerms={event.feeTerms ?? null}
                        timezone={event.timezone}
                        sessions={sessions}
                        eventSlug={BUYABLE_STATUSES.has(event.status) ? event.slug : null}
                        traffic={traffic}
                        countsShown={!imported}
                      />
                    </div>

                    {/* A note, not an alert: how this event can be paid for. */}
                    {event.venuePayment?.available ? (
                      <p className="mt-4 text-sm text-ink" data-testid="venue-payment-note">
                        {VENUE_PAYMENT_NOTE}
                      </p>
                    ) : null}

                    {cheapest ? (
                      <div className="mt-6 border-t-[1.5px] border-ink pt-5">
                        <p className="text-sm text-ink-muted">
                          From{' '}
                          <span className="font-display text-h3 font-bold text-ink">
                            {formatPrice(cheapest.priceCents, cheapest.currency)}
                          </span>
                        </p>

                        {/*
                          The all-in number, on the page, before the button. A face
                          value that becomes something else at the last step of
                          checkout is the practice this block exists to make
                          impossible to ship by accident.
                        */}
                        {allIn && allIn.allInCents !== cheapest.priceCents ? (
                          <p className="mt-1 text-sm text-ink-muted">
                            <span className="font-bold text-ink">
                              {formatPrice(allIn.allInCents, cheapest.currency)} all in
                            </span>
                            , including the {formatPrice(allIn.feesCents, cheapest.currency)}{' '}
                            booking fee
                            {allIn.taxCents > 0
                              ? ` and ${formatPrice(allIn.taxCents, cheapest.currency)} ${allIn.taxLabel}`
                              : ''}
                            .
                          </p>
                        ) : null}

                        {buyable ? (
                          <Link
                            href={`/events/${event.slug}/checkout`}
                            {...(traffic
                              ? trafficAttributes({
                                  kind: 'TICKETS_CLICK',
                                  ...traffic,
                                  placement: 'EVENT_PAGE',
                                })
                              : {})}
                            className={`${PRIMARY_LINK} mt-5 w-full`}
                          >
                            Choose tickets
                            <ArrowRightIcon className="h-4.5 w-4.5" />
                          </Link>
                        ) : (
                          /*
                            No link rather than a disabled-looking one. A button that
                            is styled dead but still navigates is the worst of both,
                            and a `<button disabled>` is a control that announces
                            itself to a screen reader and then does nothing. The
                            sentence says why, which is the part a person needs.
                          */
                          <p className="mt-5 rounded-control border border-line-strong bg-surface-subtle px-4 py-3 text-sm text-ink-muted">
                            {closedSentence}
                          </p>
                        )}
                      </div>
                    ) : soldOut ? (
                      <p className="mt-6 rounded-control border border-status-danger/25 bg-status-danger-soft p-4 text-sm text-status-danger">
                        Every tier has sold out. Tickets sometimes return when holds expire, so it
                        is worth looking again closer to the day.
                      </p>
                    ) : (
                      // Nothing to buy now, but not because it has gone: sales
                      // have not opened, have closed or are paused. The tiers
                      // above say which.
                      <p className="mt-6 rounded-control border border-line-strong bg-surface-subtle px-4 py-3 text-sm text-ink-muted">
                        {closedSentence}
                      </p>
                    )}
                  </>
                )}

                {/* Beside the checkout, for an imported event only: its
                    prices' provenance and "Reserve on WhatsApp". */}
                {imported ? (
                  <ImportedEventPanel
                    event={event}
                    importedFrom={imported}
                    reservable={reservableOnWhatsApp(event)}
                  />
                ) : null}

                <p className="mt-5 flex items-start gap-3 rounded-control bg-surface-subtle px-4 py-3 text-sm text-ink-muted">
                  <ShieldIcon className="mt-0.5 h-4.5 w-4.5 text-accent-strong" />
                  <span>
                    <strong className="font-bold text-ink">
                      Payments on this site are simulated.
                    </strong>{' '}
                    You will not be asked for a card.
                  </span>
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {showBuyBar ? <StickyBuyBar amount={heroPrice.amount} note={heroPrice.note} /> : null}

      {/* The page view, and the clicks on "Choose tickets" and "Choose seats". */}
      <TrafficScope view={traffic} />
    </article>
  )
}

/**
 * One fact in the schedule: an icon on a pink tile, the term, and the value.
 *
 * @param {object} props Component props.
 * @param {Function} props.Icon The icon component.
 * @param {string} props.term What the fact is.
 * @param {boolean} [props.wide] Spans both columns.
 * @param {ReactNode} props.children The value.
 * @returns {JSX.Element} The fact.
 */
function ScheduleFact({ Icon, term, wide = false, children }) {
  // The group a `<dl>` allows is one `<div>` holding the `<dt>` and `<dd>`
  // and nothing else, so the tile sits inside the term, positioned against the
  // group, rather than in a wrapper of its own — a wrapper made the list one
  // that assistive technology cannot read as terms and values.
  return (
    <div className={`relative min-h-11 min-w-0 pl-[3.625rem] ${wide ? 'sm:col-span-2' : ''}`}>
      <dt className="text-sm font-bold text-ink">
        <span
          aria-hidden="true"
          className="absolute top-0 left-0 flex h-11 w-11 items-center justify-center rounded-control bg-accent-soft text-accent-strong"
        >
          <Icon className="h-5 w-5" />
        </span>
        {term}
      </dt>
      <dd className="mt-0.5 text-[0.9375rem] leading-6 text-ink-muted">{children}</dd>
    </div>
  )
}
