'use client'

/**
 * The public shell's footer, chosen by the page's path (`lib/footer-variant.js`).
 *
 * Both footers are drawn on the server and handed in; this only picks one.
 * It reads the path on the client because a layout is not drawn again on a
 * client navigation: an event page and its checkout share the events
 * layout, so a choice made there would follow the visitor from the poster to
 * the basket.
 *
 * @module components/public-footer
 */

import { usePathname } from 'next/navigation'

import { footerVariant } from '../lib/footer-variant.js'

/**
 * @typedef {object} PublicFooterProps
 * @property {ReactNode} full The full plate, for a page that persuades.
 * @property {ReactNode} compact The compact footer, for a page somebody is using.
 */

/**
 * The footer this page ends with.
 *
 * @param {PublicFooterProps} props Component props.
 * @returns {ReactNode} One of the two.
 */
export function PublicFooter({ full, compact }) {
  return footerVariant(usePathname()) === 'compact' ? compact : full
}
