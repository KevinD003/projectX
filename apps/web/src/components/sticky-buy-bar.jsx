'use client'

/**
 * The bar that keeps the price and the way to the tickets in reach on a
 * phone, while the event page is read.
 *
 * Below the desk breakpoint the tickets box sits at the foot of a long page,
 * so this bar is fixed to the bottom of the screen: the "from" price, what it
 * includes, and a link down to the tickets. It steps out of the way while the
 * tickets box itself is on screen, so it never covers the thing it points
 * to, and the page leaves room for it at its foot (`globals.css` pads the
 * scroll so a focused control is never hidden behind it). From the desk
 * breakpoint up the tickets box stands beside the page and the bar is not
 * drawn.
 *
 * It is a link, not a second "Choose tickets": the choice is made in the
 * tickets box, with the tiers in view. Without JavaScript it simply stays.
 *
 * @module components/sticky-buy-bar
 */

import { useEffect, useState } from 'react'
import { buttonClasses } from '@desi-event/ui/classes'

import { ArrowRightIcon } from './icons.jsx'

/**
 * @typedef {object} StickyBuyBarProps
 * @property {string} amount The "from" price, formatted.
 * @property {string} note What it includes, such as "with fees".
 * @property {string} [target] The id of the tickets box.
 */

/**
 * The bar.
 *
 * @param {StickyBuyBarProps} props Component props.
 * @returns {JSX.Element} The bar.
 */
export function StickyBuyBar({ amount, note, target = 'tickets' }) {
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    const box = document.getElementById(target)

    if (!box || typeof IntersectionObserver === 'undefined') return undefined

    const observer = new IntersectionObserver(([entry]) => setHidden(entry.isIntersecting))

    observer.observe(box)

    return () => observer.disconnect()
  }, [target])

  return (
    <div
      data-buy-bar=""
      data-hidden={hidden ? '' : undefined}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface-raised px-4 py-3 shadow-floating transition-[translate,visibility] duration-(--duration-base) ease-out data-hidden:invisible data-hidden:translate-y-full sm:px-6 lg:hidden"
    >
      <div className="mx-auto flex max-w-content items-center justify-between gap-4">
        <p className="min-w-0 leading-tight">
          <span className="block text-title font-bold text-ink tabular-nums">From {amount}</span>
          <span className="block text-caption text-ink-muted">{note}</span>
        </p>
        <a
          href={`#${target}`}
          tabIndex={hidden ? -1 : undefined}
          className={buttonClasses({ variant: 'primary', size: 'md', element: 'link' })}
        >
          See tickets
          <ArrowRightIcon className="h-4.5 w-4.5" />
        </a>
      </div>
    </div>
  )
}
