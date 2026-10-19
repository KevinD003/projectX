/**
 * The poster that stands in for an event's cover image.
 *
 * A typographic poster in the house style (`lib/poster-art.js`): a flat plate
 * in one of the brand kit's colours, one bold printed shape anchored to a
 * corner, and over it the event's own title set huge and condensed, the way a
 * concert flyer or a hand-painted film poster sets it, with the date and the
 * city on a snipe and the category's mark beside them. The scheme, the shape,
 * its corner and where the title sits all come from the event's slug, so an
 * event wears the same poster in the listing, on its own page and at
 * checkout, and a wall of events is a wall of different posters.
 *
 * The title is ordinary React text, escaped like any other, and the drawing
 * under it is only shapes: there is no `dangerouslySetInnerHTML` here, and
 * only the drawing elements `POSTER_ELEMENTS` names can be rendered at all.
 *
 * ## For a screen reader
 *
 * The poster is one image (`role="img"`) named for what it is and whose it is
 * ("Comedy poster for Kunal Kamra Live"), exactly as a photograph with alt
 * text would be announced. The lettering inside is hidden from the
 * accessibility tree: the card or the page beside it says the title, the date
 * and the place in real text.
 *
 * ## Sizes
 *
 * Everything inside is measured in container units, so one poster scales from
 * a 4:5 hero down to a card, and below 11rem drops its small print, and below
 * 7rem its title too, leaving the category's mark on the plate: a thumbnail
 * is a swatch, not a poster too small to read.
 *
 * ## Plate registration
 *
 * With `registration`, the poster prints itself once as it arrives: a magenta
 * and a gold impression of the title, and the foil impression of the shape,
 * start a few pixels off and slide into register (`globals.css`, "Plate
 * registration"). The title itself never moves or fades, so it paints with
 * the first frame; under reduced motion the impressions are simply in
 * register.
 *
 * @module components/poster
 */

import { createElement } from 'react'

import { categoryLabel } from '../lib/catalog.js'
import {
  POSTER_ELEMENTS,
  describePoster,
  fitHeadline,
  posterArt,
  posterTitle,
} from '../lib/poster-art.js'
import { CategoryIcon } from './icons.jsx'

/** The elements a drawing may render, for constant-time lookup. */
const RENDERABLE = new Set(POSTER_ELEMENTS)

/**
 * Sizing per variant.
 *
 * A `card` keeps a landscape 3:2 (a basket, a wallet row, a thumbnail). A
 * `poster` is the noticeboard's 4:5, for the listing's wall and the home
 * page's feature. A `hero` is the event page's poster: 4:5 beside the title
 * on a wide screen, a shorter 5:4 on a phone so the price is not pushed off
 * the first screen.
 */
export const VARIANT_CLASSES = Object.freeze({
  card: 'aspect-[3/2]',
  poster: 'aspect-[4/5]',
  hero: 'aspect-[5/4] lg:aspect-[4/5]',
})

/** The height over the width each variant is fitted for. */
const VARIANT_ASPECT = Object.freeze({ card: 2 / 3, poster: 5 / 4, hero: 1 })

/** The title's colour, per tone: white on the dark plates, purple on the light. */
const TONE_CLASSES = Object.freeze({
  inverse: 'text-ink-inverse',
  ink: 'text-highlight-ink',
})

/**
 * The React spelling of an SVG attribute.
 *
 * The drawing is written in SVG's own spelling (`stroke-width`) so that
 * `toSvgString` can emit it verbatim; React wants the camel-cased property
 * (`strokeWidth`) and warns about the other. A `data-` attribute is the one
 * kind React takes as written.
 *
 * @param {string} name An attribute name as SVG spells it.
 * @returns {string} The prop name React expects.
 */
export function reactAttributeName(name) {
  if (name.startsWith('data-')) return name

  return name.replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase())
}

/**
 * Render one node of the drawing, and its children, as React elements.
 *
 * @param {{tag: string, attrs: Record<string, string|number>, children: Array<object>}} node A node.
 * @param {number} key Its position among its siblings. The tree is static, so position is identity.
 * @returns {JSX.Element|null} The element, or nothing for a tag the poster does not draw.
 */
function renderNode(node, key) {
  if (!RENDERABLE.has(node.tag)) return null

  const props = { key }

  for (const [name, value] of Object.entries(node.attrs)) {
    props[reactAttributeName(name)] = value
  }

  return createElement(
    node.tag,
    props,
    node.children.length > 0 ? node.children.map(renderNode) : undefined,
  )
}

/**
 * The snipe's date: weekday, day and month in the event's own zone, as a
 * poster prints it ("SAT 7 NOV").
 *
 * @param {object} event An event or summary carrying `startsAt` and `timezone`.
 * @returns {string|null} The date, or null when there is none.
 */
export function posterDate(event) {
  const start = new Date(event?.startsAt ?? Number.NaN)

  if (Number.isNaN(start.getTime())) return null

  const parts = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: event?.timezone ?? 'America/New_York',
  }).formatToParts(start)
  const part = (type) => parts.find((entry) => entry.type === type)?.value ?? ''

  return `${part('weekday')} ${part('day')} ${part('month')}`
}

/**
 * Where the snipe says the event is: its city, or "Online".
 *
 * @param {object} event An event or summary.
 * @returns {string|null} The place, or null.
 */
export function posterPlace(event) {
  if (event?.isOnline) return 'Online'

  return event?.city ?? event?.venue?.city ?? null
}

/**
 * Words printed on the poster, drawn by the stylesheet from an attribute
 * (`content: attr(data-lettering)`) rather than written into the page.
 *
 * The poster's lettering repeats what the card or the page beside it already
 * says in real text. Drawn this way it is paint, not prose: a search engine
 * reads the title once, a find-in-page finds it once, and copying the card
 * copies the title once. React writes the attribute escaped, so a title is
 * never markup. The whole poster is one named image, so nothing here is
 * announced either way.
 *
 * @param {object} props Component props.
 * @param {string} props.text The words.
 * @param {string} [props.className] Their setting.
 * @returns {JSX.Element} The lettering.
 */
function Lettering({ text, className = '', ...rest }) {
  return (
    <span
      data-lettering={text}
      className={`block before:content-[attr(data-lettering)] ${className}`}
      {...rest}
    />
  )
}

/**
 * @typedef {object} EventPosterProps
 * @property {object} event An event or event summary carrying `slug`, `title`, `category` and, when it has them, `startsAt`, `timezone` and `city`.
 * @property {'card'|'poster'|'hero'} [variant] The frame's shape.
 * @property {boolean} [registration] Print the plates into register as the poster arrives: the hero and the home page's feature, once per page.
 * @property {string} [className] Extra classes merged after the defaults. Inside a frame with a set height, `h-full` lets the frame decide the crop.
 */

/**
 * A typographic poster for an event.
 *
 * @param {EventPosterProps} props Component props.
 * @returns {JSX.Element} The rendered poster.
 */
export function EventPoster({ event, variant = 'card', registration = false, className }) {
  const shape = VARIANT_CLASSES[variant] ? variant : 'card'
  const art = posterArt({
    seed: event?.slug ?? event?.id ?? 'desi-event',
    category: event?.category,
  })
  const { headline, subline } = posterTitle(event?.title ?? categoryLabel(event?.category))
  const fit = fitHeadline(headline, { aspect: VARIANT_ASPECT[shape] })
  const date = posterDate(event)
  const place = posterPlace(event)
  const tone = TONE_CLASSES[art.tone] ?? TONE_CLASSES.inverse
  const bottom = art.titleAt === 'bottom'
  const headlineClasses =
    'col-start-1 row-start-1 font-display leading-[0.9] font-extrabold tracking-[-0.01em] uppercase [font-stretch:75%] [overflow-wrap:anywhere]'

  return (
    <div
      role="img"
      aria-label={`${describePoster(event?.category)} for ${event?.title ?? 'this event'}`}
      data-slot="poster"
      data-poster={art.palette}
      data-motif={art.motif}
      {...(registration ? { 'data-registration': '' } : {})}
      className={[
        'relative isolate block w-full overflow-hidden [container-type:size]',
        VARIANT_CLASSES[shape],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <svg
        aria-hidden="true"
        focusable="false"
        viewBox={art.viewBox}
        preserveAspectRatio={art.anchor}
        className="absolute inset-0 block h-full w-full"
      >
        {art.children.map(renderNode)}
      </svg>

      <div
        aria-hidden="true"
        className={`absolute inset-0 flex flex-col gap-[3cqi] p-[6cqi] poster-lettering ${
          bottom ? 'flex-col-reverse' : ''
        }`}
      >
        <div className="flex min-w-0 flex-col gap-[2.5cqi]">
          <div className={`grid ${tone}`} style={{ fontSize: fit.fontSize }}>
            {registration ? (
              <>
                <Lettering
                  text={headline}
                  data-impression="magenta"
                  className={`${headlineClasses} poster-impression text-accent`}
                />
                <Lettering
                  text={headline}
                  data-impression="gold"
                  className={`${headlineClasses} poster-impression text-highlight`}
                />
              </>
            ) : null}
            <Lettering
              text={headline}
              data-lettering-part="headline"
              className={`${headlineClasses} relative`}
            />
          </div>
          {subline ? (
            <Lettering
              text={subline}
              data-lettering-part="subline"
              className={`line-clamp-2 font-display text-[length:max(5cqi,0.8125rem)] leading-[1.05] font-semibold [font-stretch:88%] poster-small-print ${tone}`}
            />
          ) : null}
        </div>

        {date || place ? (
          <span
            className={`mt-auto flex max-w-full items-center gap-[2cqi] self-start rounded-plate bg-surface-raised px-[2.6cqi] py-[1.4cqi] text-[length:max(4.2cqi,0.75rem)] leading-none font-bold tracking-caps text-ink uppercase tabular-nums poster-small-print ${
              bottom ? 'mt-0 mb-auto' : ''
            }`}
          >
            <CategoryIcon category={event?.category} className="h-[1.3em] w-[1.3em] shrink-0" />
            <Lettering
              text={[date, place].filter(Boolean).join(' · ')}
              data-lettering-part="snipe"
              className="min-w-0 truncate"
            />
          </span>
        ) : null}
      </div>

      <span
        aria-hidden="true"
        className={`poster-mark absolute inset-0 items-center justify-center ${tone}`}
      >
        <CategoryIcon category={event?.category} className="h-[42cqmin] w-[42cqmin]" />
      </span>
    </div>
  )
}
