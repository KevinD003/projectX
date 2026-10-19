/**
 * The category index on the home page.
 *
 * Only categories that actually have events are offered. A link that leads to
 * an empty listing teaches the visitor that the filters do not work. The
 * number beside each is the facet count, how many listed events the link
 * opens onto, and the index keeps the catalogue's editorial order rather than
 * being sorted by that number, which would start claiming what is popular.
 *
 * It is set as an index, not a wall of tiles: each kind of night is a line,
 * its mark, its name in the display face and its count, ruled off from the
 * next like the contents page of a programme. Under the name, when the page
 * knows one, the next event of that kind, linked on its own.
 *
 * @module components/category-grid
 */

import Link from 'next/link'

import { categoryCountLabel } from '../lib/directory.js'
import { formatEventStart, toDateTimeAttribute } from '../lib/format.js'
import { buildEventsHref } from '../lib/search-params.js'
import { trafficAttributes } from '../lib/traffic-client.js'
import { ArrowRightIcon, CategoryIcon } from './icons.jsx'

/**
 * @typedef {object} CategoryGridProps
 * @property {Array<{value: string, label: string, blurb: string, count?: number}>} categories Category descriptors, with their event counts when known.
 * @property {Record<string, object>} [next] The next event of each kind the page knows, by category value.
 * @property {'HOME'|null} [trafficPlacement] Where a click on a next event is counted from; null counts nothing.
 */

/**
 * The categories as a ruled index linking into the filtered listing.
 *
 * @param {CategoryGridProps} props Component props.
 * @returns {JSX.Element} The index.
 */
export function CategoryGrid({ categories, next = {}, trafficPlacement = null }) {
  return (
    <ul
      aria-label="Browse by category"
      className="grid grid-cols-1 border-t border-line sm:grid-cols-2 sm:gap-x-8 lg:grid-cols-3 lg:gap-x-12"
    >
      {categories.map((category) => {
        const count = Number.isInteger(category.count) ? categoryCountLabel(category.count) : null
        const upcoming = next[category.value] ?? null

        return (
          <li key={category.value} className="flex flex-col border-b border-line py-3">
            <Link
              href={buildEventsHref({ category: category.value })}
              className="group flex min-h-11 items-center gap-4"
            >
              <CategoryIcon
                category={category.value}
                className="h-6 w-6 shrink-0 text-accent-strong"
              />
              <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3">
                <h3 className="text-h3 text-ink transition-[color,font-stretch] duration-(--duration-base) ease-out group-hover:text-accent-strong motion-safe:pointer-fine:group-hover:[font-stretch:100%]">
                  {category.label}
                </h3>
                {count ? (
                  <span className="text-caption text-ink-muted tabular-nums">{count}</span>
                ) : null}
              </div>
              <ArrowRightIcon className="h-5 w-5 shrink-0 text-ink-subtle transition-transform duration-(--duration-base) ease-out group-hover:text-accent-strong motion-safe:pointer-fine:group-hover:translate-x-1" />
            </Link>
            {upcoming ? (
              <p className="pl-10 text-caption text-ink-muted">
                Next:{' '}
                <Link
                  href={`/events/${upcoming.slug}`}
                  {...(trafficPlacement
                    ? trafficAttributes({
                        kind: 'CARD_CLICK',
                        eventId: upcoming.id,
                        organizationId: upcoming.organizationId,
                        placement: trafficPlacement,
                      })
                    : {})}
                  className="font-semibold text-ink underline decoration-line-strong underline-offset-4 hover:text-accent-strong hover:decoration-accent-strong"
                >
                  {upcoming.title}
                </Link>
                <span aria-hidden="true"> · </span>
                <time dateTime={toDateTimeAttribute(upcoming.startsAt)}>
                  {formatEventStart(upcoming)}
                </time>
              </p>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}
