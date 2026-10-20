'use client'

/**
 * The header's search trigger: a button that opens a small search form.
 *
 * The listing's own search (`/events`, "Find events") is the real one, with
 * the city, date and category filters beside it; this is the way to it from
 * any page, without first going there. The form is a GET to `/events` with
 * the words as `q`, the same parameter the listing reads, submitted through
 * `next/form` so the listing opens as a client navigation. With no
 * JavaScript the button does nothing and "Discover events" is the way in.
 *
 * The form exists only while the popover is open, so a page never carries a
 * second search box, and the header's tab order is unchanged until somebody
 * asks for it. Drawn from 1024px; below that the row has no room, and the
 * Menu sheet leads to the listing.
 *
 * @module components/header-search
 */

import { Suspense, forwardRef, lazy, useState } from 'react'
import { Icon } from '@desi-event/ui/icons'

/** Where the popover and its form live, fetched on first use. */
const load = () => import('./header-search-popover.jsx')

const HeaderSearchPopover = lazy(load)

/** The trigger's look, the same before and after the popover has loaded. */
const TRIGGER =
  'hidden min-h-11 items-center gap-2 rounded-control px-3 text-label font-semibold text-ink transition-colors duration-(--duration-fast) ease-standard hover:bg-surface-subtle hover:text-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus lg:inline-flex'

/**
 * The Search button.
 *
 * @param {object} props Button props.
 * @param {object} ref Its element.
 * @returns {JSX.Element} The button.
 */
const SearchTrigger = forwardRef(function SearchTrigger(props, ref) {
  return (
    <button ref={ref} type="button" className={TRIGGER} {...props}>
      <Icon name="search" className="h-5 w-5" />
      Search
    </button>
  )
})

/**
 * The search trigger and its form.
 *
 * Until somebody reaches for it, this is a plain button and nothing else: the
 * popover's module (and the positioning library under it) is fetched when a
 * pointer comes over the button or focus lands on it, and drawn when it is
 * pressed, already open. Every page draws the header; few pages are searched
 * from it.
 *
 * @returns {JSX.Element} The trigger, with the form in its popover once asked for.
 */
export function HeaderSearch() {
  const [asked, setAsked] = useState(false)
  const [open, setOpen] = useState(false)

  if (!asked) {
    return (
      <SearchTrigger
        aria-haspopup="dialog"
        aria-expanded="false"
        onPointerEnter={load}
        onFocus={load}
        onClick={() => {
          setAsked(true)
          setOpen(true)
        }}
      />
    )
  }

  return (
    <Suspense
      fallback={<SearchTrigger aria-haspopup="dialog" aria-expanded="true" aria-busy="true" />}
    >
      <HeaderSearchPopover open={open} onOpenChange={setOpen} trigger={<SearchTrigger />} />
    </Suspense>
  )
}
