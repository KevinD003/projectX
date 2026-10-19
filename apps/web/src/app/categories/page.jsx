/**
 * Browse by category: every kind of night out, and how much of each is listed.
 *
 * Every category is offered, in the same editorial order the home page uses,
 * including the ones with nothing in them right now. That is the difference
 * from the home page's grid, which hides empty categories because it is a
 * shop window; this is a directory, and a directory that silently loses
 * "Theatre" in a quiet month reads as a site that does not do theatre. An
 * empty category says so in words and still links, because the listing it
 * opens says the same thing honestly and fills up the day something is
 * published.
 *
 * The numbers are the facet counts from the API, computed in the database over
 * every listed event — the statuses a listing shows, published, on sale, sales
 * paused and sold out (`FACET_SCOPE`, `LISTED`, in
 * `apps/api/src/lib/facets.js`) — so a category's number is how many events
 * the listing it links to holds. They are worded as "listed" because that is
 * what they count: not "upcoming", which they do not check, and not "on sale",
 * which is one status of four. Nothing here is worked out from a page of
 * results, and nothing is sorted by count: order by size and the page starts
 * claiming what is popular, which the data does not say.
 *
 * When the API cannot be reached, the facets come from the sample catalogue,
 * like every other public read, and the page says so.
 *
 * @module app/categories/page
 */

import Link from 'next/link'

import { ArrowRightIcon, CategoryIcon } from '../../components/icons.jsx'
import { SECONDARY_LINK } from '../../components/link-classes.js'
import { PageHero } from '../../components/page-hero.jsx'
import { SampleDataNotice } from '../../components/sample-data-notice.jsx'
import { loadCatalogueFacets } from '../../lib/api.js'
import { categoryCountLabel, describeCategoryDirectory } from '../../lib/directory.js'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Categories',
  description:
    'Live music, comedy, garba and dandiya, Bollywood nights, melas, theatre, workshops and more: every kind of event on The Desi Events, with how many are listed in each.',
}

/**
 * The category directory.
 *
 * @returns {Promise<JSX.Element>} The rendered page.
 */
export default async function CategoriesPage() {
  const { facets, usedFallback } = await loadCatalogueFacets()
  const { categories, countsKnown } = describeCategoryDirectory(facets)

  return (
    <div>
      <PageHero
        headingId="categories-heading"
        title="Browse by category"
        lead="From a stand-up set to a mela that takes the whole weekend. The number beside each is how many events are listed in it."
      />

      <div className="mx-auto max-w-content px-4 pt-2 pb-20 sm:px-6 lg:pb-28">
        <SampleDataNotice show={usedFallback} className="mb-6" />

        {countsKnown ? null : (
          <p className="mb-6 rounded-card border border-line bg-surface-subtle p-4 text-sm text-ink-muted">
            How many events each category holds could not be read just now, so no counts are shown.
            Every category still opens its listing.
          </p>
        )}

        <ul
          aria-label="Event categories"
          className="grid grid-cols-1 border-t-2 border-ink md:grid-cols-2 md:gap-x-12"
        >
          {categories.map((category) => {
            const count = categoryCountLabel(category.count)
            const empty = category.count === 0

            return (
              <li key={category.value} className="border-b border-line">
                <Link
                  href={category.href}
                  className="group grid min-h-11 grid-cols-[2rem_minmax(0,1fr)_auto] items-start gap-x-4 py-5"
                >
                  <CategoryIcon
                    category={category.value}
                    className={`mt-1 h-7 w-7 ${empty ? 'text-ink-subtle' : 'text-accent-strong'}`}
                  />
                  <div className="min-w-0">
                    <h2
                      className={`text-ink transition-[color,font-stretch] duration-(--duration-base) ease-out group-hover:text-accent-strong motion-safe:pointer-fine:group-hover:[font-stretch:100%] ${
                        empty ? 'text-h3 text-ink-muted' : 'text-h2'
                      }`}
                    >
                      {category.label}
                    </h2>
                    <p className="mt-1 text-label text-ink-muted">{category.blurb}</p>
                  </div>
                  {count ? (
                    <p
                      data-testid="category-count"
                      className={`mt-1 text-right text-label font-bold tabular-nums ${
                        empty ? 'max-w-28 font-semibold text-ink-subtle' : 'text-accent-strong'
                      }`}
                    >
                      {count}
                    </p>
                  ) : null}
                </Link>
              </li>
            )
          })}
        </ul>

        <p className="mt-12">
          <Link href="/events" className={SECONDARY_LINK}>
            Browse every event instead
            <ArrowRightIcon className="h-4.5 w-4.5" />
          </Link>
        </p>
      </div>
    </div>
  )
}
