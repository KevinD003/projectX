/**
 * The public shell: the site header, the page in `main`, and the footer
 * plate, with exactly one of each landmark.
 *
 * @module components/public-shell.test
 */

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

// The header reads the session on the server; here it is a plain banner.
vi.mock('./site-header.jsx', () => ({ SiteHeader: () => <header>header</header> }))

const navigation = vi.hoisted(() => ({ pathname: '/' }))

vi.mock('next/navigation', () => ({ usePathname: () => navigation.pathname }))

const { PublicShell } = await import('./public-shell.jsx')

afterEach(() => {
  cleanup()
  navigation.pathname = '/'
})

describe('PublicShell', () => {
  it('draws one banner, one main and one contentinfo, in that order', () => {
    render(
      <PublicShell>
        <h1>Page</h1>
      </PublicShell>,
    )

    const [banner, main, footer] = [
      screen.getByRole('banner'),
      screen.getByRole('main'),
      screen.getByRole('contentinfo'),
    ]

    expect(screen.getAllByRole('banner')).toHaveLength(1)
    expect(screen.getAllByRole('main')).toHaveLength(1)
    expect(screen.getAllByRole('contentinfo')).toHaveLength(1)
    expect(banner.compareDocumentPosition(main) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(main.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('gives the skip link its target, and puts the page in the crossfaded box', () => {
    render(
      <PublicShell>
        <h1>Page</h1>
      </PublicShell>,
    )

    const main = screen.getByRole('main')

    expect(main.id).toBe('main-content')
    expect(main.getAttribute('tabindex')).toBe('-1')
    expect(screen.getByRole('heading', { name: 'Page' }).parentElement).toHaveAttribute(
      'data-page-content',
      'public',
    )
  })

  it.each([
    ['/', 'full'],
    ['/events/navratri-night-one-edison', 'full'],
    ['/account', 'compact'],
    ['/tickets/cticket0000000000000001', 'compact'],
    ['/sign-in', 'compact'],
    ['/events/navratri-night-one-edison/checkout', 'compact'],
  ])('ends %s with the %s footer, and only one', (pathname, variant) => {
    navigation.pathname = pathname
    render(
      <PublicShell>
        <h1>Page</h1>
      </PublicShell>,
    )

    const footer = screen.getByRole('contentinfo')

    expect(screen.getAllByRole('contentinfo')).toHaveLength(1)
    if (variant === 'compact') {
      expect(footer).toHaveAttribute('data-footer', 'compact')
      expect(footer.textContent).not.toContain('Every moment, one place.')
    } else {
      expect(footer).not.toHaveAttribute('data-footer')
      expect(footer.textContent).toContain('Every moment, one place.')
    }
  })
})
