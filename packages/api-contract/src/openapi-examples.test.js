import { describe, expect, it } from 'vitest'

import { buildOpenApiDocument } from './openapi.js'
import { addSampleValues, errorExample, sampleString } from './openapi-examples.js'
import { API_DESCRIPTION } from './openapi-intro.js'
import { API_ERRORS } from './routes.js'

const document = buildOpenApiDocument()

/**
 * Every schema node in the document carrying `examples`, with where it is.
 *
 * @param {unknown} node Anything in the document.
 * @param {string} at A path for failure messages.
 * @param {Array<{at: string, schema: object}>} found Collected nodes.
 * @returns {Array<{at: string, schema: object}>} The same list.
 */
function collectExamples(node, at = '#', found = []) {
  if (Array.isArray(node)) {
    node.forEach((item, index) => collectExamples(item, `${at}/${index}`, found))
  } else if (node && typeof node === 'object') {
    if (Array.isArray(node.examples) && node.type === 'string') found.push({ at, schema: node })
    for (const [key, child] of Object.entries(node)) {
      if (key !== 'examples' && key !== 'example') collectExamples(child, `${at}/${key}`, found)
    }
  }
  return found
}

describe('the document introduction', () => {
  it('is the default info.description, and says where, how to sign in, what fails and how fast', () => {
    expect(document.info.description).toBe(API_DESCRIPTION)
    for (const heading of [
      '### Base URL',
      '### Signing in',
      '### Errors',
      '### Rate limits',
      '### Payments',
    ]) {
      expect(API_DESCRIPTION).toContain(heading)
    }
    expect(API_DESCRIPTION).toContain('`/v1`')
    expect(API_DESCRIPTION).toContain('`POST /v1/auth/login`')
    expect(API_DESCRIPTION).toContain('`x-desi-csrf`')
    expect(API_DESCRIPTION).toContain('Authorization: Bearer <token>')
    expect(API_DESCRIPTION).toContain('`429` with `Retry-After`')
  })

  it('names only the error codes and statuses the API declares', () => {
    expect(API_DESCRIPTION).toContain(`"code": "${API_ERRORS.validation.code}"`)
    expect(API_DESCRIPTION).toContain(`\`${API_ERRORS.rateLimited.code}\``)
  })

  it('has no em dash and no promise of things to come', () => {
    expect(API_DESCRIPTION).not.toMatch(/—/u)
    expect(API_DESCRIPTION).not.toMatch(/\bsoon\b|\byet\b|planned|coming/iu)
  })
})

describe('sample values', () => {
  it('gives a timestamp a real, recent instant instead of one drawn from its pattern', () => {
    const health = document.paths['/health'].get.responses['200'].content['application/json']
    const timestamp = health.schema.properties.timestamp

    expect(timestamp.examples).toEqual(['2026-11-07T23:30:00.000Z'])
  })

  it('never writes a sample its own schema would refuse', () => {
    const found = collectExamples(document)

    expect(found.length).toBeGreaterThan(500)
    for (const { at, schema } of found) {
      for (const value of schema.examples) {
        if (typeof schema.pattern === 'string') {
          expect(new RegExp(schema.pattern, 'u').test(value), `${at}: ${value}`).toBe(true)
        }
        if (typeof schema.maxLength === 'number') {
          expect(value.length, at).toBeLessThanOrEqual(schema.maxLength)
        }
        if (typeof schema.minLength === 'number') {
          expect(value.length, at).toBeGreaterThanOrEqual(schema.minLength)
        }
      }
    }
  })

  it('leaves alone a schema that already says what it holds', () => {
    const withEnum = { type: 'string', enum: ['MOCK'], format: 'date-time' }
    const withDefault = { type: 'string', default: 'en-IN', pattern: '^[a-z]{2,3}$' }
    addSampleValues({ components: { schemas: { withEnum, withDefault } }, paths: {} })

    expect(withEnum).not.toHaveProperty('examples')
    expect(withDefault).not.toHaveProperty('examples')
  })

  it('writes nothing when the sample would break a length bound or a pattern', () => {
    expect(sampleString({ type: 'string', format: 'date-time', maxLength: 10 })).toBeUndefined()
    expect(sampleString({ type: 'string', pattern: '^[A-Z]{3}$', maxLength: 2 })).toBeUndefined()
    expect(sampleString({ type: 'string', pattern: '^x+$' })).toBeUndefined()
  })

  it('tells a country from a province or state by the field’s name', () => {
    expect(sampleString({ type: 'string', pattern: '^[A-Z]{2}$' }, 'country')).toBe('US')
    expect(sampleString({ type: 'string', pattern: '^[A-Z]{2}$' }, 'region')).toBe('NJ')
  })

  it('shows each error response as the envelope with its own code and status', () => {
    const login = document.paths['/v1/auth/login'].post.responses
    const example = login['429'].content['application/json'].example

    expect(example).toEqual({
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many attempts; retry after the interval in the `Retry-After` header.',
        statusCode: 429,
      },
    })
    for (const item of Object.values(document.paths)) {
      for (const operation of Object.values(item)) {
        for (const [status, response] of Object.entries(operation.responses)) {
          const media = response.content?.['application/json']
          if (media?.schema?.$ref !== '#/components/schemas/ErrorResponse') continue
          expect(media.example.error.statusCode).toBe(Number(status))
        }
      }
    }
  })

  it('keeps an error message to its first sentence', () => {
    expect(errorExample(API_ERRORS.unavailable).error.message).toBe(
      'A dependency (database or Redis) is unreachable, or the change waited too long behind another one saved at the same moment and nothing of it was kept.',
    )
  })
})
