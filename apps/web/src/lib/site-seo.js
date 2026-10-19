/**
 * What the public pages tell search engines beyond their own content: which
 * view of the listing is the one to index, the site's search box, and who an
 * organiser is.
 *
 * Every block here is plain data. The pages inline it through the `JsonLd`
 * component, which escapes it for a `<script>` element (`lib/json-ld.js`).
 *
 * @module lib/site-seo
 */

import { BRAND_NAME } from './contact.js'

/**
 * Where this deployment is served from, for absolute addresses in structured
 * data. Mirrors the root layout's `metadataBase`.
 */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://127.0.0.1:3000'

/**
 * An address on this site, absolute.
 *
 * @param {string} path A path such as `/events`.
 * @param {string} [base] The site's origin.
 * @returns {string} The absolute URL.
 */
export function absoluteUrl(path, base = SITE_URL) {
  return new URL(path, base).href
}

/**
 * Whether a listing URL is the listing itself or a view of it.
 *
 * Any query at all (a filter, a search, a page past the first) makes a view:
 * the page is still served and its links followed, but it is not indexed in
 * its own right, so a search engine indexes `/events` and the events, not
 * every combination of filters.
 *
 * @param {Record<string, string|string[]|undefined>} [searchParams] The URL's query.
 * @returns {{robots?: {index: boolean, follow: boolean}}} Metadata to spread into the page's.
 */
export function listingRobots(searchParams = {}) {
  const viewed = Object.values(searchParams ?? {}).some((value) =>
    Array.isArray(value)
      ? value.some((entry) => String(entry).trim() !== '')
      : String(value ?? '').trim() !== '',
  )

  return viewed ? { robots: { index: false, follow: true } } : {}
}

/**
 * The site as a `WebSite`, with its search: a visitor's query goes to the
 * listing's own search, `/events?q=`, which is what the home page's search
 * box does too.
 *
 * @param {string} [base] The site's origin.
 * @returns {object} The JSON-LD.
 */
export function websiteJsonLd(base = SITE_URL) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: BRAND_NAME,
    url: absoluteUrl('/', base),
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${absoluteUrl('/events', base)}?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  }
}

/**
 * An organiser as an `Organization`: its name, its page here, what it says
 * about itself, and its own website when it has one.
 *
 * Nothing is added that the organiser's record does not carry: no logo it
 * did not upload, no rating, no address.
 *
 * @param {object} organizer The organiser's public record.
 * @param {string} [base] The site's origin.
 * @returns {object} The JSON-LD.
 */
export function organiserJsonLd(organizer, base = SITE_URL) {
  const page = absoluteUrl(`/organizers/${encodeURIComponent(organizer.slug)}`, base)
  const website = typeof organizer.websiteUrl === 'string' ? organizer.websiteUrl : null
  const description =
    typeof organizer.description === 'string' && organizer.description.trim()
      ? organizer.description.trim()
      : null

  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: organizer.name,
    url: page,
    ...(description ? { description } : {}),
    ...(website && /^https?:\/\//u.test(website) ? { sameAs: [website] } : {}),
  }
}
