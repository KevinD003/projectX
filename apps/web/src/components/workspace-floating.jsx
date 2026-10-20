'use client'

/**
 * The workspace bar's and rail's floating layers, loaded on first use.
 *
 * The area switcher's menu, the page finder's popover and the folded rail's
 * tooltips are Base UI's, and its positioning comes with them. They live
 * here, apart from `workspace-nav.jsx`, so that module (which every
 * workspace page, the wallet and the door draw) stays light; it fetches this
 * one when somebody reaches for a control, or when the rail folds.
 *
 * @module components/workspace-floating
 */

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useId, useState } from 'react'
import { Icon } from '@desi-event/ui/icons'
import { Menu } from '@desi-event/ui/menu'
import { Popover } from '@desi-event/ui/popover'
import { Tooltip } from '@desi-event/ui/tooltip'

import { navIcon } from '../lib/nav-icons.js'

/**
 * @typedef {object} AreaMenuProps
 * @property {Array<{href: string, label: string}>} items The other areas.
 * @property {boolean} open Whether the menu is open.
 * @property {function(boolean): void} onOpenChange Called with the next state.
 * @property {JSX.Element} trigger The button that opens it.
 */

/**
 * The area switcher's menu.
 *
 * @param {AreaMenuProps} props Component props.
 * @returns {JSX.Element} The trigger and, while open, the menu.
 */
export function AreaMenu({ items, open, onOpenChange, trigger }) {
  return (
    <Menu
      align="start"
      linkAs={Link}
      open={open}
      onOpenChange={onOpenChange}
      items={items}
      trigger={trigger}
    />
  )
}

/**
 * @typedef {object} FinderPopoverProps
 * @property {Array<{href: string, label: string}>} items Every page the rail offers.
 * @property {boolean} open Whether the popover is open.
 * @property {function(boolean): void} onOpenChange Called with the next state.
 * @property {JSX.Element} trigger The button that opens it.
 */

/**
 * The page finder's popover: type part of a page's name, and go. Enter goes
 * to the first match.
 *
 * @param {FinderPopoverProps} props Component props.
 * @returns {JSX.Element} The trigger and, while open, the finder.
 */
export function FinderPopover({ items, open, onOpenChange, trigger }) {
  const [query, setQuery] = useState('')
  const router = useRouter()
  const inputId = useId()
  const words = query.trim().toLocaleLowerCase('en-US')
  const matches = words
    ? items.filter((item) => item.label.toLocaleLowerCase('en-US').includes(words))
    : items

  /**
   * Open or close, starting each opening with an empty box.
   *
   * @param {boolean} next Whether it should be open.
   * @returns {void}
   */
  function change(next) {
    onOpenChange(next)
    if (next) setQuery('')
  }

  return (
    <Popover open={open} onOpenChange={change} align="end" className="w-80" trigger={trigger}>
      <form
        role="search"
        aria-label="Find a page in the workspace"
        onSubmit={(event) => {
          event.preventDefault()
          if (matches[0]) {
            onOpenChange(false)
            router.push(matches[0].href)
          }
        }}
      >
        <label htmlFor={inputId} className="text-label font-semibold text-ink">
          Page name
        </label>
        <input
          id={inputId}
          type="search"
          autoComplete="off"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="mt-1.5 block min-h-11 w-full rounded-control border border-line-strong bg-surface px-3 text-base text-ink shadow-control focus:outline-2 focus:outline-offset-2 focus:outline-focus sm:text-sm"
        />
      </form>
      <p role="status" className="text-caption text-ink-muted">
        {matches.length === 1 ? '1 page' : `${matches.length} pages`}
      </p>
      {matches.length > 0 ? (
        <ul className="-mx-1 flex max-h-72 flex-col gap-0.5 overflow-y-auto">
          {matches.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={() => onOpenChange(false)}
                className="flex min-h-11 items-center gap-3 rounded-control px-2 text-label font-semibold text-ink transition-colors duration-(--duration-fast) hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-focus"
              >
                <Icon name={navIcon(item.href)} className="h-5 w-5 text-ink-muted" />
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </Popover>
  )
}

/**
 * A folded rail entry's tooltip, repeating the words the fold hides.
 *
 * @param {object} props Component props.
 * @param {string} props.content The entry's words.
 * @param {JSX.Element} props.children The entry's link.
 * @returns {JSX.Element} The link, with its tooltip.
 */
export function RailTooltip({ content, children }) {
  return (
    <Tooltip content={content} side="right">
      {children}
    </Tooltip>
  )
}
