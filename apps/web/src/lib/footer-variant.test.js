import { describe, expect, it } from 'vitest'

import { COMPACT_FOOTER_AREAS, footerVariant } from './footer-variant.js'

describe('footerVariant', () => {
  it.each([
    '/account',
    '/account/orders',
    '/tickets',
    '/tickets/cticket0000000000000001',
    '/sign-in',
    '/register',
    '/events/navratri-night-one-edison/checkout',
    '/events/navratri-night-one-edison/seats/snnightonexxx',
  ])('ends %s with the compact footer', (pathname) => {
    expect(footerVariant(pathname)).toBe('compact')
  })

  it.each([
    '/',
    '/events',
    '/events/navratri-night-one-edison',
    '/events/checkout-comedy-night',
    '/categories',
    '/venues/rangoli-hall',
    '/organizers/mirrorwork-events',
    '/contact',
    '/limitations',
    '/accounts-of-the-night',
    '/ticketsandmore',
  ])('ends %s with the full plate', (pathname) => {
    expect(footerVariant(pathname)).toBe('full')
  })

  it('treats a missing path as the home page', () => {
    expect(footerVariant(null)).toBe('full')
    expect(footerVariant('')).toBe('full')
  })

  it('names exactly the areas somebody uses rather than browses', () => {
    expect(COMPACT_FOOTER_AREAS).toEqual(['/account', '/tickets', '/sign-in', '/register'])
  })
})
