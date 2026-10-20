'use client'

/**
 * Marks the document once the visitor has moved by a client navigation.
 *
 * Plate registration (`globals.css`) is a once-per-load moment: the poster
 * prints itself as the page first arrives. On a client navigation from the
 * listing to an event, the poster is already arriving another way, morphing
 * from its card into the hero (the shared view transition), and the two
 * signature motions stacked on one object. With `data-navigated` on `<html>`
 * the stylesheet leaves registration out, so after the first page a poster
 * arrives by the morph alone.
 *
 * The mark is set in a layout effect, in the same commit that inserts the new
 * page and before the browser styles it, so a poster's impressions never
 * start their animation to be cut off. It is never taken off: every later
 * page in the visit is a client navigation too.
 *
 * @module components/navigation-mark
 */

import { useLayoutEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

/**
 * Mark a document as navigated.
 *
 * @param {HTMLElement} root The document element.
 * @returns {void}
 */
export function markNavigated(root) {
  if (!('navigated' in root.dataset)) root.dataset.navigated = ''
}

/**
 * Watches the path, and marks the document when it first changes.
 *
 * @returns {null} Nothing drawn.
 */
export function NavigationMark() {
  const pathname = usePathname()
  const first = useRef(pathname)

  useLayoutEffect(() => {
    if (pathname !== first.current) markNavigated(document.documentElement)
  }, [pathname])

  return null
}
