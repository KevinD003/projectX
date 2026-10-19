import { describe, expect, it } from 'vitest'

import { TICKET_TYPE_STATUSES } from '@desi-event/schemas'

import { TIER_STATUS, tierStatusLabel } from './tier-status.js'

describe('tierStatusLabel', () => {
  it('reads every status the API has in words, never as the enum', () => {
    expect(Object.keys(TIER_STATUS)).toEqual([...TICKET_TYPE_STATUSES])
    for (const status of TICKET_TYPE_STATUSES) {
      expect(tierStatusLabel(status), status).not.toMatch(/_|^[A-Z]{2,}$/u)
    }
    expect(tierStatusLabel('ON_SALE')).toBe('On sale')
    expect(tierStatusLabel('DRAFT')).toBe('Not on sale (draft)')
    expect(tierStatusLabel('SOLD_OUT')).toBe('Sold out')
  })

  it('says something readable for a status it does not know', () => {
    expect(tierStatusLabel('ON_HOLD')).toBe('On hold')
    expect(tierStatusLabel(null)).toBe('Unknown')
  })
})
