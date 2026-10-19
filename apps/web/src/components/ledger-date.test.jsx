/**
 * The ledger's margin date: the day over the month in the venue's zone,
 * hidden from assistive technology, and an empty margin for no date.
 *
 * @module components/ledger-date.test
 */

import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { LEDGER_ROW, LedgerDate } from './ledger-date.jsx'

describe('LedgerDate', () => {
  it('prints the day over the month in the venue’s zone, for the eye only', () => {
    // 01:30 on the 8th in UTC is still the 7th in New York.
    const { container } = render(
      <LedgerDate startsAt="2026-11-08T01:30:00.000Z" timeZone="America/New_York" />,
    )
    const date = container.querySelector('[data-slot="ledger-date"]')

    expect(date).toHaveAttribute('aria-hidden', 'true')
    expect([...date.children].map((part) => part.textContent)).toEqual(['7', 'Nov'])
    expect(date.firstElementChild.className).toContain('tabular-nums')
    expect(date.className).toContain('hidden')
    expect(date.className).toContain('sm:flex')
  })

  it('reads the date in UTC when the zone is missing', () => {
    const { container } = render(<LedgerDate startsAt="2026-11-08T01:30:00.000Z" />)

    expect(container.querySelector('[data-slot="ledger-date"]').textContent).toBe('8Nov')
  })

  it('keeps the margin, empty, for an unreadable date', () => {
    const { container } = render(<LedgerDate startsAt="not a date" timeZone="Asia/Kolkata" />)
    const date = container.querySelector('[data-slot="ledger-date"]')

    expect(date).not.toBeNull()
    expect(date.textContent).toBe('')
  })

  it('draws rows flat, divided by a rule, with no card or shadow', () => {
    expect(LEDGER_ROW).toBe('flex gap-6 border-b border-line py-6')
  })
})
