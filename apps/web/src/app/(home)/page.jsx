/**
 * The home page: what is on this weekend, where, and how to find the rest.
 *
 * The first screen is a purple plate: the headline, one line of copy and the
 * search on the left, and on the right the next event's own poster, which
 * prints itself into register as the page arrives. Straight under it, the
 * agenda: this weekend's events as a dated list (or, on a quiet weekend, the
 * soonest ones), then the cities as a short index with every city a click
 * away, the kinds of night, how booking works here, and a word for
 * organisers.
 *
 * Rendered per request because ticket availability changes by the minute and a
 * cached "on sale" badge on a sold-out night is worse than a slower page.
 *
 * ## Everything on it is read, not written in
 *
 * The agenda is the soonest events on the listing. The cities and their
 * numbers are the facets the API counted in the database, grouped by the time
 * zone their events are held in; the categories are the ones that have
 * something listed. The hero's poster is the next event's own. Where a figure
 * cannot be read (the facets failed, the listing is empty) the page leaves it
 * out rather than showing a zero or a guess.
 *
 * ## For search engines
 *
 * The page is canonical at `/`. It carries the company's `Organization` (its
 * name, website, logo, email, telephone and social profiles, from
 * `lib/contact.js`) and the site as a `WebSite` whose search is the listing's
 * own, both through the `JsonLd` component like every other block on the site.
 *
 * ## Motion
 *
 * One moment: the poster's plates slide into register once. The search panel
 * settles in with the theme's CSS entrance; nothing else moves, and under
 * reduced motion nothing does.
 *
 * @module app/home/page
 */

import Link from 'next/link'

import { CategoryGrid } from '../../components/category-grid.jsx'
import { ArrowRightIcon, SearchIcon } from '../../components/icons.jsx'
import { PRIMARY_LINK, SECONDARY_LINK, TEXT_LINK } from '../../components/link-classes.js'
import { AvailabilityChip, placeOf } from '../../components/listing-card.jsx'
import { FadeIn } from '../../components/motion.jsx'
import { EventArt } from '../../components/event-art.jsx'
import { JsonLd } from '../../components/json-ld.jsx'
import { SampleDataNotice } from '../../components/sample-data-notice.jsx'
import { TrafficScope } from '../../components/traffic-scope.jsx'
import { Input, Select } from '../../components/ui.jsx'
import { loadCatalogueFacets, loadCatalogueOverview } from '../../lib/api.js'
import { describeCategories } from '../../lib/catalog.js'
import { organizationJsonLd } from '../../lib/contact.js'
import { eventAvailability, startingPrice } from '../../lib/event-availability.js'
import { formatEventStart, formatEventTime, toDateTimeAttribute } from '../../lib/format.js'
import {
  groupCitiesByZone,
  homeAgenda,
  notYetOver,
  organisersWithNext,
  topCities,
  weekendDates,
} from '../../lib/home-sections.js'
import { formatPrice } from '../../lib/pricing.js'
import { buildEventsHref } from '../../lib/search-params.js'
import { websiteJsonLd } from '../../lib/site-seo.js'
import { trafficAttributes } from '../../lib/traffic-client.js'

export const dynamic = 'force-dynamic'

/**
 * The home page is the site's own front door: canonical at `/`, titled by the
 * root layout's default.
 */
export const metadata = { alternates: { canonical: '/' } }

/** Where this deployment is served from, for the logo's absolute address. Mirrors the root layout. */
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://127.0.0.1:3000'

/** How many events the agenda lists. */
const AGENDA_LENGTH = 8

/** How many cities the short index names before "every city". */
const TOP_CITIES = 12

/** A search-panel label: sentence case, above its control. */
const FIELD_LABEL = 'text-caption font-semibold text-ink-muted'

/**
 * The three steps of booking here. The third says, in its own words, that
 * payment is simulated: it is the step where somebody would otherwise expect
 * to hand over a card.
 */
const STEPS = Object.freeze([
  {
    title: 'Find it',
    body: 'Browse by city or kind of night, or search for an event, a venue or an organiser. A price says whether the booking fee is in it.',
  },
  {
    title: 'Reserve it',
    body: 'Pick your tickets and we hold them while you check out, until the time on the notice. Tickets live in your account, so booking needs one.',
  },
  {
    title: 'Pay (simulated)',
    lead: 'Payments on this site are simulated. No card is charged and no money moves.',
    body: 'Your tickets land in My tickets straight away.',
  },
])

/**
 * A day as the agenda heads it, in its own zone: "Friday" and "23 Oct".
 *
 * @param {object} event The day's first event.
 * @returns {{weekday: string, day: string, month: string}} The parts.
 */
function dayParts(event) {
  const start = new Date(event.startsAt)
  const timeZone = event.timezone ?? 'America/New_York'
  const part = (options) => new Intl.DateTimeFormat('en-US', { ...options, timeZone }).format(start)

  return {
    weekday: part({ weekday: 'short' }),
    day: part({ day: 'numeric' }),
    month: part({ month: 'short' }),
  }
}

/**
 * This weekend's dates as a heading's second line: "Fri 23 to Sun 25 Oct".
 *
 * @param {number} now The moment.
 * @returns {string|null} The span, or null.
 */
function weekendSpan(now) {
  const dates = weekendDates(now, 'America/New_York')

  if (!dates) return null

  const say = (date, options) =>
    new Intl.DateTimeFormat('en-US', { ...options, timeZone: 'UTC' }).format(
      new Date(`${date}T12:00:00Z`),
    )
  const from = `${say(dates.from, { weekday: 'short' })} ${say(dates.from, { day: 'numeric' })}`
  const to = `${say(dates.to, { weekday: 'short' })} ${say(dates.to, { day: 'numeric' })}`

  return dates.from === dates.to
    ? `${from} ${say(dates.to, { month: 'short' })}`
    : `${from} to ${to} ${say(dates.to, { month: 'short' })}`
}

/**
 * The search panel: a city and a query, sent to the listing as a plain GET, so
 * it works before any JavaScript arrives and leaves a URL somebody can share.
 *
 * @param {object} props Component props.
 * @param {string[]} props.cities Every listed city, from the facets.
 * @returns {JSX.Element} The form.
 */
function HeroSearch({ cities }) {
  return (
    <form
      action="/events"
      method="get"
      role="search"
      aria-label="Find events"
      className="grid grid-cols-1 gap-3 rounded-card bg-surface-raised p-3 text-ink shadow-floating sm:grid-cols-[minmax(0,1fr)_minmax(0,11rem)_auto] sm:items-end"
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="home-q" className={FIELD_LABEL}>
          What
        </label>
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3.5 h-5 w-5 -translate-y-1/2 text-ink-subtle" />
          <Input
            id="home-q"
            type="search"
            name="q"
            placeholder="Event, venue or organiser"
            autoComplete="off"
            className="h-12 pl-11"
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="home-city" className={FIELD_LABEL}>
          City
        </label>
        <Select
          id="home-city"
          name="city"
          defaultValue=""
          className="h-12 font-semibold"
          options={[
            { value: '', label: 'All cities' },
            ...cities.map((city) => ({ value: city, label: city })),
          ]}
        />
      </div>
      <button
        type="submit"
        className="inline-flex h-12 items-center justify-center gap-2 rounded-control bg-action-primary px-6 text-base font-bold text-action-primary-ink transition duration-(--duration-fast) ease-standard hover:bg-action-primary-hover motion-safe:active:scale-[0.98]"
      >
        Find events
        <ArrowRightIcon className="h-4.5 w-4.5" />
      </button>
    </form>
  )
}

/**
 * The next event, as the hero shows it: its poster, printed into register,
 * and under it a line that says when and where and leads to its page. The
 * link covers the poster too.
 *
 * A click on its link is counted as a click on the event's card on the home
 * page when `counted` is set; never for sample data, whose events do not exist.
 *
 * @param {object} props Component props.
 * @param {object} props.event The next event on the listing.
 * @param {boolean} [props.counted] Whether a click on it is counted.
 * @returns {JSX.Element} The figure.
 */
function NextUp({ event, counted = false }) {
  return (
    <div className="group relative mx-auto w-full max-w-md lg:mx-0 lg:ml-auto">
      <div className="overflow-hidden rounded-plate shadow-floating">
        <EventArt
          event={event}
          variant="hero"
          priority
          registration
          transitionName
          sizes="(min-width: 1024px) 28rem, (min-width: 640px) 28rem, 100vw"
        />
      </div>
      <p className="mt-4 flex flex-col gap-1">
        <Link
          href={`/events/${event.slug}`}
          {...(counted
            ? trafficAttributes({
                kind: 'CARD_CLICK',
                eventId: event.id,
                organizationId: event.organizationId,
                placement: 'HOME',
              })
            : {})}
          className="text-title font-bold text-ink-inverse after:absolute after:inset-0 after:content-[''] group-hover:underline group-hover:underline-offset-4"
        >
          <span className="text-accent-inverse">
            Next up<span className="sr-only">:</span>
          </span>{' '}
          {event.title}
        </Link>
        <span className="text-label text-ink-inverse-muted">
          <time dateTime={toDateTimeAttribute(event.startsAt)}>{formatEventStart(event)}</time>
          {event.city ? ` · ${event.city}` : ''}
        </span>
      </p>
    </div>
  )
}

/**
 * The home hero on the purple plate.
 *
 * @param {object} props Component props.
 * @param {string[]} props.cities Every listed city.
 * @param {object|null} props.lead The soonest event, for the poster.
 * @param {boolean} [props.counted] Whether a click on the poster's link is counted.
 * @returns {JSX.Element} The hero.
 */
function Hero({ cities, lead, counted = false }) {
  return (
    <section
      aria-labelledby="hero-heading"
      className="relative isolate bg-surface-inverse text-ink-inverse"
    >
      <div className="mx-auto grid max-w-content grid-cols-1 gap-12 px-4 pt-12 pb-14 sm:px-6 sm:pt-16 lg:grid-cols-12 lg:items-center lg:gap-10 lg:pt-16 lg:pb-20">
        <div className="min-w-0 lg:col-span-7">
          <h1 id="hero-heading" className="max-w-[14ch] text-display text-ink-inverse">
            Plans for the weekend, sorted.
          </h1>
          <p className="mt-6 max-w-xl text-body text-ink-inverse-muted sm:text-[1.1875rem] sm:leading-8">
            Concerts, stand-up, garba, Durga Puja, Diwali melas and Bollywood nights across the USA
            and Canada. Search for what you feel like, and see the full price before you book.
          </p>
          <FadeIn delay={0.08} className="mt-8 max-w-2xl">
            <HeroSearch cities={cities} />
          </FadeIn>
        </div>

        {lead ? (
          <div className="min-w-0 lg:col-span-5">
            <NextUp event={lead} counted={counted} />
          </div>
        ) : null}
      </div>
    </section>
  )
}

/**
 * One row of the agenda: the day (on the day's first row), the time, the
 * title, the place and the price.
 *
 * @param {object} props Component props.
 * @param {object} props.event The event.
 * @param {boolean} props.firstOfDay Whether this row opens its day.
 * @param {boolean} props.counted Whether a click is counted.
 * @returns {JSX.Element} The row.
 */
function AgendaRow({ event, firstOfDay, counted }) {
  const day = dayParts(event)
  const price = startingPrice(event, formatPrice)
  const availability = eventAvailability(event)
  const imported = event.importedFrom ?? null
  const organiser = imported?.presentedBy || event.organizationName
  const place = placeOf(event)

  return (
    <li className={firstOfDay ? 'border-t-2 border-ink' : 'border-t border-line'}>
      <article className="group relative grid grid-cols-[3.5rem_minmax(0,1fr)] gap-x-4 py-5 sm:grid-cols-[5.5rem_4.5rem_minmax(0,1fr)_auto] sm:gap-x-6 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus">
        <div aria-hidden="true" className="row-span-2 sm:row-span-1">
          {firstOfDay ? (
            <p className="flex flex-col leading-none">
              <span className="text-caption font-bold tracking-caps text-accent-strong uppercase">
                {day.weekday}
              </span>
              <span className="mt-1 font-display text-h1 leading-[0.9] font-extrabold text-ink tabular-nums [font-stretch:75%]">
                {day.day}
              </span>
              <span className="text-caption font-semibold text-ink-muted uppercase">
                {day.month}
              </span>
            </p>
          ) : null}
        </div>

        <div aria-hidden="true" className="hidden sm:block">
          <div className="overflow-hidden rounded-plate">
            <EventArt event={event} variant="poster" decorative sizes="72px" />
          </div>
        </div>

        <div className="min-w-0">
          <p className="text-label font-bold text-accent-strong tabular-nums">
            <time dateTime={toDateTimeAttribute(event.startsAt)}>
              <span className="sr-only">{formatEventStart(event)}</span>
              <span aria-hidden="true">{formatEventTime(event.startsAt, event.timezone)}</span>
            </time>
          </p>
          <h3 className="mt-0.5 text-h3 text-ink [overflow-wrap:anywhere]">
            <Link
              href={`/events/${event.slug}`}
              {...(counted
                ? trafficAttributes({
                    kind: 'CARD_CLICK',
                    eventId: event.id,
                    organizationId: event.organizationId,
                    placement: 'HOME',
                  })
                : {})}
              className="transition-[color,font-stretch] duration-(--duration-base) ease-out group-hover:text-accent-strong after:absolute after:inset-0 after:content-[''] focus-visible:outline-none motion-safe:pointer-fine:group-hover:[font-stretch:100%]"
            >
              {event.title}
            </Link>
          </h3>
          <p className="mt-1 text-label text-ink-muted">
            <span className="sr-only">Where: </span>
            {place}
            {organiser ? (
              <span className="text-ink-subtle">
                <span aria-hidden="true"> · </span>
                <span className="sr-only">Organiser: </span>
                {organiser}
              </span>
            ) : null}
          </p>
        </div>

        <div className="col-start-2 mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 sm:col-start-auto sm:mt-0 sm:flex-col sm:items-end sm:justify-center sm:text-right">
          <p className="text-caption text-ink-subtle">
            {price.amount !== 'Free' && (price.qualifier || price.allIn) ? (
              <span>From </span>
            ) : null}
            <span className="text-title font-bold text-ink tabular-nums">{price.amount}</span>
          </p>
          {availability ? <AvailabilityChip availability={availability} /> : null}
        </div>
      </article>
    </li>
  )
}

/**
 * The agenda: this weekend, or what is next, as a dated list.
 *
 * @param {object} props Component props.
 * @param {object} props.agenda From `homeAgenda`.
 * @param {boolean} props.counted Whether a click is counted.
 * @param {number} props.now The moment the page is drawn for.
 * @returns {JSX.Element} The section.
 */
function Agenda({ agenda, counted, now }) {
  const weekend = agenda.kind === 'weekend'
  const span = weekend ? weekendSpan(now) : null

  return (
    <section
      aria-labelledby="agenda-heading"
      className="mx-auto max-w-content px-4 pt-14 pb-16 sm:px-6 lg:pt-20 lg:pb-24"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="agenda-heading" className="text-h1 text-ink">
            {weekend ? 'This weekend' : 'Coming up'}
          </h2>
          <p className="mt-2 text-body text-ink-muted">
            {weekend
              ? `${span ? `${span}. ` : ''}Times are the venue’s own.`
              : 'The soonest events on the listing. Times are the venue’s own.'}
          </p>
        </div>
        <Link href="/events" className={`${SECONDARY_LINK} shrink-0 self-start sm:self-auto`}>
          See all events
          <ArrowRightIcon className="h-4.5 w-4.5" />
        </Link>
      </div>

      <div className="mt-8">
        {agenda.events.length > 0 ? (
          <ul aria-label="Upcoming events" className="border-b border-line">
            {agenda.days.flatMap((day) =>
              day.events.map((event, index) => (
                <AgendaRow
                  key={event.id ?? event.slug}
                  event={event}
                  firstOfDay={index === 0}
                  counted={counted}
                />
              )),
            )}
          </ul>
        ) : (
          <p className="rounded-card bg-surface-subtle p-6 text-ink-muted">
            Nothing is listed right now. The listing fills up as organisers publish their events.
          </p>
        )}
        {weekend ? (
          <Link
            href={buildEventsHref({ when: 'weekend' })}
            className={`${TEXT_LINK} mt-4 inline-flex min-h-11 items-center gap-2`}
          >
            Everything on this weekend
            <ArrowRightIcon className="h-4.5 w-4.5" />
          </Link>
        ) : null}
      </div>
    </section>
  )
}

/**
 * The cities: the busiest dozen set large, and every city, by time zone,
 * behind one disclosure.
 *
 * @param {object} props Component props.
 * @param {Array<{city: string, count: number}>} props.top The short index.
 * @param {Array<object>} props.groups Every city, by zone.
 * @param {number} props.total How many cities.
 * @param {number} props.zones How many named time zones.
 * @returns {JSX.Element} The section.
 */
function Cities({ top, groups, total, zones }) {
  return (
    <section aria-labelledby="cities-heading" className="border-t border-line bg-surface-subtle">
      <div className="mx-auto max-w-content px-4 py-16 sm:px-6 lg:py-24">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[18rem_minmax(0,1fr)] lg:gap-14">
          <div>
            <h2 id="cities-heading" className="text-h2 text-ink">
              Where it’s on
            </h2>
            <p className="mt-3 text-label text-ink-muted">
              {total} {total === 1 ? 'city' : 'cities'}
              {zones > 1 ? ` across ${zones} time zones` : ''}. The number is how many events each
              city has listed.
            </p>
          </div>

          <div className="min-w-0">
            {top.length > 0 ? (
              <ul
                aria-label="Cities with the most events"
                className="flex flex-wrap items-baseline gap-x-6 gap-y-2 sm:gap-x-8"
              >
                {top.map(({ city, count }) => (
                  <li key={city}>
                    <Link
                      href={buildEventsHref({ city })}
                      className="inline-flex min-h-11 items-baseline gap-1 font-display text-h2 font-bold text-ink [font-stretch:80%] hover:text-accent-strong hover:underline hover:decoration-2 hover:underline-offset-6"
                    >
                      {city}
                      <span className="font-sans text-caption font-bold text-accent-strong tabular-nums">
                        {count}
                        <span className="sr-only">
                          {' '}
                          {count === 1 ? 'event listed' : 'events listed'}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}

            <details className="group/cities mt-8 border-t border-line pt-4">
              <summary className="flex min-h-11 w-fit cursor-pointer list-none items-center gap-2 rounded-control font-bold text-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus [&::-webkit-details-marker]:hidden">
                <ArrowRightIcon className="h-4.5 w-4.5 transition-transform duration-(--duration-fast) ease-out group-open/cities:rotate-90" />
                Every city, by time zone
              </summary>
              <div className="mt-4 flex flex-col gap-6">
                {groups.map((group) => (
                  <div key={group.key}>
                    <p className="text-label font-bold text-ink">
                      {group.name}
                      {group.short ? (
                        <span className="font-normal text-ink-subtle"> · {group.short}</span>
                      ) : null}
                    </p>
                    <ul
                      aria-label={`Cities in ${group.name}`}
                      className="mt-2 columns-2 gap-x-6 sm:columns-3 lg:columns-4"
                    >
                      {group.cities.map(({ city, count }) => (
                        <li key={city} className="break-inside-avoid">
                          <Link
                            href={buildEventsHref({ city })}
                            className="inline-flex min-h-9 items-center gap-1.5 text-label text-ink hover:text-accent-strong hover:underline hover:underline-offset-4 pointer-coarse:min-h-11"
                          >
                            {city}{' '}
                            {count !== null ? (
                              <span className="text-caption text-ink-subtle tabular-nums">
                                {count}{' '}
                                <span className="sr-only">
                                  {count === 1 ? 'event listed' : 'events listed'}
                                </span>
                              </span>
                            ) : null}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </details>
          </div>
        </div>
      </div>
    </section>
  )
}

/**
 * The home page.
 *
 * @returns {Promise<JSX.Element>} The rendered page.
 */
export default async function HomePage() {
  const [overview, facetResult] = await Promise.all([
    loadCatalogueOverview(),
    loadCatalogueFacets(),
  ])

  const { events } = overview
  const { facets } = facetResult
  const usedFallback = overview.usedFallback || facetResult.usedFallback
  const counted = !overview.usedFallback
  const now = Date.now()

  // "This weekend", "coming up" and "next" are claims about the date, so they
  // are made only of events that have not finished.
  const upcoming = notYetOver(events, now)
  const agenda = homeAgenda(events, { now, limit: AGENDA_LENGTH })
  const lead = upcoming[0] ?? null
  const categories = describeCategories(facets.categories)
  const cityNames = (facets.cities ?? [])
    .map((entry) => entry.value)
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right))
  const cityGroups = groupCitiesByZone(facets.cities, events)
  const zoneCount = cityGroups.filter((group) => group.key !== 'other').length
  const organisers = organisersWithNext(upcoming)
  // The next event of each kind, for the category index: the first of each
  // category among the soonest the page loaded.
  const nextOfEachKind = {}

  for (const event of upcoming) {
    nextOfEachKind[event.category] ??= event
  }

  return (
    <div>
      <JsonLd data={organizationJsonLd(siteUrl)} />
      <JsonLd data={websiteJsonLd(siteUrl)} />
      <Hero cities={cityNames} lead={lead} counted={counted} />

      {usedFallback ? (
        <div className="mx-auto max-w-content px-4 sm:px-6">
          <SampleDataNotice show />
        </div>
      ) : null}

      <Agenda agenda={agenda} counted={counted} now={now} />

      {cityGroups.length > 0 ? (
        <Cities
          top={topCities(facets.cities, TOP_CITIES)}
          groups={cityGroups}
          total={cityNames.length}
          zones={zoneCount}
        />
      ) : null}

      {categories.length > 0 ? (
        <section
          aria-labelledby="categories-heading"
          className="mx-auto max-w-content px-4 py-16 sm:px-6 lg:py-24"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <h2 id="categories-heading" className="text-h2 text-ink">
              Pick your kind of night
            </h2>
            <Link
              href="/categories"
              className={`${TEXT_LINK} inline-flex min-h-11 shrink-0 items-center gap-2`}
            >
              Every category
              <ArrowRightIcon className="h-4.5 w-4.5" />
            </Link>
          </div>
          <div className="mt-8">
            <CategoryGrid
              categories={categories}
              next={nextOfEachKind}
              trafficPlacement={counted ? 'HOME' : null}
            />
          </div>
        </section>
      ) : null}

      <section aria-labelledby="how-heading" className="border-t border-line">
        <div className="mx-auto max-w-content px-4 py-16 sm:px-6 lg:py-24">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[18rem_minmax(0,1fr)] lg:gap-14">
            <div>
              <h2 id="how-heading" className="text-h2 text-ink">
                How booking works
              </h2>
              <p className="mt-3 text-label text-ink-muted">
                Tickets sold here are priced in US dollars, or Canadian dollars at a venue in
                Canada. US sales tax is not calculated in this demo, so checkout shows it as $0.00.
              </p>
            </div>
            <ol className="grid grid-cols-1 gap-8 md:grid-cols-3 md:gap-0 md:divide-x md:divide-line">
              {STEPS.map((step, index) => (
                <li key={step.title} className="md:px-8 md:first:pl-0 md:last:pr-0">
                  <p
                    aria-hidden="true"
                    className="font-display text-h1 leading-none font-extrabold text-accent-strong tabular-nums [font-stretch:75%]"
                  >
                    {index + 1}
                  </p>
                  <h3 className="mt-3 text-h3 text-ink">{step.title}</h3>
                  <p className="mt-2 text-label leading-6 text-ink-muted">
                    {step.lead ? (
                      <strong className="font-bold text-ink">{step.lead} </strong>
                    ) : null}
                    {step.body}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section aria-labelledby="organisers-heading" className="bg-surface-subtle">
        <div className="mx-auto grid max-w-content grid-cols-1 gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-16 lg:py-24">
          <div>
            <h2 id="organisers-heading" className="text-h1 text-ink">
              Putting on a night?
            </h2>
            <p className="mt-5 max-w-2xl text-body text-ink-muted">
              Organisers join The Desi Events by invitation from the team at The Desi Events, and
              every event is reviewed by the team before it is published. There is no sign-up form
              for organisers on this site. If the team has sent you an organiser invitation code,
              enter it from your account. Then list your events with their venues, dates and ticket
              tiers, and run the sales, the orders and the door from the organiser workspace.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
              <Link href="/organizer" className={PRIMARY_LINK}>
                Open the organiser workspace
                <ArrowRightIcon className="h-4.5 w-4.5" />
              </Link>
              <Link
                href="/account/organizations/new"
                className={`${TEXT_LINK} inline-flex min-h-11 items-center`}
              >
                Accept an organiser invitation
              </Link>
              <Link
                href="/limitations"
                className={`${TEXT_LINK} inline-flex min-h-11 items-center`}
              >
                What this site does not do
              </Link>
            </div>
          </div>

          {organisers.length > 0 ? (
            <div className="min-w-0">
              <h3 className="text-label font-bold text-ink">Organisers with events coming up</h3>
              <ul className="mt-3 border-t border-line">
                {organisers.map(({ name, slug, next }) => (
                  <li key={slug} className="border-b border-line">
                    <Link
                      href={`/organizers/${encodeURIComponent(slug)}`}
                      className="group flex min-h-11 items-center gap-3 py-3"
                    >
                      <span
                        aria-hidden="true"
                        className="w-10 shrink-0 overflow-hidden rounded-plate"
                      >
                        <EventArt event={next} variant="poster" decorative sizes="40px" />
                      </span>
                      <span className="flex min-w-0 flex-col">
                        <span className="text-label font-bold text-ink group-hover:text-accent-strong group-hover:underline group-hover:underline-offset-4">
                          {name}
                        </span>
                        <span className="truncate text-caption text-ink-subtle">
                          Next:{' '}
                          <time dateTime={toDateTimeAttribute(next.startsAt)}>
                            {formatEventStart(next)}
                          </time>
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <Link
                href="/organizers"
                className={`${TEXT_LINK} mt-3 inline-flex min-h-11 items-center gap-2 text-label`}
              >
                Every organiser
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
            </div>
          ) : null}
        </div>
      </section>

      {/* Counts clicks on the agenda and the next-up poster; a signed-in
          organiser's own events and staff at The Desi Events are left out. */}
      <TrafficScope />
    </div>
  )
}
