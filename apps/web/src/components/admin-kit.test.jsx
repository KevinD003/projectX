import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import {
  AllClear,
  FilterLinks,
  Instant,
  STATUS_WORD_TONES,
  StatusWord,
  filterLinkClasses,
  formatTimeIn,
} from './admin-kit.jsx'

describe('StatusWord', () => {
  it('says a status as a word, a colour and a glyph, never by colour alone', () => {
    const { container } = render(
      <StatusWord tone="success" srLabel="State:">
        On sale
      </StatusWord>,
    )

    const word = container.querySelector('[data-slot="status-word"]')

    expect(word).toHaveTextContent('State: On sale')
    expect(word).toHaveClass('bg-status-success-soft', 'text-status-success')
    // The glyph repeats the meaning in a shape, and is hidden from a screen
    // reader, which hears the word once.
    const glyph = word.querySelector('svg')
    expect(glyph).toHaveAttribute('aria-hidden', 'true')
    expect(word.querySelector('[data-tone]')).toHaveAttribute('data-tone', 'success')
  })

  it.each(Object.keys(STATUS_WORD_TONES))('draws the %s tone from status tokens only', (tone) => {
    const { container } = render(<StatusWord tone={tone}>Word</StatusWord>)

    const word = container.querySelector('[data-slot="status-word"]')

    expect(word).toHaveAttribute('data-tone', tone)
    for (const name of word.className.split(/\s+/u)) {
      expect(name).not.toMatch(/^(bg|text)-(white|black|gray|slate|purple|pink|red|green)\b/u)
    }
  })

  it('draws an unknown tone as neutral rather than as nothing', () => {
    const { container } = render(<StatusWord tone="sparkly">Odd</StatusWord>)

    expect(container.querySelector('[data-slot="status-word"]')).toHaveAttribute(
      'data-tone',
      'neutral',
    )
    expect(screen.getByText('Odd')).toBeInTheDocument()
  })
})

describe('FilterLinks', () => {
  it('is a named navigation of links, the current one marked and filled', () => {
    render(
      <FilterLinks
        label="Which events"
        items={[
          { key: 'a', label: 'Current events', href: '/admin/events', current: true },
          { key: 'b', label: 'Both', href: '/admin/events?deleted=include', current: false },
        ]}
      />,
    )

    const nav = screen.getByRole('navigation', { name: 'Which events' })
    const current = within(nav).getByRole('link', { name: 'Current events' })
    const other = within(nav).getByRole('link', { name: 'Both' })

    expect(current).toHaveAttribute('aria-current', 'page')
    expect(current).toHaveClass('bg-action-primary', 'min-h-11')
    expect(other).not.toHaveAttribute('aria-current')
    expect(other).toHaveAttribute('href', '/admin/events?deleted=include')
  })

  it('draws focus as an outline, never as a ring', () => {
    expect(filterLinkClasses(false)).toContain('focus-visible:outline-2')
    expect(filterLinkClasses(true)).not.toMatch(/focus-visible:ring/u)
  })
})

describe('Instant', () => {
  it('sets the day over the time, in the zone named, inside one time element', () => {
    const { container } = render(<Instant value="2026-10-16T12:45:00.000Z" />)

    const time = container.querySelector('time')

    expect(time).toHaveAttribute('dateTime', '2026-10-16T12:45:00.000Z')
    expect([...time.children].map((line) => line.textContent)).toEqual([
      'Oct 16, 2026',
      '12:45 PM UTC',
    ])
  })

  it('draws the fallback, and no time element, when there is no instant', () => {
    const { container } = render(<Instant value={null} fallback="Never" />)

    expect(container.querySelector('time')).toBeNull()
    expect(screen.getByText('Never')).toBeInTheDocument()
  })

  it('formats the time of day in another zone', () => {
    expect(formatTimeIn('2026-10-16T12:45:00.000Z', 'America/New_York')).toBe('8:45 AM EDT')
    expect(formatTimeIn('not a date')).toBeNull()
  })
})

describe('AllClear', () => {
  it('says an empty queue in one line, the title first, beside a success glyph', () => {
    const { container } = render(
      <AllClear
        title="Nothing unresolved"
        description="Every payment agrees with what the provider says about it."
      />,
    )

    const line = container.querySelector('[data-slot="all-clear"]')

    expect(line).toHaveTextContent(
      'Nothing unresolved. Every payment agrees with what the provider says about it.',
    )
    expect(line.querySelector('[data-tone="success"]')).not.toBeNull()
    expect(within(line).getByText('Nothing unresolved.')).toHaveClass('font-semibold')
  })
})
