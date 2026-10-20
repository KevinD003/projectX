/**
 * A single event on the listing's poster wall.
 *
 * The whole card is clickable but there is exactly one link in it: the title
 * link is stretched over the card with a pseudo-element. Wrapping the card in a
 * link instead would give a screen reader user one enormous link whose
 * accessible name is the entire card, and adding a second "View" link would
 * make every card appear twice in the links list.
 *
 * ## What a card says
 *
 * The poster (the organiser's approved cover, or the house poster with the
 * title, date and city lettered on it); then, in real text, the start in the
 * event's own zone with the zone's letters ("Sat, Oct 17 · 7:30 PM EDT"); the
 * title; the venue, and the city with its state or province ("Frisco, TX"),
 * or "Online"; who is putting it on; the category, said to a screen reader
 * (the poster carries its mark); the price one ticket starts at; and whether
 * tickets can be bought now. The price is all-in when the API sends it all-in
 * (the same figure checkout would charge for one ticket of the cheapest
 * tier) and is said to be before fees when it is not. Nothing is said about
 * how fast anything is selling: the summary carries no such fact.
 *
 * An event imported from an organiser's own listing (`importedFrom`) is sold
 * here like any other: its price slot and its availability come from its
 * ticket types, as every card's do. The only difference is whose name it
 * shows: the organiser the listing names, rather than the organisation of the
 * team at The Desi Events that holds it.
 *
 * One thing the design shows is not on a card, because a listing summary
 * does not carry it: the organiser's verified badge. The event's own page
 * shows it, from the full record. A badge inferred here would be an
 * endorsement nobody made.
 *
 * ## Motion
 *
 * Under a fine pointer the poster grows a little inside its own frame and the
 * title takes the accent; nothing lifts and nothing fades in. A click carries
 * the poster itself to the event page (`transitionName` on `EventArt`): the
 * same object moves and scales into the page's hero. Under reduced motion
 * neither happens.
 *
 * ## Counting a click
 *
 * Where a page passes `trafficPlacement` (the home page, the events list,
 * search results), the title link carries `data-traffic-*` attributes naming
 * the event, its organisation and the place. One listener on the page reads
 * them and sends a beacon when the card is clicked: no cookie, and the click is
 * counted without who made it. The card stays a server component. A card from
 * sample data carries none, because its event does not exist.
 *
 * @module components/listing-card
 */

import Link from 'next/link'

import { categoryLabel } from '../lib/catalog.js'
import { eventAvailability, startingPrice } from '../lib/event-availability.js'
import { formatEventStart, toDateTimeAttribute } from '../lib/format.js'
import { formatPrice } from '../lib/pricing.js'
import { trafficAttributes } from '../lib/traffic-client.js'
import { EventArt } from './event-art.jsx'

/**
 * The chip's look, per availability tone. Always with words; the dot is
 * decoration.
 *
 * On sale is the quiet one, a word in the open colour with no fill, because
 * most cards say it and a wall of filled pills is noise; closed (sold out,
 * paused, postponed, cancelled, finished) is the calm purple grey on its
 * tint, because a sold-out night is a fact rather than an alarm; "not on sale
 * now" is plain.
 */
const AVAILABILITY_CHIP = Object.freeze({
  open: 'text-availability-open',
  closed: 'bg-availability-closed-soft px-2.5 text-availability-closed',
  neutral: 'bg-surface-subtle px-2.5 text-ink-muted',
})

/** The dot inside each chip, in the chip's own colour. */
const AVAILABILITY_DOT = Object.freeze({
  open: 'bg-availability-open',
  closed: 'bg-availability-closed',
  neutral: 'bg-ink-muted',
})

/**
 * Whether tickets can be bought, in words.
 *
 * @param {object} props Component props.
 * @param {{tone: string, label: string}} props.availability What to say, from `eventAvailability`.
 * @returns {JSX.Element} The chip.
 */
export function AvailabilityChip({ availability }) {
  return (
    <span
      className={`inline-flex min-h-6 shrink-0 items-center gap-1.5 rounded-full text-caption font-bold whitespace-nowrap ${AVAILABILITY_CHIP[availability.tone]}`}
    >
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 rounded-full ${AVAILABILITY_DOT[availability.tone]}`}
      />
      <span className="sr-only">Availability: </span>
      {availability.label}
    </span>
  )
}

/**
 * Where an event is, as a card says it: the venue and the city with its state
 * or province ("Lamplight Expo Hall · Edison, NJ"), "Online" for a streamed
 * event, or that the venue is still to come.
 *
 * @param {object} event An event summary.
 * @returns {string} The place.
 */
export function placeOf(event) {
  if (event?.isOnline) return 'Online'

  const town = event?.city && event?.region ? `${event.city}, ${event.region}` : event?.city

  return [event?.venueName, town].filter(Boolean).join(' · ') || 'Venue to be announced'
}

/**
 * @typedef {object} EventCardProps
 * @property {object} event An event summary.
 * @property {'h2'|'h3'} [headingLevel] Heading element for the title. Pick the level that keeps the page outline correct.
 * @property {string} [className] Classes for the list item, for a grid that sizes its items itself.
 * @property {'HOME'|'LISTING'|'SEARCH'|null} [trafficPlacement] Where the card is shown, so a click on it is counted; null counts nothing.
 * @property {boolean} [shared] Carry the poster to the event page as one object. Once per event per page.
 */

/**
 * An event card, rendered as a list item.
 *
 * @param {EventCardProps} props Component props.
 * @returns {JSX.Element} The rendered card.
 */
export function EventCard({
  event,
  headingLevel: Heading = 'h3',
  className = '',
  trafficPlacement = null,
  shared = false,
}) {
  const imported = event.importedFrom ?? null
  const price = startingPrice(event, formatPrice)
  const availability = eventAvailability(event)
  const free = price.amount === 'Free'
  const organiser = imported?.presentedBy || event.organizationName

  return (
    <li className={`flex min-w-0 ${className}`}>
      <article className="group relative flex w-full min-w-0 flex-col gap-3 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-4 has-[:focus-visible]:outline-focus">
        <div className="relative overflow-hidden rounded-plate bg-surface-subtle">
          <div className="transition-transform duration-(--duration-slow) ease-out motion-safe:pointer-fine:group-hover:scale-[1.03]">
            <EventArt event={event} variant="poster" transitionName={shared} />
          </div>
          {event.isOnline ? (
            <span className="absolute top-2 right-2 inline-flex min-h-6 items-center rounded-full bg-surface-raised px-2.5 text-caption font-bold text-accent-secondary">
              Online
            </span>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <p className="text-caption font-bold tracking-caps text-accent-strong uppercase sm:text-label sm:normal-case sm:tracking-normal">
            <time dateTime={toDateTimeAttribute(event.startsAt)}>{formatEventStart(event)}</time>
          </p>

          <Heading className="mt-1 text-title font-bold text-ink [overflow-wrap:anywhere] sm:text-h3">
            <Link
              href={`/events/${event.slug}`}
              {...(trafficPlacement
                ? trafficAttributes({
                    kind: 'CARD_CLICK',
                    eventId: event.id,
                    organizationId: event.organizationId,
                    placement: trafficPlacement,
                  })
                : {})}
              className="transition-colors duration-(--duration-fast) group-hover:text-accent-strong after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
            >
              {event.title}
            </Link>
          </Heading>

          <p className="mt-1.5 text-caption text-ink-muted sm:text-label">
            <span className="sr-only">Where: </span>
            {placeOf(event)}
          </p>

          {organiser ? (
            <p className="mt-0.5 text-caption text-ink-subtle sm:text-label">
              <span className="sr-only">Organiser: </span>
              <span>{organiser}</span>
            </p>
          ) : null}

          <div className="mt-auto flex flex-wrap items-end justify-between gap-x-3 gap-y-1 pt-3">
            <span className="sr-only">
              <span>Category:</span> {categoryLabel(event.category)}
            </span>
            {availability ? <AvailabilityChip availability={availability} /> : null}
            <p className="order-first min-w-0 text-caption text-ink-subtle">
              {!free && (price.qualifier || price.allIn) ? <span>From </span> : null}
              <span className="text-title font-bold text-ink tabular-nums">{price.amount}</span>
              {price.qualifier ? <span className="block">{price.qualifier}</span> : null}
            </p>
          </div>
        </div>
      </article>
    </li>
  )
}

/**
 * @typedef {object} EventGridProps
 * @property {object[]} events Event summaries to render.
 * @property {string} label Accessible name for the list, e.g. `Matching events`.
 * @property {'h2'|'h3'} [headingLevel] Heading element used inside each card.
 * @property {'HOME'|'LISTING'|'SEARCH'|null} [trafficPlacement] Where the grid is shown, passed to every card; null counts nothing.
 * @property {boolean} [shared] Carry each poster to its event page as one object.
 */

/**
 * The poster wall: two posters across on a phone, three on a tablet, four on
 * a desk.
 *
 * It is a `ul` so that assistive technology announces how many events there
 * are before the visitor starts reading them.
 *
 * @param {EventGridProps} props Component props.
 * @returns {JSX.Element} The rendered wall.
 */
export function EventGrid({
  events,
  label,
  headingLevel = 'h3',
  trafficPlacement = null,
  shared = false,
}) {
  return (
    <ul
      aria-label={label}
      className="grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 sm:gap-x-6 sm:gap-y-12 xl:grid-cols-4"
    >
      {events.map((event) => (
        <EventCard
          key={event.id ?? event.slug}
          event={event}
          headingLevel={headingLevel}
          trafficPlacement={trafficPlacement}
          shared={shared}
        />
      ))}
    </ul>
  )
}
