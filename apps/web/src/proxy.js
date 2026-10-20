/**
 * The request proxy (Next.js 16's name for middleware).
 *
 * It does three things. It copies the request's path and query onto the
 * request as a header, so a server layout — which Next.js never tells which
 * page it wraps — can read it. The root layout uses it to choose the page's colour register;
 * the signed-in area layouts use it to send somebody to sign in and bring them
 * back to the page they asked for, not to the top of the area.
 *
 * It sets the HTTP security headers every page response carries: a per-request
 * nonce Content-Security-Policy (so a stray script, href or markup sink cannot
 * execute even with no other guard), `X-Frame-Options`/`frame-ancestors`
 * against clickjacking, `X-Content-Type-Options: nosniff` and a
 * `Referrer-Policy`. See {@link contentSecurityPolicy}.
 *
 * It decides nothing about access. Every area layout reads the session itself
 * and the API authorises every request again; a proxy that tried to gate
 * pages would be a second, weaker copy of those checks.
 *
 * The header is always set, never merely forwarded, so a value a browser sent
 * under the same name is overwritten before anything reads it.
 *
 * And it answers an address whose percent-escapes do not decode
 * (`/events/%E0%A4%A`, a link cut off mid-character) with the site's own page
 * for it, `/bad-address`, still as a `400`. Left alone, Next.js fails to
 * decode the route's parameter and answers with its own bare, unbranded
 * "400 | Bad Request" document. The visitor's address bar keeps what they
 * typed; nothing from it is read or shown.
 *
 * @module proxy
 */

import { NextResponse } from 'next/server'

import { REQUEST_PATH_HEADER } from './lib/request-path-header.js'

/** The site's page for an address that cannot be read. */
export const BAD_ADDRESS_PATH = '/bad-address'

/** The HTTP security header carrying the content security policy. */
export const CSP_HEADER = 'content-security-policy'

/**
 * A fresh, unpredictable nonce for one request's inline/first-party scripts.
 *
 * Next.js reads it from the request's CSP header during server rendering and
 * stamps it onto every framework and page script it emits, so `strict-dynamic`
 * can trust those and nothing else.
 *
 * @returns {string} A base64 nonce.
 */
export function generateNonce() {
  return Buffer.from(crypto.randomUUID()).toString('base64')
}

/**
 * The page content security policy, with this request's nonce.
 *
 * `script-src` trusts only the nonce and what the nonced loader pulls in
 * (`strict-dynamic`), never `'unsafe-inline'`, so an injected `<script>` or a
 * `javascript:` href cannot run. `style-src` keeps `'unsafe-inline'`: React,
 * the view-transition styles and Framer Motion all set inline `style`
 * attributes, which a nonce cannot cover. `img-src` allows the `data:`/`blob:`
 * the QR code and poster rendering use; everything else is same-origin, which
 * covers the API (reached through the same-origin proxy). `frame-ancestors
 * 'none'` is the clickjacking guard (with `X-Frame-Options: DENY` for older
 * browsers in {@link applySecurityHeaders}).
 *
 * In development Next and React evaluate code with `eval` (fast refresh,
 * reconstructed server stacks), so `'unsafe-eval'` is added there and only
 * there; a production build needs neither.
 *
 * @param {string} nonce This request's nonce.
 * @returns {string} The policy, as one header line.
 */
export function contentSecurityPolicy(nonce) {
  const devEval = process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''

  return [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${devEval}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob:`,
    `font-src 'self'`,
    `connect-src 'self'`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `frame-ancestors 'none'`,
    `form-action 'self'`,
  ].join('; ')
}

/**
 * Set the fixed security headers, and the given policy, on a response.
 *
 * @param {Headers} headers The response headers to add to.
 * @param {string} csp The content security policy for this response.
 * @returns {void}
 */
export function applySecurityHeaders(headers, csp) {
  headers.set(CSP_HEADER, csp)
  headers.set('x-content-type-options', 'nosniff')
  headers.set('referrer-policy', 'strict-origin-when-cross-origin')
  headers.set('x-frame-options', 'DENY')
}

/**
 * Whether a path's percent-escapes fail to decode.
 *
 * @param {string} pathname The path, as requested.
 * @returns {boolean} True when it cannot be decoded.
 */
export function isMalformedPath(pathname) {
  try {
    decodeURIComponent(pathname)

    return false
  } catch {
    return true
  }
}

/**
 * The site's page for an unreadable address, answered with `400`.
 *
 * A rewrite alone would render the page with `200`: a page cannot set its
 * own status in the App Router. So the proxy renders it with an ordinary
 * request to its own origin, carrying the visitor's cookies so the header
 * still says who is signed in, and answers with that document and `400`. If
 * that request fails, the rewrite is still the visitor's best page, at
 * `200`.
 *
 * @param {object} request The incoming `NextRequest`.
 * @param {Headers} forwarded The request's headers, to continue with.
 * @param {string} csp This request's content security policy, for the fallback.
 * @returns {Promise<object>} The response.
 */
async function badAddress(request, forwarded, csp) {
  const target = request.nextUrl.clone()

  target.pathname = BAD_ADDRESS_PATH
  target.search = ''
  forwarded.set(REQUEST_PATH_HEADER, BAD_ADDRESS_PATH)

  try {
    const page = await fetch(target, {
      headers: { cookie: request.headers.get('cookie') ?? '', accept: 'text/html' },
      cache: 'no-store',
    })

    if (page.ok) {
      const headers = new Headers({
        'content-type': page.headers.get('content-type') ?? 'text/html; charset=utf-8',
        'cache-control': 'no-store',
      })

      // That inner render was proxied too, so its CSP header carries the nonce
      // stamped on the body it returned; serve that, not this request's, so the
      // policy matches the scripts in the document.
      applySecurityHeaders(headers, page.headers.get(CSP_HEADER) ?? csp)

      return new NextResponse(page.body, { status: 400, headers })
    }
  } catch {
    // Fall through to the rewrite below.
  }

  // The rewrite renders `/bad-address` in place without a second proxy pass, so
  // `forwarded` already carries this request's CSP for Next to stamp the body.
  const response = NextResponse.rewrite(target, { request: { headers: forwarded } })

  applySecurityHeaders(response.headers, csp)

  return response
}

/**
 * Record the path for the layouts and set the page security headers, or send
 * an unreadable address to the page that says so.
 *
 * @param {object} request The incoming `NextRequest`.
 * @returns {object} A `NextResponse` that continues the request with the headers set.
 */
export function proxy(request) {
  const forwarded = new Headers(request.headers)
  const { pathname, search } = request.nextUrl
  const nonce = generateNonce()
  const csp = contentSecurityPolicy(nonce)

  // Carry the policy on the request so Next stamps this nonce onto its scripts.
  forwarded.set(CSP_HEADER, csp)

  if (isMalformedPath(pathname)) return badAddress(request, forwarded, csp)

  forwarded.set(REQUEST_PATH_HEADER, `${pathname}${search}`)

  const response = NextResponse.next({ request: { headers: forwarded } })

  applySecurityHeaders(response.headers, csp)

  return response
}

export const config = {
  // Pages only. The API proxy, built assets, image optimisation and anything
  // with a file extension (icons, the manifest, the sitemap) have no layout to
  // inform, and running on them would only add latency.
  matcher: ['/((?!api/|_next/static|_next/image|.*\\.[a-zA-Z0-9]+$).*)'],
}
