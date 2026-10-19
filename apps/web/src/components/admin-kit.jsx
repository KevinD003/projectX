/**
 * Small pieces the platform's working pages share: administration,
 * moderation, finance, operations, privacy and retention.
 *
 * They sit beside the workspace kit (`workspace-kit.jsx`) rather than inside
 * it, because they are about how a dense list reads, which the organiser's
 * pages do not need in the same way:
 *
 * - `StatusWord`: a status as a colour, a glyph and a word, so it is never
 *   carried by colour alone (WCAG 1.4.1). The glyph is the component
 *   library's `StatusIcon`, one shape per meaning.
 * - `FilterLinks`: a row of filter links, the current one marked with
 *   `aria-current` and drawn filled. Links, not buttons, so a filtered list
 *   works without JavaScript and can be bookmarked.
 * - `Instant`: a moment on two short lines, the day over the time, so a date
 *   in a table column never wraps into four ragged lines.
 * - `AllClear`: an empty queue said in one quiet line with a success glyph,
 *   rather than a dashed box the height of a card. An empty queue is the
 *   resting state of a working page, not an event.
 * - `EmailText`: an email address that wraps before its `@` and its dots, the
 *   places a person would break it, rather than mid-word.
 *
 * Server-renderable; no hooks.
 *
 * @module components/admin-kit
 */

import Link from 'next/link'

import { formatDateIn } from '../lib/format.js'
import { StatusIcon } from './ui.jsx'

/**
 * Each tone a status can take, the classes it is drawn in and the glyph it
 * wears. The names are the `Badge` variants the vocabularies already use, so
 * a reading written for a badge draws the same here.
 *
 * @type {Readonly<Record<string, {classes: string, glyph: string}>>}
 */
export const STATUS_WORD_TONES = Object.freeze({
  success: { classes: 'bg-status-success-soft text-status-success', glyph: 'success' },
  warning: { classes: 'bg-status-warning-soft text-status-warning', glyph: 'warning' },
  danger: { classes: 'bg-status-danger-soft text-status-danger', glyph: 'danger' },
  info: { classes: 'bg-status-info-soft text-status-info', glyph: 'info' },
  pending: { classes: 'bg-status-pending-soft text-status-pending', glyph: 'pending' },
  refusal: { classes: 'bg-status-refusal-soft text-status-refusal', glyph: 'refusal' },
  mock: { classes: 'bg-status-mock-soft text-status-mock', glyph: 'mock' },
  brand: { classes: 'bg-accent-soft text-accent-strong', glyph: 'info' },
  secondary: { classes: 'bg-accent-secondary-soft text-accent-secondary', glyph: 'info' },
  highlight: { classes: 'bg-highlight text-highlight-ink', glyph: 'success' },
  neutral: { classes: 'bg-status-neutral-soft text-status-neutral', glyph: 'neutral' },
})

/**
 * @typedef {object} StatusWordProps
 * @property {string} [tone] One of {@link STATUS_WORD_TONES}; anything else draws neutral.
 * @property {string} [srLabel] Words read before the status, such as "State:".
 * @property {ReactNode} children The status, in words.
 */

/**
 * A status: colour, glyph and word.
 *
 * @param {StatusWordProps} props Component props.
 * @returns {JSX.Element} The status.
 */
export function StatusWord({ tone = 'neutral', srLabel, children }) {
  const known = STATUS_WORD_TONES[tone] ? tone : 'neutral'
  const { classes, glyph } = STATUS_WORD_TONES[known]

  return (
    <span
      data-slot="status-word"
      data-tone={known}
      className={`inline-flex max-w-full items-center gap-1 rounded-full py-0.5 pr-2.5 pl-1 text-xs font-semibold ${classes}`}
    >
      <StatusIcon tone={glyph} className="size-4 shrink-0" />
      {srLabel ? <span className="sr-only">{srLabel} </span> : null}
      <span className="min-w-0">{children}</span>
    </span>
  )
}

/**
 * The classes for one filter link.
 *
 * @param {boolean} current Whether it is the filter in force.
 * @returns {string} The classes.
 */
export function filterLinkClasses(current) {
  return `inline-flex min-h-11 items-center rounded-full px-4 text-sm transition-colors duration-(--duration-fast) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
    current
      ? 'bg-action-primary font-semibold text-action-primary-ink'
      : 'border border-line bg-surface-raised font-medium text-ink-muted hover:bg-surface-subtle hover:text-ink'
  }`
}

/**
 * @typedef {object} FilterLinksProps
 * @property {string} label The navigation's name, such as "Which events".
 * @property {Array<{key?: string, href: string, label: string, current: boolean}>} items The filters.
 * @property {string} [className] Placement.
 */

/**
 * A row of filter links.
 *
 * @param {FilterLinksProps} props Component props.
 * @returns {JSX.Element} The navigation.
 */
export function FilterLinks({ label, items, className = '' }) {
  return (
    <nav aria-label={label} className={className}>
      <ul className="flex flex-wrap gap-2">
        {items.map((item) => (
          <li key={item.key ?? item.label}>
            <Link
              href={item.href}
              aria-current={item.current ? 'page' : undefined}
              className={filterLinkClasses(item.current)}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}

/**
 * The time of day an instant falls at, with its zone.
 *
 * @param {string|Date} value An ISO-8601 instant or `Date`.
 * @param {string} [timeZone] IANA zone; UTC when absent.
 * @returns {string|null} "12:45 PM UTC", or null when there is no instant.
 */
export function formatTimeIn(value, timeZone = 'UTC') {
  const at = value instanceof Date ? value : value ? new Date(value) : null
  if (!at || Number.isNaN(at.getTime())) return null

  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
    timeZoneName: 'short',
  }).format(at)
}

/**
 * @typedef {object} InstantProps
 * @property {string|null|undefined} value An ISO-8601 instant.
 * @property {string} [timeZone] IANA zone; UTC when absent.
 * @property {string} [fallback] What to draw when there is no instant.
 */

/**
 * A moment as a `time` element on two lines: the day, then the time.
 *
 * @param {InstantProps} props Component props.
 * @returns {JSX.Element} The moment.
 */
export function Instant({ value, timeZone = 'UTC', fallback = '' }) {
  const day = formatDateIn(value, timeZone)
  const time = formatTimeIn(value, timeZone)

  if (!day || !time) return <span className="text-ink-muted">{fallback}</span>

  return (
    <time dateTime={value} className="block tabular-nums">
      <span className="block whitespace-nowrap">{day}</span>
      <span className="block text-xs whitespace-nowrap text-ink-muted">{time}</span>
    </time>
  )
}

/**
 * @typedef {object} EmailTextProps
 * @property {string|null|undefined} address The address.
 * @property {string} [fallback] What to draw when there is none.
 */

/**
 * An email address that wraps where a reader expects it to.
 *
 * `break-all` in a narrow column split "new-organiser@desi-event.example"
 * anywhere it ran out of room ("new-organiser@desi-e / vent.example"). This
 * offers a break just before the `@` and before each dot of the domain, and
 * only lets a part break inside itself when it is wider than its column on
 * its own (`break-words`, which, unlike `wrap-anywhere`, leaves a table
 * column at least as wide as the longest whole part). `<wbr>` adds a break opportunity and nothing else, so the address
 * is one run of text to a screen reader and to copy and paste.
 *
 * @param {EmailTextProps} props Component props.
 * @returns {JSX.Element} The address.
 */
export function EmailText({ address, fallback = 'Not shown' }) {
  if (typeof address !== 'string' || address.trim() === '') {
    return <span className="text-ink-muted">{fallback}</span>
  }

  const at = address.lastIndexOf('@')

  if (at <= 0) return <span className="break-words">{address}</span>

  const domain = address.slice(at + 1).split('.')

  return (
    <span data-slot="email" className="break-words">
      {address.slice(0, at)}
      <wbr />@
      {domain.map((part, index) => (
        <span key={`${index}-${part}`}>
          {index > 0 ? (
            <>
              <wbr />.
            </>
          ) : null}
          {part}
        </span>
      ))}
    </span>
  )
}

/**
 * @typedef {object} AllClearProps
 * @property {string} title What is true, such as "Nothing unresolved".
 * @property {string} [description] The sentence that says why that is good news.
 * @property {string} [className] Placement.
 */

/**
 * An empty queue, in one line.
 *
 * @param {AllClearProps} props Component props.
 * @returns {JSX.Element} The line.
 */
export function AllClear({ title, description, className = 'mt-3' }) {
  return (
    <div data-slot="all-clear" className={`flex items-start gap-2.5 ${className}`}>
      <StatusIcon tone="success" className="mt-0.5 shrink-0 text-status-success" />
      <p className="text-sm text-ink-muted">
        <span className="font-semibold text-ink">{title}.</span>
        {description ? ` ${description}` : null}
      </p>
    </div>
  )
}
