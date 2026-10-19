import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import { AgingBadge, Figure, FigureList, ModeBanner } from './money-figure.jsx'

describe('ModeBanner', () => {
  it('says a mock figure is a demonstration, as a status rather than an alert', () => {
    render(<ModeBanner mode="MOCK" notice="DEMO — no money moved." />)

    const banner = screen.getByRole('status')

    // A standing condition, not something that just happened. `role="alert"`
    // would interrupt a screen reader on every page load for a fact that is
    // true all the time.
    expect(banner).toHaveTextContent('Demonstration data')
    expect(banner).toHaveTextContent('no money moved')
  })

  it('distinguishes the sandbox from the mock', () => {
    render(<ModeBanner mode="STRIPE_TEST" notice="SANDBOX — test mode." />)

    expect(screen.getByRole('status')).toHaveTextContent('Sandbox data')
  })

  it('marks the banner with a shape that says nothing on its own', () => {
    const { container } = render(<ModeBanner mode="MOCK" notice="DEMO — no money moved." />)

    // The glyph is decoration; the words carry the meaning.
    expect(container.querySelector('[aria-hidden="true"]').textContent).toBe('')
  })

  it('draws a simulated state with the mock glyph and a sandbox with the info glyph', () => {
    const { container, rerender } = render(<ModeBanner mode="MOCK" notice="Simulated." />)

    expect(container.querySelector('[data-tone]')).toHaveAttribute('data-tone', 'mock')
    expect(screen.getByRole('status')).toHaveClass('bg-status-mock-soft')

    rerender(<ModeBanner mode="STRIPE_TEST" notice="Test mode." />)

    expect(container.querySelector('[data-tone]')).toHaveAttribute('data-tone', 'info')
    expect(screen.getByRole('status')).toHaveClass('bg-status-info-soft')
  })
})

describe('Figure', () => {
  it('renders an amount in its own currency', () => {
    render(
      <dl>
        <Figure label="Owed to organisers" cents={1_234_500} currency="INR" />
      </dl>,
    )

    expect(screen.getByText('Owed to organisers')).toBeInTheDocument()
    // Formatted rather than printed: 1234500 minor units is not what a finance
    // person reads, and a screen that shows the raw integer invites arithmetic.
    expect(screen.getByText(/12,345/)).toBeInTheDocument()
  })

  it('reads an amount with no currency given as US dollars', () => {
    render(
      <dl>
        <Figure label="Gross collected" cents={3806} />
      </dl>,
    )

    expect(screen.getByText('$38.06')).toBeInTheDocument()
  })

  it('prints a zero as $0.00, never as "Free", set in the muted ink', () => {
    render(
      <dl>
        <Figure label="Tax payable" cents={0} />
        <Figure label="Gross collected" cents={4865} />
      </dl>,
    )

    // A ledger line reading "Tax payable: Free" makes a claim about tax.
    expect(screen.queryByText('Free')).not.toBeInTheDocument()
    expect(screen.getByText('$0.00')).toHaveClass('text-ink-muted')
    expect(screen.getByText('$48.65')).toHaveClass('text-ink')
  })

  it('shows a hint when one explains the number', () => {
    render(
      <dl>
        <Figure label="Tax payable" cents={100} hint="Collected on an authority’s behalf." />
      </dl>,
    )

    expect(screen.getByText(/authority/)).toBeInTheDocument()
  })
})

describe('FigureList', () => {
  it('sets plain figures as the cells of one ruled description list', () => {
    const { container } = render(
      <FigureList>
        <Figure plain label="Gross collected" cents={4865} />
        <Figure plain label="Discounts given" cents={0} />
      </FigureList>,
    )

    const list = container.querySelector('dl')

    expect(list).toHaveAttribute('data-slot', 'figure-list')
    expect(list).toHaveClass('gap-px', 'bg-line', 'rounded-card')
    expect(screen.getAllByRole('term').map((term) => term.textContent)).toEqual([
      'Gross collected',
      'Discounts given',
    ])
    // A cell, not a card inside a card: no panel shadow of its own.
    for (const cell of container.querySelectorAll('[data-slot="figure"]')) {
      expect(cell).toHaveClass('bg-surface-raised')
      expect(cell).not.toHaveClass('shadow-card')
    }
    expect(screen.getByText('$0.00')).toHaveClass('text-h3', 'tabular-nums')
  })
})

describe('AgingBadge', () => {
  it.each([
    ['FRESH', 'Fresh'],
    ['AGING', 'Ageing'],
    ['OVERDUE', 'Overdue'],
  ])('reads %s as a word and not only as a colour', (band, reading) => {
    render(<AgingBadge band={band} hours={12} />)

    // WCAG 1.4.1: a badge that differs only by colour tells a colour-blind
    // reader nothing.
    expect(screen.getByText(new RegExp(reading))).toBeInTheDocument()
  })

  it('says how long the item has been open', () => {
    render(<AgingBadge band="OVERDUE" hours={96} />)

    expect(screen.getByText(/96/)).toBeInTheDocument()
    expect(screen.getByTitle('hours')).toBeInTheDocument()
  })
})
