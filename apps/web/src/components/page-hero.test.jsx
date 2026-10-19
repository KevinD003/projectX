import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import { PageHero } from './page-hero.jsx'

describe('PageHero', () => {
  it('holds the page’s one h1, and is a region named by it', () => {
    render(<PageHero headingId="page-heading" title="Venues" lead="Where the circle forms." />)

    const heading = screen.getByRole('heading', { level: 1, name: 'Venues' })

    expect(heading.id).toBe('page-heading')
    expect(screen.getAllByRole('heading')).toHaveLength(1)
    expect(screen.getByRole('region', { name: 'Venues' })).toContainElement(heading)
    expect(screen.getByText('Where the circle forms.')).toBeInTheDocument()
  })

  it('puts the trail before the heading, with no eyebrow between them', () => {
    const { container } = render(
      <PageHero
        headingId="page-heading"
        title="Who is putting on the nights"
        lead="Every organiser on the site."
        breadcrumbs={<nav aria-label="Breadcrumb">trail</nav>}
      />,
    )

    const order = [...container.querySelectorAll('nav, p, h1')].map((element) =>
      element.tagName.toLowerCase(),
    )

    expect(order).toEqual(['nav', 'h1', 'p'])
  })

  it('opens on the white page by default, and on the purple plate when asked', () => {
    const { rerender } = render(<PageHero headingId="page-heading" title="Venues" />)
    const band = () => screen.getByRole('region', { name: 'Venues' })

    expect(band()).toHaveClass('bg-page', 'text-ink')
    expect(screen.getByRole('heading', { level: 1 })).toHaveClass('text-h1', 'text-ink')

    rerender(<PageHero headingId="page-heading" title="Venues" tone="plate" size="display" />)

    expect(band()).toHaveClass('bg-surface-inverse', 'text-ink-inverse')
    expect(screen.getByRole('heading', { level: 1 })).toHaveClass(
      'text-display',
      'text-ink-inverse',
    )
  })

  it('draws its heading at rest: nothing in it waits on an animation', () => {
    const { container } = render(<PageHero headingId="page-heading" title="Venues" lead="Halls." />)

    expect(container.querySelector('[data-motion]')).toBeNull()
  })

  it('keeps its artwork away from assistive technology', () => {
    const { container } = render(
      <PageHero headingId="page-heading" title="Categories" art={<svg data-testid="art" />} />,
    )

    expect(screen.getByTestId('art').closest('[aria-hidden="true"]')).not.toBeNull()
    // Nothing but the words is announced.
    for (const svg of container.querySelectorAll('svg:not([data-testid])')) {
      expect(svg.closest('[aria-hidden="true"]')).not.toBeNull()
    }
  })

  it('renders what the page adds beneath the lead', () => {
    render(
      <PageHero headingId="page-heading" title="A venue">
        <p>This venue record was merged into another one.</p>
      </PageHero>,
    )

    expect(screen.getByText(/merged into another one/)).toBeInTheDocument()
  })
})
