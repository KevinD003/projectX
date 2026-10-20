/**
 * An event's picture: the organiser's approved cover, or the house poster.
 *
 * The cover arrives on an event payload only once a moderator has approved it
 * and the event is public, and only as a same-origin URL; anything else draws
 * the poster, which stays the fallback everywhere. The cover goes through
 * `next/image`, so a card gets a sized, re-encoded copy rather than the
 * original upload, and the optimiser — which fetches without cookies — can
 * only ever see a picture the API serves to anybody.
 *
 * The alt text is the organiser's own description. Where the picture sits
 * beside a title that already says what it is — a thumbnail, a basket — it is
 * decorative and says nothing.
 *
 * ## One object across a navigation
 *
 * With `transitionName`, the picture is a named React `ViewTransition`, so a
 * poster on the listing and the hero on the event's page are drawn as one
 * object moving and scaling between them (`share="poster-morph"`, 300ms; see
 * `globals.css`). A page may carry each name once: the caller that passes it
 * is the one place on the page that event's picture stands for it.
 *
 * `@file` rather than `@module`: `event` is a reserved token in a JSDoc
 * namepath.
 *
 * @file components/event-art
 */

import Image from 'next/image'
import { ViewTransition } from 'react'

import { mediaSrc } from '../lib/media.js'
import { EventPoster, VARIANT_CLASSES } from './poster.jsx'

/**
 * What the browser is told about the rendered width, per variant: a card in
 * a three-up grid, a poster on a four-up wall, and the hero, which is a
 * column beside the title on a desk and the full width on a phone.
 */
const DEFAULT_SIZES = Object.freeze({
  card: '(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw',
  poster: '(min-width: 1280px) 20rem, (min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw',
  hero: '(min-width: 1024px) 34rem, 100vw',
})

/**
 * The name a picture's shared transition goes by.
 *
 * @param {object} event An event or summary.
 * @returns {string} Such as `poster-bay-lights-garba-opening`.
 */
export function posterTransitionName(event) {
  return `poster-${String(event?.slug ?? event?.id ?? 'event').replace(/[^A-Za-z0-9_-]/gu, '-')}`
}

/**
 * @typedef {object} EventArtProps
 * @property {object} event An event or summary carrying `slug`, `title`, `category` and, when approved, `coverImage`.
 * @property {'card'|'poster'|'hero'} [variant] The frame's shape, as `EventPoster` takes it.
 * @property {string} [className] Extra classes for the frame.
 * @property {boolean} [priority] Preload the cover: for the page's largest picture only.
 * @property {boolean} [decorative] Whether a title beside it already says what it is; the alt text is then empty.
 * @property {string} [sizes] The `sizes` attribute, when the default does not fit the layout.
 * @property {boolean} [registration] Print the poster's plates into register as it arrives (the poster only; a cover is a photograph).
 * @property {boolean} [transitionName] Name the picture for the shared morph between the listing and the event page. Once per page per event.
 */

/**
 * The event's picture.
 *
 * @param {EventArtProps} props Component props.
 * @returns {JSX.Element} The cover or the poster.
 */
export function EventArt({
  event,
  variant = 'card',
  className,
  priority = false,
  decorative = false,
  sizes,
  registration = false,
  transitionName = false,
}) {
  const cover = event?.coverImage ?? null
  const src = mediaSrc(cover)
  const scene = VARIANT_CLASSES[variant] ? variant : 'card'
  const picture = src ? (
    <div
      data-slot="event-art"
      className={[
        'relative block w-full overflow-hidden bg-surface-subtle',
        VARIANT_CLASSES[scene],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <Image
        src={src}
        alt={decorative ? '' : cover.altText}
        fill
        sizes={sizes ?? DEFAULT_SIZES[scene]}
        className="object-cover"
        {...(priority ? { preload: true } : {})}
      />
    </div>
  ) : (
    <EventPoster event={event} variant={scene} registration={registration} className={className} />
  )

  if (!transitionName) return picture

  return (
    <ViewTransition name={posterTransitionName(event)} share="poster-morph" default="none">
      {picture}
    </ViewTransition>
  )
}
