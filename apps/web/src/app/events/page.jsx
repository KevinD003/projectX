/**
 * The event listing: the poster wall, filtered by category, state or province
 * and city, free text, and (behind "More filters") when, language, format,
 * price and whether tickets are on sale.
 *
 * This is the one page the site allows a wall of posters: the content is a
 * list of events and the poster is how each one is recognised. Two across on
 * a phone, four on a desk, each the event's own house poster or approved
 * cover, and each carried to the event's page as one object when it is
 * followed.
 *
 * ## For search engines
 *
 * The listing itself is canonical at `/events`. A filtered, searched or
 * later page is a view of it: it points its canonical there and asks not to
 * be indexed, while its links are still followed, so every event is found and
 * no filter combination competes with the listing.
 *
 * All filter state lives in the query string, so the server renders the right
 * results on the first response, the back button behaves, and a filtered view
 * can be shared as a link. `searchParams` is a promise in the App Router and
 * must be awaited before it is read.
 *
 * @module app/events/page
 */

import Link from 'next/link'
import { EmptyState } from '../../components/ui.jsx'

import { listingRobots } from '../../lib/site-seo.js'

import { loadCatalogueFacets, loadEventList } from '../../lib/api.js'
import { describeCategories } from '../../lib/catalog.js'
import {
  buildEventsHref,
  citiesFor,
  hasActiveFilters,
  parseEventFilters,
  reconcileFilters,
  regionValue,
  withChosenOptions,
} from '../../lib/search-params.js'
import { ArrowLeftIcon, ArrowRightIcon, SearchIcon } from '../../components/icons.jsx'
import { PRIMARY_LINK_SMALL, SECONDARY_LINK } from '../../components/link-classes.js'
import { EventFilters } from '../../components/listing-filters.jsx'
import { EventGrid } from '../../components/listing-card.jsx'
import { Breadcrumbs } from '../../components/page-state.jsx'
import { PageHero } from '../../components/page-hero.jsx'
import { SampleDataNotice } from '../../components/sample-data-notice.jsx'
import { TrafficScope } from '../../components/traffic-scope.jsx'

export const dynamic = 'force-dynamic'

/** What a search engine is told about the listing. */
const DESCRIPTION =
  'Concerts, comedy, garba, Durga Puja, Diwali melas, Bollywood nights and more across the USA and Canada. Filter by category, state or province, city, date, language or price, or search.'

/**
 * The listing's metadata: canonical at `/events`, and a filtered or later
 * page kept out of the index while its links are followed.
 *
 * @param {EventsPageProps} props Route props.
 * @returns {Promise<object>} The metadata.
 */
export async function generateMetadata({ searchParams }) {
  return {
    title: 'All events',
    description: DESCRIPTION,
    alternates: { canonical: '/events' },
    ...listingRobots(await searchParams),
  }
}

/** How a "When" choice reads in the summary sentence. */
const WHEN_PHRASES = Object.freeze({
  today: 'today',
  weekend: 'this weekend',
  week: 'this week',
  month: 'this month',
})

/**
 * Where the summary says the events are: the city with its state's code, the
 * city alone, or the state's name.
 *
 * @param {object} filters Active filters.
 * @param {object|null} region The chosen state's facet, when one is chosen.
 * @returns {string} ` in Frisco, TX`, ` in Texas`, or an empty string.
 */
function placePhrase(filters, region) {
  if (filters.city && region) return ` in ${filters.city}, ${region.region}`
  if (filters.city) return ` in ${filters.city}`
  if (region) return ` in ${region.name}`

  return ''
}

/**
 * A chosen day as the summary says it.
 *
 * The day is a calendar day, not an instant, so it is written in UTC: the
 * same day on the server and in every browser.
 *
 * @param {string} day `YYYY-MM-DD`.
 * @returns {string} `Oct 17, 2026`.
 */
function dayLabel(day) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${day}T00:00:00.000Z`))
}

/**
 * When the summary says the events are.
 *
 * @param {object} filters Active filters.
 * @returns {string} ` this weekend`, ` from Oct 17, 2026 to Oct 18, 2026`, or an empty string.
 */
function whenPhrase(filters) {
  const { when, from, to } = filters

  if (WHEN_PHRASES[when]) return ` ${WHEN_PHRASES[when]}`
  if (from && to && from === to) return ` on ${dayLabel(from)}`
  if (from && to) return ` from ${dayLabel(from)} to ${dayLabel(to)}`
  if (from) return ` from ${dayLabel(from)}`
  if (to) return ` until ${dayLabel(to)}`

  return ''
}

/**
 * Describe the current result set in one sentence.
 *
 * @param {object} pagination Page counters from the listing.
 * @param {object} filters Active filters.
 * @param {object|null} [region] The chosen state's facet, for its name.
 * @returns {string} A sentence such as `3 free events in Frisco, TX this weekend`.
 */
function resultSummary(pagination, filters, region = null) {
  const noun = pagination.total === 1 ? 'event' : 'events'
  const kind = [
    filters.free ? 'free' : '',
    filters.format === 'online' ? 'online' : '',
    filters.format === 'in_person' ? 'in-person' : '',
  ]
    .filter(Boolean)
    .map((word) => `${word} `)
    .join('')
  const language = filters.language ? ` in ${filters.language}` : ''
  const onSale = filters.onSale ? ' on sale now' : ''
  const matching = filters.q ? ` matching “${filters.q}”` : ''

  return `${pagination.total} ${kind}${noun}${placePhrase(filters, region)}${whenPhrase(filters)}${language}${onSale}${matching}`
}

/**
 * @typedef {object} EventsPageProps
 * @property {Promise<Record<string, string|string[]|undefined>>} searchParams The URL's query parameters.
 */

/**
 * The filtered event listing.
 *
 * @param {EventsPageProps} props Route props.
 * @returns {Promise<JSX.Element>} The rendered listing.
 */
export default async function EventsPage({ searchParams }) {
  const parsed = parseEventFilters(await searchParams)

  // The filter selects offer every category, state and city the catalogue
  // has, not just the ones surviving the current filter — otherwise choosing
  // "Toronto" would delete every other city from the city select. The one
  // narrowing is the one a visitor asks for: with a state chosen, the City
  // select lists that state's cities.
  //
  // They come from facet counts computed in the database over every listed
  // event, not from a page of results. Deriving them from one page meant a city
  // whose events all started later than the forty-eighth was absent from the
  // select entirely, and its events unreachable through filtering.
  //
  // The facets are read first because they decide which filters stand: a
  // state, city or language the catalogue does not have is dropped, and a
  // city outside the chosen state with it (`reconcileFilters`).
  //
  // Both are asked for at once with the filters as the URL gave them; in the
  // rare case that changes them, the listing is asked for again.
  const [facetResult, asParsed] = await Promise.all([loadCatalogueFacets(), loadEventList(parsed)])
  // When only the facets fell back to the sample catalogue, they are not the
  // catalogue the listing was read from, so they decide nothing: the URL's
  // state, city and language stand, and are added to the selects' options so
  // the form says what the listing shows.
  const facetsOnlyFellBack = facetResult.usedFallback === true && asParsed.usedFallback !== true
  const facets = facetsOnlyFellBack
    ? withChosenOptions(facetResult.facets ?? {}, parsed)
    : (facetResult.facets ?? {})
  const filters = reconcileFilters(parsed, facets)
  const changed = ['region', 'city', 'language'].some((name) => filters[name] !== parsed[name])
  const listing = changed ? await loadEventList(filters) : asParsed

  const { events, pagination, usedFallback } = listing
  const categories = describeCategories(facets.categories ?? [])
  const regions = Array.isArray(facets.regions) ? facets.regions : []
  const region = regions.find((entry) => regionValue(entry) === filters.region) ?? null
  const cities = citiesFor(facets, filters.region)
  const languages = (facets.languages ?? []).map((entry) => entry.value)
  const active = hasActiveFilters(filters)

  const placement = usedFallback ? null : filters.q ? 'SEARCH' : 'LISTING'

  return (
    <div className="flex flex-col">
      <PageHero
        headingId="events-heading"
        size="display"
        breadcrumbs={
          <Breadcrumbs
            structured
            trail={[
              { href: '/', label: 'Home' },
              { href: null, label: 'Discover events' },
            ]}
          />
        }
        title="What’s on"
        lead="Concerts, comedy, garba, Durga Puja, Bollywood nights and the rest of the calendar, from Edison to Santa Clara and up to Toronto."
      />

      <div className="border-y border-line bg-surface-subtle">
        <div className="mx-auto max-w-content px-4 py-4 sm:px-6 sm:py-5">
          {/*
            No `key` here, deliberately. It used to be derived from the filter
            values, which remounted the whole form on every change and threw
            keyboard focus back to the document body mid-interaction.
          */}
          <EventFilters
            categories={categories}
            regions={regions}
            cities={cities}
            languages={languages}
            filters={filters}
            anyActive={active}
            resultCount={pagination?.total ?? events.length}
          />
        </div>
      </div>

      <div className="mx-auto w-full max-w-content px-4 pt-8 pb-20 sm:px-6 sm:pt-10 lg:pb-28">
        <SampleDataNotice show={usedFallback} />

        <div className="flex flex-col gap-3 border-b border-line pb-5 md:flex-row md:items-end md:justify-between md:gap-8">
          <div className="min-w-0">
            <p
              role="status"
              data-testid="result-count"
              className="font-display text-h2 font-bold text-balance text-ink"
            >
              {resultSummary(pagination, filters, region)}
            </p>
            <p className="mt-1 text-label text-ink-muted">
              {pagination.totalPages > 1
                ? `Page ${pagination.page} of ${pagination.totalPages}, soonest first`
                : 'Soonest first'}
            </p>
          </div>
          <p className="text-caption text-ink-muted md:max-w-xs md:text-right">
            A card’s price says whether the booking fee is in it.{' '}
            <strong className="font-semibold text-ink">Payments on this site are simulated.</strong>
          </p>
        </div>

        {/*
          `tabIndex={-1}` makes this a focus target for the filter bar's
          "Skip to results" link without putting it in the tab order. Focus moves
          here only when a visitor asks for it, never automatically on a filter
          change.
        */}
        <div id="event-results" tabIndex={-1} className="mt-8 scroll-mt-28 sm:mt-10">
          {events.length === 0 ? (
            <EmptyState
              icon={<SearchIcon className="h-8 w-8" />}
              title="Nothing matches that"
              description="Try a broader search, another city, or browse everything we have on."
              className="bg-surface-subtle"
              action={
                <Link href="/events" className={PRIMARY_LINK_SMALL}>
                  Clear all filters
                </Link>
              }
            />
          ) : (
            <EventGrid
              events={events}
              label="Matching events"
              headingLevel="h2"
              shared
              // A click on a card is counted as from search results when the
              // visitor searched, and from the events list otherwise.
              trafficPlacement={placement}
            />
          )}
        </div>

        {pagination.totalPages > 1 ? (
          <nav
            aria-label="Listing pages"
            className="mt-14 flex items-center justify-between gap-4 border-t border-line pt-6"
          >
            {pagination.hasPreviousPage ? (
              <Link
                href={buildEventsHref({ ...filters, page: pagination.page - 1 })}
                className={SECONDARY_LINK}
              >
                <ArrowLeftIcon className="h-4.5 w-4.5" />
                Previous
              </Link>
            ) : (
              <span className="w-28" />
            )}

            <p className="text-label text-ink-muted tabular-nums">
              Page <span className="font-bold text-ink">{pagination.page}</span> of{' '}
              {pagination.totalPages}
            </p>

            {pagination.hasNextPage ? (
              <Link
                href={buildEventsHref({ ...filters, page: pagination.page + 1 })}
                className={SECONDARY_LINK}
              >
                Next
                <ArrowRightIcon className="h-4.5 w-4.5" />
              </Link>
            ) : (
              <span className="w-28" />
            )}
          </nav>
        ) : null}
      </div>

      {/* Counts clicks on the cards above; a signed-in organiser's own events
          and staff at The Desi Events are left out. */}
      <TrafficScope />
    </div>
  )
}
