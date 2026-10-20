/**
 * The masthead a public page opens with.
 *
 * The home page and an event have their own openings; every other public
 * page (the listing, the directories, a venue, an organiser, contact, the
 * limitations) opens with this one: the trail, the page's one `h1` set large
 * and condensed, a line of lead copy, and whatever the page wants to add
 * beneath it. No eyebrow above the heading and no ornament around it: the
 * heading says what the page is.
 *
 * Two grounds. `page` (the default) is the white page itself, so most pages
 * open quietly and spend their one plate moment further down. `plate` is the
 * Royal Purple plate, for a page whose subject is one thing worth a poster's
 * weight: an organiser, a venue.
 *
 * Nothing in it animates: the heading paints with the first frame.
 *
 * @module components/page-hero
 */

/**
 * @typedef {object} PageHeroProps
 * @property {string} headingId The `h1`'s id; the masthead is a region named by it.
 * @property {ReactNode} title The page's heading.
 * @property {ReactNode} [lead] A sentence or two under the heading.
 * @property {ReactNode} [breadcrumbs] A `Breadcrumbs` trail (`tone="inverse"` on the plate).
 * @property {ReactNode} [art] Something drawn beside the heading on a wide screen. Hidden from assistive technology.
 * @property {ReactNode} [children] Anything else the masthead should hold, under the lead.
 * @property {'page'|'plate'} [tone] The ground: the white page, or the purple plate.
 * @property {'display'|'h1'} [size] The heading's size: `display` for the listing, `h1` elsewhere.
 * @property {string} [className] Extra classes for the masthead's inner column.
 */

/** The masthead's colours, per ground. */
const TONES = Object.freeze({
  page: { band: 'bg-page text-ink', heading: 'text-ink', lead: 'text-ink-muted' },
  plate: {
    band: 'bg-surface-inverse text-ink-inverse',
    heading: 'text-ink-inverse',
    lead: 'text-ink-inverse-muted',
  },
})

/**
 * The masthead at the top of a public page.
 *
 * @param {PageHeroProps} props Component props.
 * @returns {JSX.Element} The masthead.
 */
export function PageHero({
  headingId,
  title,
  lead,
  breadcrumbs,
  art,
  children,
  tone = 'page',
  size = 'h1',
  className = '',
}) {
  const colours = TONES[tone] ?? TONES.page
  const plate = tone === 'plate'

  return (
    <section aria-labelledby={headingId} className={`relative isolate ${colours.band}`}>
      <div
        className={`mx-auto max-w-content px-4 sm:px-6 ${
          plate ? 'pt-6 pb-12 sm:pt-8 sm:pb-16' : 'pt-6 pb-8 sm:pt-8 sm:pb-12'
        } ${className}`}
      >
        {breadcrumbs ? <div className="-ml-0.5">{breadcrumbs}</div> : null}
        <div
          className={`mt-4 grid grid-cols-1 gap-8 sm:mt-6 ${
            art ? 'lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:items-end lg:gap-14' : ''
          }`}
        >
          <div className="min-w-0">
            <h1
              id={headingId}
              className={`${size === 'display' ? 'text-display' : 'text-h1'} max-w-[18ch] text-balance ${colours.heading}`}
            >
              {title}
            </h1>
            {lead ? (
              <p className={`mt-4 max-w-[60ch] text-body sm:mt-5 ${colours.lead}`}>{lead}</p>
            ) : null}
            {children}
          </div>
          {art ? (
            <div aria-hidden="true" className="pointer-events-none hidden lg:block">
              {art}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}
