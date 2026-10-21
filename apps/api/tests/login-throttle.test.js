/**
 * The address the login and step-up throttles ration by, and the per-IP half's
 * behaviour behind the same-origin proxy (finding F2).
 *
 * `request.ip` is the web proxy for every browser user when `trustProxy` is off,
 * so a throttle keyed on it collapsed to one bucket for the whole audience. The
 * per-account (email) half never shared a bucket; the per-IP half must simply
 * not be enforced when no per-client address can be believed, or one sprayer
 * behind the proxy locks everyone's sign-in.
 *
 * @module @desi-event/api/tests/login-throttle
 */

import { LOGIN_OUTCOMES, THROTTLE } from '@desi-event/auth'
import { describe, expect, it } from 'vitest'

import { loginRateAddress, recordLoginAttempt, throttleLogin } from '../src/lib/sessions.js'
import { createPrismaStub } from './helpers/prisma-stub.js'

/** A pseudonymisation key of the required length. */
const KEY = 'test-pseudonymisation-key'

/** A request as the throttle sees it, with the test env's trusted forwarder. */
function request({ ip = '127.0.0.1', headers = {} } = {}) {
  return { ip, headers, server: { env: { TRAFFIC_TRUSTED_FORWARDERS: ['127.0.0.1'] } } }
}

describe('loginRateAddress (finding F2)', () => {
  it('believes a trusted proxy’s forwarded address, and a direct caller’s own', () => {
    expect(loginRateAddress(request({ headers: { 'x-desi-client-address': '203.0.113.9' } }))).toBe(
      '203.0.113.9',
    )
    // A direct caller (peer is not a trusted forwarder) keys on its own socket.
    expect(loginRateAddress(request({ ip: '198.51.100.7' }))).toBe('198.51.100.7')
  })

  it('returns no address when a trusted forwarder sends none, rather than the shared socket', () => {
    // The collapse case: the proxy forwarded nothing, so its socket peer is the
    // one address the whole audience shares. It must NOT become the key.
    expect(loginRateAddress(request({ headers: {} }))).toBe('')
  })
})

describe('throttleLogin per-IP half behind the proxy (finding F2)', () => {
  /** A low per-IP threshold, so the test needs only a few rows. */
  const policy = {
    perEmail: THROTTLE.perEmail,
    perIp: { max: 3, windowMs: 15 * 60 * 1000, lockoutMs: 15 * 60 * 1000 },
  }

  it('does not enforce the per-IP throttle when no client address can be believed', async () => {
    const prisma = createPrismaStub({})

    // Failures from the shared proxy bucket (no believable address), spread
    // across distinct accounts so the per-account counter never trips.
    for (const email of ['a@x.test', 'b@x.test', 'c@x.test', 'd@x.test']) {
      await recordLoginAttempt(prisma, {
        email,
        address: '',
        outcome: LOGIN_OUTCOMES.BAD_PASSWORD,
        key: KEY,
      })
    }

    // A fifth, innocent account from the same shared bucket is still allowed:
    // without a per-client address the per-IP half is not enforced, so one
    // sprayer cannot deny the whole audience's sign-in.
    const decision = await throttleLogin(prisma, {
      email: 'innocent@x.test',
      address: '',
      key: KEY,
      policy,
    })

    expect(decision.allowed).toBe(true)
  })

  it('still bounds a spray from one believable per-client address', async () => {
    const prisma = createPrismaStub({})

    for (const email of ['a@x.test', 'b@x.test', 'c@x.test']) {
      await recordLoginAttempt(prisma, {
        email,
        address: '203.0.113.9',
        outcome: LOGIN_OUTCOMES.BAD_PASSWORD,
        key: KEY,
      })
    }

    const decision = await throttleLogin(prisma, {
      email: 'innocent@x.test',
      address: '203.0.113.9',
      key: KEY,
      policy,
    })

    expect(decision.allowed).toBe(false)
    expect(decision.scope).toBe('ip')
  })
})
