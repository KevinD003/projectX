import { describe, expect, it } from 'vitest'

import { absoluteUrl, listingRobots, organiserJsonLd, websiteJsonLd } from './site-seo.js'

const BASE = 'https://thedesievents.com'

describe('listingRobots', () => {
  it('lets the listing itself be indexed', () => {
    expect(listingRobots({})).toEqual({})
    expect(listingRobots(undefined)).toEqual({})
    expect(listingRobots({ q: '', city: '   ' })).toEqual({})
  })

  it.each([
    [{ category: 'COMEDY' }],
    [{ city: 'Edison' }],
    [{ q: 'garba houston' }],
    [{ page: '2' }],
    [{ language: ['Gujarati'] }],
  ])('keeps a view of it (%j) out of the index, its links still followed', (query) => {
    expect(listingRobots(query)).toEqual({ robots: { index: false, follow: true } })
  })
})

describe('websiteJsonLd', () => {
  it('describes the site and sends its search to the listing’s own search', () => {
    expect(websiteJsonLd(BASE)).toEqual({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'The Desi Events',
      url: 'https://thedesievents.com/',
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: 'https://thedesievents.com/events?q={search_term_string}',
        },
        'query-input': 'required name=search_term_string',
      },
    })
  })
})

describe('organiserJsonLd', () => {
  it('names the organiser, its page here, its own words and its own website', () => {
    expect(
      organiserJsonLd(
        {
          slug: 'mirrorwork-events',
          name: 'Mirrorwork Events',
          description: '  Live garba bands in New Jersey.  ',
          websiteUrl: 'https://mirrorwork.example',
        },
        BASE,
      ),
    ).toEqual({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Mirrorwork Events',
      url: 'https://thedesievents.com/organizers/mirrorwork-events',
      description: 'Live garba bands in New Jersey.',
      sameAs: ['https://mirrorwork.example'],
    })
  })

  it('adds nothing the record does not carry, and no address that is not a web page', () => {
    const block = organiserJsonLd(
      { slug: 'a b', name: 'A B', description: '', websiteUrl: 'javascript:alert(1)' },
      BASE,
    )

    expect(block).toEqual({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'A B',
      url: 'https://thedesievents.com/organizers/a%20b',
    })
  })
})

describe('absoluteUrl', () => {
  it('resolves a path against the site', () => {
    expect(absoluteUrl('/events', BASE)).toBe('https://thedesievents.com/events')
  })
})
