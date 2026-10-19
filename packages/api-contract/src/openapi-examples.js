/**
 * Sample values for the published document.
 *
 * Swagger UI draws an example body for every request and response from the
 * schema alone. Left to itself it builds a string from a field's `pattern`,
 * so a timestamp came out as `3971-02-23T10:44:40.0714+15:32`, an id as a run
 * of random letters, and an error's `statusCode` as `100`, its minimum. A
 * reader trying to understand the API learns nothing from those, and some of
 * them are wrong in a way that misleads.
 *
 * This module adds an `examples` annotation to the string schemas whose shape
 * it recognises (an id, a timestamp, a date, a currency, an address) and an
 * `example` to each error response. Both are annotations: OpenAPI 3.1 and JSON
 * Schema say they change nothing about what is valid, and the server validates
 * requests with its Zod schemas, never with this document. Every value is
 * checked against the schema's own `pattern` and length bounds before it is
 * written, so a sample can never contradict the field it illustrates.
 *
 * @module @desi-event/api-contract/openapi-examples
 */

/** An id in the shape the database issues. */
const SAMPLE_ID = 'cm2v8k3pa0001qz7x5b4e9t2d'

/**
 * Sample strings, tried in order. The first whose test accepts the schema and
 * whose value the schema accepts is used. `test(schema, name)` says whether
 * the sample fits a schema; `value(name)` is the sample.
 *
 * @type {ReadonlyArray<{test: Function, value: Function}>}
 */
const STRING_SAMPLES = Object.freeze([
  {
    test: (schema) => schema.format === 'date-time',
    value: () => '2026-11-07T23:30:00.000Z',
  },
  { test: (schema) => schema.format === 'email', value: () => 'aanya.patel@mail.example' },
  { test: (schema) => schema.pattern === '^\\d{4}-\\d{2}-\\d{2}$', value: () => '2026-11-07' },
  {
    test: (schema) => schema.pattern === '^([01]\\d|2[0-3]):[0-5]\\d$',
    value: () => '19:30',
  },
  { test: (schema) => schema.pattern === '^[a-z][a-z0-9]{7,31}$', value: () => SAMPLE_ID },
  {
    test: (schema) => schema.pattern === '^\\/v1\\/media\\/[a-z][a-z0-9]{7,31}$',
    value: () => `/v1/media/${SAMPLE_ID}`,
  },
  {
    test: (schema) => schema.pattern === '^[a-z0-9]+(?:-[a-z0-9]+)*$',
    value: () => 'mirrorwork-live-band-night',
  },
  { test: (schema) => schema.pattern === '^[A-Z]{3}$', value: () => 'USD' },
  {
    test: (schema) => schema.pattern === '^[A-Z]{2}$',
    value: (name) => (/country/i.test(name) ? 'US' : 'NJ'),
  },
  {
    test: (schema) => schema.pattern === '^\\+?[0-9][0-9 ()-]{4,}$',
    value: () => '+1 732 555 0142',
  },
  {
    test: (schema) => schema.pattern === '^[A-Z0-9][A-Z0-9-]{4,30}[A-Z0-9]$',
    value: () => 'DIWALI-2026',
  },
  {
    test: (schema, name) => /reference/i.test(name) && typeof schema.pattern === 'string',
    value: () => 'DE-US-200016',
  },
  {
    test: (schema) => typeof schema.pattern === 'string' && schema.pattern.startsWith('^••••@'),
    value: () => '••••@mail.example',
  },
])

/**
 * Whether a schema already says what a value looks like.
 *
 * @param {object} schema A JSON Schema node.
 * @returns {boolean} True when a sample would add nothing or could disagree.
 */
function alreadyIllustrated(schema) {
  return ['example', 'examples', 'const', 'enum', 'default'].some((key) => key in schema)
}

/**
 * Whether a string schema accepts a value.
 *
 * @param {object} schema A string schema.
 * @param {string} value The candidate.
 * @returns {boolean} True when the value passes the schema's pattern and bounds.
 */
function accepts(schema, value) {
  if (typeof schema.minLength === 'number' && value.length < schema.minLength) return false
  if (typeof schema.maxLength === 'number' && value.length > schema.maxLength) return false
  if (typeof schema.pattern !== 'string') return true

  try {
    return new RegExp(schema.pattern, 'u').test(value)
  } catch {
    try {
      return new RegExp(schema.pattern).test(value)
    } catch {
      return false
    }
  }
}

/**
 * The sample for one string schema, if this module knows its shape.
 *
 * @param {object} schema A JSON Schema node with `type: 'string'`.
 * @param {string} name The property or parameter it describes, or `''`.
 * @returns {string|undefined} A value the schema accepts, or nothing.
 */
export function sampleString(schema, name = '') {
  for (const sample of STRING_SAMPLES) {
    if (!sample.test(schema, name)) continue
    const value = sample.value(name)
    if (accepts(schema, value)) return value
  }

  return undefined
}

/**
 * Annotate one schema tree in place.
 *
 * @param {unknown} node A JSON Schema node, or anything inside one.
 * @param {string} name The property or parameter the node describes.
 * @returns {void}
 */
function annotate(node, name) {
  if (Array.isArray(node)) {
    for (const item of node) annotate(item, name)
    return
  }
  if (!node || typeof node !== 'object') return

  const schema = /** @type {Record<string, unknown>} */ (node)

  if (schema.type === 'string' && !alreadyIllustrated(schema)) {
    const value = sampleString(schema, name)
    if (value !== undefined) schema.examples = [value]
  }

  for (const [key, child] of Object.entries(schema)) {
    if (key === 'properties' && child && typeof child === 'object') {
      for (const [property, propertySchema] of Object.entries(child)) {
        annotate(propertySchema, property)
      }
    } else if (key !== 'examples' && key !== 'example') {
      // `anyOf`, `items` and the rest describe the same value as their
      // parent, so they keep its name.
      annotate(child, name)
    }
  }
}

/**
 * The example body for an error response.
 *
 * @param {{status: number, code: string, description: string}} error An `API_ERRORS` entry.
 * @returns {{error: {code: string, message: string, statusCode: number}}} The envelope as the server sends it.
 */
export function errorExample(error) {
  return {
    error: {
      code: error.code,
      message: error.description.split(/(?<=\.)\s/u)[0],
      statusCode: error.status,
    },
  }
}

/**
 * Add sample values to a whole document, in place.
 *
 * @param {object} document An OpenAPI 3.1 document from `buildOpenApiDocument`.
 * @returns {object} The same document.
 */
export function addSampleValues(document) {
  for (const [name, schema] of Object.entries(document.components?.schemas ?? {})) {
    annotate(schema, name)
  }

  for (const item of Object.values(document.paths ?? {})) {
    for (const operation of Object.values(item ?? {})) {
      for (const parameter of operation.parameters ?? []) {
        annotate(parameter.schema, parameter.name)
      }
      for (const media of Object.values(operation.requestBody?.content ?? {})) {
        annotate(media.schema, '')
      }
      for (const response of Object.values(operation.responses ?? {})) {
        for (const media of Object.values(response.content ?? {})) {
          annotate(media.schema, '')
        }
      }
    }
  }

  return document
}
