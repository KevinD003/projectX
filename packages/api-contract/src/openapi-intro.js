/**
 * The words at the top of the published API document.
 *
 * `info.description` is the first thing a reader of `/docs` sees, before any
 * route. It answers the four questions somebody calling the API for the first
 * time has: where it lives, how to sign in, what a failure looks like and how
 * hard they may push. Everything here is true of the running service: the
 * budgets are the defaults in `apps/api/src/plugins/rate-limit.js`, the
 * envelope is `apiErrorResponseSchema`, and the cookie and header names are
 * the security schemes this document declares.
 *
 * Markdown, because Swagger UI renders `info.description` as Markdown.
 *
 * @module @desi-event/api-contract/openapi-intro
 */

/**
 * The document's `info.description`.
 *
 * @type {string}
 */
export const API_DESCRIPTION = [
  'The API behind The Desi Events: South Asian concerts, comedy, garba, Durga Puja, Diwali and Holi nights and the rest of the calendar, across the USA and Canada. The website runs on exactly these routes, so anything it can do, a script can do too.',
  '',
  '### Base URL',
  '',
  'Every route sits under `/v1` on the API host, except the health probe at `/health`. Run locally, that host is `http://127.0.0.1:4000`. Requests and answers are JSON unless a route says otherwise (picture uploads are raw image bytes).',
  '',
  '### Signing in',
  '',
  '`POST /v1/auth/login` with an email address and password. The answer sets a session cookie and also returns the same secret as `token`.',
  '',
  '- **From a browser**, the cookie does the work. A request that changes something must also copy the CSRF cookie (`__Host-desi_csrf` over HTTPS, `desi_csrf` on a plain-HTTP local run) into the `x-desi-csrf` header.',
  '- **From a script**, send `Authorization: Bearer <token>` instead.',
  '',
  'An account with a second factor answers `mfaRequired` first; send the same request again with the six-digit `code` to finish. A few actions, such as changing somebody’s platform role, also ask you to confirm your second factor again a moment before (`POST /v1/auth/step-up`). Each operation below names the power it needs.',
  '',
  '### Errors',
  '',
  'Every failure has the same shape, whatever went wrong:',
  '',
  '```json',
  '{',
  '  "error": {',
  '    "code": "VALIDATION_ERROR",',
  '    "message": "Choose at least one ticket.",',
  '    "statusCode": 400,',
  '    "issues": [{ "path": "/items", "code": "too_small", "message": "Choose at least one ticket." }]',
  '  }',
  '}',
  '```',
  '',
  '`code` is stable and safe to branch on; `message` is a sentence for a person. `issues` lists the fields a `400` refused, and some refusals add `problems` or `reason`. A `503` carrying `Retry-After` means nothing was changed and the same request can be sent again.',
  '',
  '### Rate limits',
  '',
  'By default each address may send 300 requests a minute across the API, and the sign-in routes allow 10 a minute. A handful of others (ticket passes, door scans, uploads, price quotes) keep tighter budgets of their own; every operation that can refuse for this lists a `429` response. Past a budget the answer is `429` with `Retry-After` in seconds, and the error code `RATE_LIMITED`.',
  '',
  '### Payments',
  '',
  'Payments are simulated, or run in a payment provider’s test mode. No card is charged and no money moves, whatever an order says it cost; `GET /health` reports which mode is on.',
].join('\n')
