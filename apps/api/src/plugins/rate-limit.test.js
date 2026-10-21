/**
 * The shared budgets SPEC3 adds (§4.4): wrong referral codes, per account and
 * per address, counting only refusals; a budget shared by several routes, per
 * account; and the booking-fee refund's own limit.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'

import { CLIENT_ADDRESS_HEADER } from '../lib/traffic.js'
import {
  DEFAULT_AUTH_LIMIT,
  DEFAULT_FEE_REFUND_LIMIT,
  DEFAULT_VENUE_CANCEL_LIMIT,
  DEFAULT_PAYMENT_TERMS_LIMIT,
  DEFAULT_REFERRAL_ADMIN_LIMIT,
  DEFAULT_REFERRAL_ATTEMPT_LIMIT,
  REFERRAL_ATTEMPTS_SENTENCE,
  actorBudget,
  authRateLimit,
  feeRefundRateLimit,
  venueCancelRateLimit,
  referralAttemptBuckets,
  referralAttemptBudget,
} from './rate-limit.js'

/** The header a trusted web server forwards a visitor's address in. */
const FORWARDED = CLIENT_ADDRESS_HEADER

/**
 * A request as the budget sees it after the guards have run.
 *
 * @param {object} [options] Options.
 * @param {string|null} [options.actorId] The signed-in account, or null.
 * @param {string} [options.ip] The peer's address.
 * @param {Record<string, string>} [options.headers] Headers.
 * @param {object} [options.body] The validated body.
 * @returns {object} A request-shaped object.
 */
function request({ actorId = 'acct-1', ip = '198.51.100.7', headers = {}, body = {} } = {}) {
  return {
    actor: actorId ? { id: actorId } : null,
    ip,
    headers,
    body,
    server: { env: { TRAFFIC_TRUSTED_FORWARDERS: ['127.0.0.1'] } },
  }
}

/** A body that names a referral code. */
const NAMED = { referralCode: 'ANY-CODE' }

afterEach(() => {
  vi.useRealTimers()
})

describe('the wrong referral codes budget', () => {
  it('has the limits SPEC3 §4.4 names, plus the global ceiling (finding F8)', () => {
    expect(DEFAULT_REFERRAL_ATTEMPT_LIMIT).toEqual({
      actorMax: 10,
      addressMax: 30,
      sharedMax: 300,
      globalMax: 1000,
      timeWindow: '10 minutes',
    })
  })

  it('counts only refusals: a request that is never recorded never spends anything', async () => {
    const budget = referralAttemptBudget()

    // Twelve quotes applying a valid code: the handler records none of them.
    for (let attempt = 0; attempt < 12; attempt += 1) {
      await expect(budget.hook(request({ body: NAMED }))).resolves.toBeUndefined()
    }
  })

  it('refuses the eleventh wrong code of one account with 429 and the buyer’s sentence', async () => {
    const budget = referralAttemptBudget()

    for (let attempt = 0; attempt < 10; attempt += 1) {
      await budget.hook(request({ body: NAMED }))
      budget.recordRefusal(request({ body: NAMED }))
    }

    const refused = await budget.hook(request({ body: NAMED })).catch((error) => error)

    expect(refused).toMatchObject({
      statusCode: 429,
      code: 'RATE_LIMITED',
      message: REFERRAL_ATTEMPTS_SENTENCE,
    })
    expect(refused.retryAfterSeconds).toBeGreaterThan(0)
    expect(refused.retryAfterSeconds).toBeLessThanOrEqual(600)
  })

  it('lets a request that names no code through even when the bucket is full', async () => {
    const budget = referralAttemptBudget({ actorMax: 1 })

    budget.recordRefusal(request({ body: NAMED }))

    await expect(budget.hook(request({ body: {} }))).resolves.toBeUndefined()
    await expect(budget.hook(request({ body: NAMED }))).rejects.toMatchObject({ statusCode: 429 })
  })

  it('keys the address bucket on the address alone, so a rotating browser shares it', async () => {
    const budget = referralAttemptBudget({ actorMax: 1_000, addressMax: 3 })
    const fromProxy = (actorId, agent) =>
      request({
        actorId,
        ip: '127.0.0.1',
        headers: { [FORWARDED]: '203.0.113.9', 'user-agent': agent },
        body: NAMED,
      })

    // Three accounts, three browsers, one address.
    budget.recordRefusal(fromProxy('acct-a', 'Browser A'))
    budget.recordRefusal(fromProxy('acct-b', 'Browser B'))
    budget.recordRefusal(fromProxy('acct-c', 'Browser C'))

    await expect(budget.hook(fromProxy('acct-d', 'Browser D'))).rejects.toMatchObject({
      statusCode: 429,
    })
    // Another address forwarded by the same proxy has its own bucket.
    await expect(
      budget.hook(
        request({
          actorId: 'acct-e',
          ip: '127.0.0.1',
          headers: { [FORWARDED]: '203.0.113.10' },
          body: NAMED,
        }),
      ),
    ).resolves.toBeUndefined()
  })

  it('never puts the address itself, or the browser, in a key', () => {
    const buckets = referralAttemptBuckets(
      request({
        ip: '127.0.0.1',
        headers: { [FORWARDED]: '203.0.113.9', 'user-agent': 'Browser A' },
      }),
    )
    const sameAddressOtherBrowser = referralAttemptBuckets(
      request({
        ip: '127.0.0.1',
        headers: { [FORWARDED]: '203.0.113.9', 'user-agent': 'Browser B' },
      }),
    )

    expect(buckets.map((bucket) => bucket.key)).toEqual([
      'referral:actor:acct-1',
      expect.stringMatching(/^referral:addr:[0-9a-f]{32}$/u),
      'referral:global',
    ])
    expect(JSON.stringify(buckets)).not.toContain('203.0.113.9')
    expect(sameAddressOtherBrowser[1].key).toBe(buckets[1].key)
  })

  it('uses the shared bucket when no address can be believed, and never skips it', async () => {
    const budget = referralAttemptBudget({ actorMax: 1_000, sharedMax: 2 })
    // A trusted forwarder that sent no address: nothing to believe.
    const unaddressed = (actorId) => request({ actorId, ip: '127.0.0.1', body: NAMED })

    expect(referralAttemptBuckets(unaddressed('acct-x')).map((bucket) => bucket.key)).toEqual([
      'referral:actor:acct-x',
      'referral:shared',
      'referral:global',
    ])

    budget.recordRefusal(unaddressed('acct-x'))
    budget.recordRefusal(unaddressed('acct-y'))

    await expect(budget.hook(unaddressed('acct-z'))).rejects.toMatchObject({ statusCode: 429 })
  })

  it('bounds a pool of accounts and addresses by the global ceiling (finding F8)', async () => {
    // Each account and each address has its own generous budget, so before the
    // global ceiling one attacker could multiply guesses by spreading them. A
    // fresh account from a fresh address for every guess keeps the per-actor and
    // per-address buckets empty; the global one still fills and refuses.
    const budget = referralAttemptBudget({ actorMax: 1_000, addressMax: 1_000, globalMax: 5 })
    const fresh = (n) =>
      request({
        actorId: `acct-${n}`,
        ip: '127.0.0.1',
        headers: { [FORWARDED]: `203.0.113.${n}` },
        body: NAMED,
      })

    for (let guess = 0; guess < 5; guess += 1) {
      await budget.hook(fresh(guess))
      budget.recordRefusal(fresh(guess))
    }

    // A brand-new account from a brand-new address — its own buckets empty — is
    // still refused, because the shared ceiling is spent.
    await expect(budget.hook(fresh(99))).rejects.toMatchObject({
      statusCode: 429,
      code: 'RATE_LIMITED',
      message: REFERRAL_ATTEMPTS_SENTENCE,
    })
  })

  it('refuses a would-be valid code once the global window is full: the gate runs before validation (finding F8)', async () => {
    // The gate (`hook`) cannot tell a valid code from a wrong one — the handler
    // validates later, and only then records a refusal. So once the global
    // window is full of wrong guesses, every request that names a referral code
    // is refused, including one that would apply a perfectly valid code. The doc
    // on DEFAULT_REFERRAL_ATTEMPT_LIMIT says exactly this; this pins it so the
    // honest wording cannot drift back to "a real code is unaffected".
    const budget = referralAttemptBudget({ actorMax: 1_000, addressMax: 1_000, globalMax: 3 })
    const fresh = (n) =>
      request({
        actorId: `acct-${n}`,
        ip: '127.0.0.1',
        headers: { [FORWARDED]: `203.0.113.${n}` },
        body: NAMED,
      })

    // Three wrong guesses, each from its own fresh account and address, fill the
    // global ceiling without touching any per-actor or per-address bucket.
    for (let guess = 0; guess < 3; guess += 1) {
      await budget.hook(fresh(guess))
      budget.recordRefusal(fresh(guess))
    }

    // A brand-new account from a brand-new address — its own buckets empty, and
    // about to apply what may well be a valid code — is still refused at the
    // gate, because only the global ceiling is spent and validity is unknown here.
    const refused = await budget.hook(fresh(42)).catch((error) => error)

    expect(refused).toMatchObject({
      statusCode: 429,
      code: 'RATE_LIMITED',
      message: REFERRAL_ATTEMPTS_SENTENCE,
    })

    // And nothing it carries spends the ceiling further: a valid application is
    // never recorded as a refusal, so the window drains to only the wrong guesses.
    // (The handler calls recordRefusal only on NOT_ACCEPTED; the gate above never does.)
  })

  it('forgets a window once it has passed', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-09T10:00:00Z'))

    const budget = referralAttemptBudget({ actorMax: 1 })

    budget.recordRefusal(request({ body: NAMED }))
    await expect(budget.hook(request({ body: NAMED }))).rejects.toMatchObject({ statusCode: 429 })

    vi.setSystemTime(new Date('2026-10-09T10:10:01Z'))

    await expect(budget.hook(request({ body: NAMED }))).resolves.toBeUndefined()
  })
})

describe('a budget shared by several routes', () => {
  it('has sixty an hour for the booking fee and for referral codes', () => {
    expect(DEFAULT_PAYMENT_TERMS_LIMIT).toEqual({ max: 60, timeWindow: '1 hour' })
    expect(DEFAULT_REFERRAL_ADMIN_LIMIT).toEqual({ max: 60, timeWindow: '1 hour' })
  })

  it('is one bucket per account across every route it is given to', async () => {
    const budget = actorBudget({ name: 'payment-terms', max: 3, timeWindow: '1 hour' })
    const setFee = budget
    const setVenuePayment = budget

    await setFee(request())
    await setVenuePayment(request())
    await setFee(request())

    const refused = await setVenuePayment(request()).catch((error) => error)

    expect(refused).toMatchObject({ statusCode: 429, code: 'RATE_LIMITED' })
    expect(refused.retryAfterSeconds).toBeGreaterThan(0)
    // Another administrator has a bucket of their own.
    await expect(setFee(request({ actorId: 'acct-2' }))).resolves.toBeUndefined()
  })

  it('refuses a budget with no lower-case name', () => {
    expect(() => actorBudget({ name: '', max: 1, timeWindow: '1 hour' })).toThrow(TypeError)
    expect(() => actorBudget({ name: 'Payment Terms', max: 1, timeWindow: '1 hour' })).toThrow(
      TypeError,
    )
  })
})

describe('the auth endpoint budget (finding F2)', () => {
  it('has a tight per-client max and a far higher shared ceiling', () => {
    expect(DEFAULT_AUTH_LIMIT).toEqual({ max: 10, sharedMax: 600, timeWindow: '1 minute' })
    expect(DEFAULT_AUTH_LIMIT.sharedMax).toBeGreaterThan(DEFAULT_AUTH_LIMIT.max * 10)
  })

  it('keys a believable client on its own bucket, and the shared proxy socket on another', () => {
    const limit = authRateLimit()

    // Behind a trusted forwarder that forwarded the client address: the client's
    // own bucket, at the per-client max.
    const forwarded = request({
      ip: '127.0.0.1',
      headers: { [FORWARDED]: '203.0.113.9' },
    })

    expect(limit.keyGenerator(forwarded)).toBe('auth:client:203.0.113.9')
    expect(limit.max(forwarded, 'auth:client:203.0.113.9')).toBe(10)

    // A direct caller keys on its own socket too.
    const direct = request({ ip: '198.51.100.7' })

    expect(limit.keyGenerator(direct)).toBe('auth:client:198.51.100.7')

    // The collapse case: a trusted forwarder that forwarded no address. Every
    // such request shares one bucket keyed on the proxy socket, and that bucket
    // gets the wide ceiling, not the ten-a-minute per-user one — so one sprayer
    // can no longer exhaust the budget the whole audience shares.
    const shared = request({ ip: '127.0.0.1', headers: {} })

    expect(limit.keyGenerator(shared)).toBe('auth:shared:127.0.0.1')
    expect(limit.max(shared, 'auth:shared:127.0.0.1')).toBe(600)
  })

  it('honours overrides for both the per-client and shared ceilings', () => {
    const limit = authRateLimit({ max: 2, sharedMax: 5 })
    const shared = request({ ip: '127.0.0.1', headers: {} })
    const forwarded = request({ ip: '127.0.0.1', headers: { [FORWARDED]: '203.0.113.9' } })

    expect(limit.max(forwarded, 'auth:client:203.0.113.9')).toBe(2)
    expect(limit.max(shared, 'auth:shared:127.0.0.1')).toBe(5)
  })
})

describe('the booking-fee refund limit', () => {
  it('is thirty an hour per administrator, keyed on the account', () => {
    const limit = feeRefundRateLimit()

    expect(DEFAULT_FEE_REFUND_LIMIT).toEqual({ max: 30, timeWindow: '1 hour' })
    expect(limit).toMatchObject({ max: 30, timeWindow: '1 hour', hook: 'preHandler' })
    expect(limit.keyGenerator(request({ actorId: 'admin-1' }))).toBe('fee-refund:actor:admin-1')
    expect(feeRefundRateLimit({ max: 2 }).max).toBe(2)
  })
})

describe('the unpaid-tickets cancel limit (SPEC3-XI §4.4)', () => {
  it('is sixty an hour per person, keyed on the account, on every request', () => {
    const limit = venueCancelRateLimit()

    expect(DEFAULT_VENUE_CANCEL_LIMIT).toEqual({ max: 60, timeWindow: '1 hour' })
    expect(limit).toMatchObject({ max: 60, timeWindow: '1 hour', hook: 'preHandler' })
    expect(limit.keyGenerator(request({ actorId: 'owner-1' }))).toBe('venue-cancel:actor:owner-1')
    expect(limit).not.toHaveProperty('skip')
    expect(venueCancelRateLimit({ max: 2 }).max).toBe(2)
  })
})
