/**
 * "Your venues": a ruled list of the halls an organiser runs, each with its
 * seating maps and its details one step away, and a plain empty state.
 *
 * @module app/organizer/venues/page.test
 */

import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../lib/session.js', async () => ({
  readSession: vi.fn(),
  authoringOrganizations: (await import('../../../lib/capabilities.js')).authoringOrganizations,
}))
vi.mock('../../../lib/organizer-api.js', () => ({ listVenues: vi.fn() }))

const { readSession } = await import('../../../lib/session.js')
const { listVenues } = await import('../../../lib/organizer-api.js')
const { default: OrganizerVenuesPage } = await import('./page.jsx')

afterEach(() => {
  cleanup()
  listVenues.mockReset()
})

/** Somebody who manages venues at one organisation. */
const MANAGER = {
  user: { id: 'u1' },
  capabilities: [],
  memberships: [
    {
      organizationId: 'corgalpha00000000000001',
      organizationName: 'Alpha',
      role: 'OWNER',
      capabilities: ['venue:manage'],
    },
  ],
}

describe('your venues', () => {
  it('lists each venue as a row: its name, where it is, its capacity, and its two pages', async () => {
    readSession.mockResolvedValue(MANAGER)
    listVenues.mockResolvedValue([
      { id: 'v1', name: 'Lamplight Hall', city: 'Edison', region: 'NJ', capacity: 1200 },
      { id: 'v2', name: 'Shared Pavilion', city: 'Fremont', region: null, shared: true },
    ])

    const { container } = render(await OrganizerVenuesPage())

    expect(listVenues).toHaveBeenCalledWith('corgalpha00000000000001')

    const rows = container.querySelectorAll('[data-slot="venue-rows"] > li')

    expect(rows).toHaveLength(2)
    expect(within(rows[0]).getByRole('heading', { level: 2, name: 'Lamplight Hall' })).toBeTruthy()
    expect(within(rows[0]).getByText('Edison, NJ · Capacity 1,200')).toBeTruthy()
    expect(
      within(rows[0])
        .getAllByRole('link')
        .map((link) => [link.textContent, link.getAttribute('href')]),
    ).toEqual([
      ['Lamplight Hall', '/organizer/venues/v1/maps'],
      ['Seating maps', '/organizer/venues/v1/maps'],
      ['Edit details', '/organizer/venues/v1/edit'],
    ])
    expect(within(rows[1]).getByText('Fremont')).toBeTruthy()
    expect(within(rows[1]).getByText('Shared')).toBeTruthy()
    expect(within(rows[0]).queryByText('Shared')).toBeNull()
  })

  it('says what to do instead when there is no venue of your own', async () => {
    readSession.mockResolvedValue(MANAGER)
    listVenues.mockResolvedValue([])

    render(await OrganizerVenuesPage())

    expect(screen.getByRole('heading', { name: 'No venues of your own' })).toBeTruthy()
    expect(screen.getByText(/You can still list an event at a shared venue/u)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Add a venue' })).toHaveAttribute(
      'href',
      '/organizer/venues/new',
    )
    expect(document.body.textContent).not.toContain('—')
  })

  it('tells somebody who cannot manage venues where the role comes from, and asks nothing', async () => {
    readSession.mockResolvedValue({ ...MANAGER, memberships: [] })

    render(await OrganizerVenuesPage())

    expect(listVenues).not.toHaveBeenCalled()
    expect(
      screen.getByText(/You are not a member of an organisation that can manage venues/u),
    ).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'No venues of your own' })).toBeNull()
  })
})
