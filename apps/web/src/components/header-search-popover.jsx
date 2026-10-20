'use client'

/**
 * The header search's popover and its form, loaded on first use.
 *
 * Kept apart from `header-search.jsx` so the positioning library behind
 * `Popover` (Base UI) is fetched only when somebody reaches for search, not
 * by every page that draws the header (`header-search.jsx` says how).
 *
 * @module components/header-search-popover
 */

import Form from 'next/form'
import { useId } from 'react'
import { Popover } from '@desi-event/ui/popover'

import { Button, Input } from './ui.jsx'

/** The longest search the listing reads; more is cut there anyway. */
export const MAX_QUERY_LENGTH = 100

/**
 * @typedef {object} HeaderSearchPopoverProps
 * @property {boolean} open Whether the popover is open.
 * @property {function(boolean): void} onOpenChange Called with the next state.
 * @property {JSX.Element} trigger The button that opens it.
 */

/**
 * The popover: a GET form to the listing's search.
 *
 * @param {HeaderSearchPopoverProps} props Component props.
 * @returns {JSX.Element} The trigger and, while open, the form.
 */
export default function HeaderSearchPopover({ open, onOpenChange, trigger }) {
  const inputId = useId()

  return (
    <Popover
      open={open}
      onOpenChange={onOpenChange}
      align="end"
      className="w-[min(26rem,calc(100vw-2rem))]"
      trigger={trigger}
    >
      <Form
        action="/events"
        role="search"
        aria-label="Search events"
        onSubmit={() => onOpenChange(false)}
        className="flex flex-col gap-3"
      >
        <label htmlFor={inputId} className="text-label font-semibold text-ink">
          Search events, venues, cities and organisers
        </label>
        <div className="flex gap-2">
          <Input
            id={inputId}
            name="q"
            type="search"
            maxLength={MAX_QUERY_LENGTH}
            autoComplete="off"
            className="min-w-0 flex-1"
          />
          <Button type="submit">Search</Button>
        </div>
      </Form>
    </Popover>
  )
}
