'use client'

/**
 * The workspace shell's moving parts: the rail, the button that opens it on a
 * phone, the area switcher and the page finder in the bar.
 *
 * The shell itself (`shells.jsx`) is a server component; these are the only
 * pieces that need the browser, for one of three reasons. Which entry is
 * current follows client navigation (`usePathname`), which a server-rendered
 * layout cannot, because a layout is not rendered again when somebody moves
 * between two of its pages. The rail opens and closes on a phone and folds to
 * icons on a desk. And the bar's two menus are interactive. What each list
 * holds is decided on the server, from the session, and passed in as data.
 *
 * ## One navigation system
 *
 * The rail is the workspace's navigation: every area this account is
 * admitted to, grouped the way the work divides (`lib/navigation.js`). It is
 * one `navigation` landmark named "Workspace", drawn as a persistent column
 * from the `lg` breakpoint and as a sheet below it, opened from the bar. The
 * entries' words and order are the ones the browser suites read, so they are
 * not changed here; each gains a drawn icon (`lib/nav-icons.js`).
 *
 * Folded, on a desk, the rail shows the icons alone. The words are still in
 * every link, visually hidden, so each keeps its name, and a tooltip repeats
 * it on hover and focus. The choice is remembered in this browser only
 * (`localStorage`, wrapped, because a private window can refuse it). The
 * door folds the rail by itself, for the length of a visit to it, so the
 * scanner has the room.
 *
 * @module components/workspace-nav
 */

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import {
  Suspense,
  createContext,
  forwardRef,
  lazy,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Icon } from '@desi-event/ui/icons'

import { currentHref, isActivePath } from '../lib/active-path.js'
import { navIcon } from '../lib/nav-icons.js'

/**
 * Where the bar's menu, the page finder's popover and the folded rail's
 * tooltips live, fetched on first use. They are Base UI's floating layers,
 * which bring its positioning with them; drawn statically here, they put
 * about 68 KB (gzipped) in the first load of every workspace page, the
 * wallet and the door included, for controls few visits open.
 */
const loadFloating = () => import('./workspace-floating.jsx')

const LazyAreaMenu = lazy(() => loadFloating().then((module) => ({ default: module.AreaMenu })))
const LazyFinderPopover = lazy(() =>
  loadFloating().then((module) => ({ default: module.FinderPopover })),
)
const LazyRailTooltip = lazy(() =>
  loadFloating().then((module) => ({ default: module.RailTooltip })),
)

/** Where the rail's folded state is remembered, in this browser only. */
export const RAIL_STORAGE_KEY = 'desi-event:rail'

/** The door, where the rail folds by itself so the scanner has the room. */
export const DOOR_PATH = '/organizer/check-in'

/**
 * @typedef {object} RailState
 * @property {string} railId The rail's id, for the bar's button.
 * @property {boolean} open Whether the rail is open as a sheet (below `lg`).
 * @property {function(boolean): void} setOpen Open or close the sheet.
 * @property {boolean} collapsed Whether the rail is folded to icons (from `lg`).
 * @property {function(): void} toggleCollapsed Fold or unfold it.
 * @property {object} toggleRef The bar's button, where focus goes back to.
 */

const RailContext = createContext(null)

/**
 * The rail's state, for the bar's button and the rail.
 *
 * @returns {RailState} The state.
 */
function useRail() {
  const rail = useContext(RailContext)

  if (!rail) throw new Error('The workspace rail is drawn inside its RailProvider.')

  return rail
}

/**
 * Read the remembered fold, tolerating a browser that refuses storage.
 *
 * @returns {boolean} Whether the rail was left folded.
 */
function readFolded() {
  try {
    return window.localStorage.getItem(RAIL_STORAGE_KEY) === 'collapsed'
  } catch {
    return false
  }
}

/**
 * Remember the fold, tolerating a browser that refuses storage.
 *
 * @param {boolean} folded Whether the rail is folded.
 * @returns {void}
 */
function writeFolded(folded) {
  try {
    if (folded) window.localStorage.setItem(RAIL_STORAGE_KEY, 'collapsed')
    else window.localStorage.removeItem(RAIL_STORAGE_KEY)
  } catch {
    // Remembering is a convenience; the rail works without it.
  }
}

/**
 * @typedef {object} RailProviderProps
 * @property {string} railId The rail's id.
 * @property {ReactNode} children The shell.
 */

/**
 * Holds the rail's state for the whole shell.
 *
 * @param {RailProviderProps} props Component props.
 * @returns {JSX.Element} The shell, with the state available to its parts.
 */
export function RailProvider({ railId, children }) {
  const pathname = usePathname()
  const atDoor = isActivePath(DOOR_PATH, pathname)
  const [open, setOpen] = useState(false)
  const [folded, setFolded] = useState(false)
  // Unfolded by hand at the door; forgotten once the door is left.
  const [doorUnfolded, setDoorUnfolded] = useState(false)
  const toggleRef = useRef(null)

  // The remembered fold is read after hydration, so the server and the first
  // client render agree; the rail is drawn unfolded until then.
  useEffect(() => {
    setFolded(readFolded())
  }, [])

  // A navigation closes the sheet: it has done its job.
  useEffect(() => {
    setOpen(false)
    if (!atDoor) setDoorUnfolded(false)
  }, [pathname, atDoor])

  const collapsed = atDoor ? !doorUnfolded : folded

  const toggleCollapsed = useCallback(() => {
    if (atDoor) {
      setDoorUnfolded((value) => !value)
      return
    }

    setFolded((value) => {
      writeFolded(!value)
      return !value
    })
  }, [atDoor])

  const value = useMemo(
    () => ({ railId, open, setOpen, collapsed, toggleCollapsed, toggleRef }),
    [railId, open, collapsed, toggleCollapsed],
  )

  return <RailContext.Provider value={value}>{children}</RailContext.Provider>
}

/**
 * The bar's button that opens the rail as a sheet, below `lg`.
 *
 * @returns {JSX.Element} The button.
 */
export function RailToggle() {
  const { railId, open, setOpen, toggleRef } = useRail()

  return (
    <button
      ref={toggleRef}
      type="button"
      aria-expanded={open}
      aria-controls={railId}
      onClick={() => setOpen(!open)}
      className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-control px-2 text-label font-semibold text-ink-inverse transition-colors duration-(--duration-fast) ease-standard hover:bg-ink-inverse/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus lg:hidden"
    >
      <Icon name={open ? 'close' : 'menu'} className="h-5 w-5" />
      <span className="sr-only">Workspace menu</span>
    </button>
  )
}

/**
 * @typedef {object} RailItem
 * @property {string} href Where it goes.
 * @property {string} label What it says.
 */

/**
 * @typedef {object} RailGroup
 * @property {string} id A stable key.
 * @property {string} label The group's label.
 * @property {RailItem[]} items Its entries.
 */

/**
 * One rail entry: an icon and its words, marked current three ways
 * (`aria-current`, a tinted ground and a marker bar), never by colour alone.
 *
 * @param {object} props Component props.
 * @param {RailItem} props.item The entry.
 * @param {boolean} props.current Whether it is the current page.
 * @param {boolean} props.collapsed Whether the rail is folded to icons.
 * @returns {JSX.Element} The entry.
 */
function RailLink({ item, current, collapsed }) {
  const link = (
    <Link
      href={item.href}
      aria-current={current ? 'page' : undefined}
      className={`group relative flex min-h-11 items-center gap-3 rounded-control px-3 text-label transition-colors duration-(--duration-fast) ease-standard focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-focus lg:pointer-fine:min-h-10 ${
        current
          ? 'bg-opsnav-active font-semibold text-opsnav-active-ink'
          : 'font-medium text-opsnav-ink hover:bg-opsnav-hover hover:text-ink'
      } ${collapsed ? 'lg:justify-center lg:px-0' : ''}`}
    >
      <span
        aria-hidden="true"
        className={`absolute inset-y-2 left-0 w-0.75 rounded-full transition-colors duration-(--duration-fast) ${
          current ? 'bg-opsnav-marker' : 'bg-transparent'
        }`}
      />
      <Icon name={navIcon(item.href)} className="h-5 w-5" />
      <span className={`min-w-0 break-words ${collapsed ? 'lg:sr-only' : ''}`}>{item.label}</span>
    </Link>
  )

  // Folded, the words are hidden from sight but not from the link's name; the
  // tooltip repeats them for somebody looking, once its module has arrived.
  return collapsed ? (
    <Suspense fallback={link}>
      <LazyRailTooltip content={item.label}>{link}</LazyRailTooltip>
    </Suspense>
  ) : (
    link
  )
}

/** Room left above or below the current entry when it is scrolled to. */
const REVEAL_MARGIN = 16

/**
 * Scroll a rail's own list, and nothing else, until its current entry is in
 * view. The page is not moved: `scrollIntoView` would scroll every scrolling
 * ancestor, the window included. A hidden rail measures nothing and is left.
 *
 * @param {HTMLElement|null} scroller The rail's scrolling list.
 * @returns {void}
 */
export function revealCurrent(scroller) {
  const here = scroller?.querySelector('[aria-current="page"]')
  if (!scroller || !here) return

  const box = scroller.getBoundingClientRect()
  const entry = here.getBoundingClientRect()

  if (box.height === 0) return
  if (entry.top < box.top) scroller.scrollTop -= box.top - entry.top + REVEAL_MARGIN
  else if (entry.bottom > box.bottom)
    scroller.scrollTop += entry.bottom - box.bottom + REVEAL_MARGIN
}

/**
 * @typedef {object} WorkspaceRailProps
 * @property {RailGroup[]} groups The grouped entries this session is offered.
 * @property {string} [label] The navigation's name. Defaults to "Workspace".
 */

/**
 * The rail: a column from `lg`, a sheet below it.
 *
 * @param {WorkspaceRailProps} props Component props.
 * @returns {JSX.Element} The rail.
 */
export function WorkspaceRail({ groups, label = 'Workspace' }) {
  const { railId, open, setOpen, collapsed, toggleCollapsed, toggleRef } = useRail()
  const pathname = usePathname()
  const search = useSearchParams()
  const items = groups.flatMap((group) => group.items)
  const current = currentHref(items, pathname, search)
  const panelRef = useRef(null)
  const scrollerRef = useRef(null)
  const labelId = useId()

  // The rail's entries scroll on their own, and a long one (a platform
  // administrator's) runs past the fold. The current entry is brought into
  // the rail's view on arrival, and when the sheet opens, so the page always
  // shows where it is.
  useEffect(() => {
    if (current) revealCurrent(scrollerRef.current)
  }, [current, open])

  const close = useCallback(() => {
    setOpen(false)
    toggleRef.current?.focus()
  }, [setOpen, toggleRef])

  // Opened as a sheet, focus goes in, and Escape brings it back out.
  useEffect(() => {
    if (!open) return undefined

    panelRef.current?.focus()

    /**
     * Close on Escape.
     *
     * @param {KeyboardEvent} event The key event.
     * @returns {void}
     */
    function onKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault()
        close()
      }
    }

    document.addEventListener('keydown', onKeyDown)

    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, close])

  // A window that grows into the column layout drops the sheet, so the
  // button below `lg` never says "open" about a rail that is simply there.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined

    const query = window.matchMedia('(min-width: 1024px)')

    /**
     * Close the sheet once the column takes over.
     *
     * @returns {void}
     */
    function onChange() {
      if (query.matches) setOpen(false)
    }

    query.addEventListener('change', onChange)

    return () => query.removeEventListener('change', onChange)
  }, [setOpen])

  return (
    <>
      {open ? (
        <div
          aria-hidden="true"
          onClick={() => setOpen(false)}
          className="fixed inset-x-0 top-(--chrome-top) bottom-0 z-30 bg-scrim/50 transition-opacity duration-(--duration-sheet) ease-drawer starting:opacity-0 lg:hidden"
        />
      ) : null}
      <div
        id={railId}
        ref={panelRef}
        tabIndex={-1}
        data-collapsed={collapsed ? '' : undefined}
        className={`${
          open
            ? 'fixed top-(--chrome-top) bottom-0 left-0 z-40 flex w-[min(20rem,85vw)] shadow-floating transition-[opacity,translate] duration-(--duration-sheet) ease-drawer starting:-translate-x-4 starting:opacity-0'
            : 'hidden'
        } flex-col overflow-hidden bg-opsnav [view-transition-name:app-rail] focus-visible:outline-none lg:sticky lg:top-(--chrome-top) lg:z-auto lg:flex lg:h-[calc(100dvh-var(--chrome-top))] lg:shrink-0 lg:border-r lg:border-opsnav-line lg:shadow-none ${
          collapsed ? 'lg:w-18' : 'lg:w-64'
        }`}
      >
        <nav aria-label={label} className="flex min-h-0 flex-1 flex-col">
          {/* The entries scroll on their own, above the fold control, so a
              long rail never slides an entry under it. */}
          <div
            ref={scrollerRef}
            className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto overscroll-contain px-3 py-5"
          >
            {groups.map((group) => (
              <div key={group.id}>
                {/* A label, not a heading: the rail sits before the page's own
                  h1, and headings here would put navigation at the top of a
                  screen reader's list of the page's sections. */}
                <p
                  id={`${labelId}-${group.id}`}
                  className={`px-3 pb-2 text-caption font-semibold text-ink-subtle ${
                    collapsed ? 'lg:sr-only' : ''
                  }`}
                >
                  {group.label}
                </p>
                <ul aria-labelledby={`${labelId}-${group.id}`} className="flex flex-col gap-0.5">
                  {group.items.map((item) => (
                    <li key={item.href}>
                      <RailLink item={item} current={item.href === current} collapsed={collapsed} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          {/* Folding the rail is part of moving around, so it lives in the
              navigation, at its foot, on a desk only. */}
          <div className="hidden shrink-0 border-t border-opsnav-line px-3 py-3 lg:block">
            <button
              type="button"
              onClick={toggleCollapsed}
              className={`flex min-h-10 w-full items-center gap-3 rounded-control px-3 text-label font-medium text-opsnav-ink transition-colors duration-(--duration-fast) ease-standard hover:bg-opsnav-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-focus ${
                collapsed ? 'justify-center px-0' : ''
              }`}
            >
              <Icon name={collapsed ? 'chevron-right' : 'chevron-left'} className="h-5 w-5" />
              <span className={collapsed ? 'sr-only' : ''}>
                {collapsed ? 'Expand the menu' : 'Collapse the menu'}
              </span>
            </button>
          </div>
        </nav>
      </div>
    </>
  )
}

/**
 * @typedef {object} AreaEntry
 * @property {string} key The area's key in `lib/areas.js`.
 * @property {string} href Where the area begins.
 * @property {string} label The area's name.
 */

/**
 * The bar's area switcher: which area this is, and the others this account
 * is admitted to.
 *
 * One area is a name, not a choice, so it is drawn as words.
 *
 * @param {object} props Component props.
 * @param {AreaEntry[]} props.areas The areas this account is admitted to.
 * @param {string} props.current The current area's key.
 * @returns {JSX.Element} The switcher.
 */
export function AreaSwitcher({ areas, current }) {
  const [asked, setAsked] = useState(false)
  const [open, setOpen] = useState(false)
  const here = areas.find((area) => area.key === current)
  const label = here?.label ?? 'Workspace'

  if (areas.length < 2) return <span className={`${AREA_WORDS} px-1`}>{label}</span>

  // A plain button until it is first pressed; the menu's module is fetched
  // when a pointer comes over it or focus lands on it (`loadFloating`).
  if (!asked) {
    return (
      <AreaTrigger
        label={label}
        aria-haspopup="menu"
        aria-expanded="false"
        onPointerEnter={loadFloating}
        onFocus={loadFloating}
        onClick={() => {
          setAsked(true)
          setOpen(true)
        }}
      />
    )
  }

  return (
    <Suspense fallback={<AreaTrigger label={label} aria-expanded="true" aria-busy="true" />}>
      <LazyAreaMenu
        open={open}
        onOpenChange={setOpen}
        items={areas.map((area) => ({
          href: area.href,
          label: area.key === current ? `${area.label} (here)` : area.label,
        }))}
        trigger={<AreaTrigger label={label} />}
      />
    </Suspense>
  )
}

/** The area's name in the bar, as words or on its switcher's button. */
const AREA_WORDS =
  'min-w-0 truncate font-display text-title font-bold tracking-heading text-ink-inverse [font-stretch:86%]'

/**
 * The area switcher's button, the same before and after its menu has loaded.
 *
 * @param {object} props Button props, and `label`, the current area's name.
 * @param {object} ref Its element.
 * @returns {JSX.Element} The button.
 */
const AreaTrigger = forwardRef(function AreaTrigger({ label, ...props }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={`${label}. Switch area`}
      className="inline-flex min-h-11 min-w-0 items-center gap-1.5 rounded-control px-2 transition-colors duration-(--duration-fast) ease-standard hover:bg-ink-inverse/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      {...props}
    >
      <span className={AREA_WORDS}>{label}</span>
      <Icon name="chevron-down" className="h-4 w-4 text-ink-inverse-muted" />
    </button>
  )
})

/**
 * The bar's page finder: type part of a page's name, and go.
 *
 * The workspace has no search across records (an event, an order, a person
 * each has its own list and filter), so this does not pretend to: it finds
 * the pages the rail offers, by name. Enter goes to the first match.
 *
 * @param {object} props Component props.
 * @param {RailItem[]} props.items Every page the rail offers.
 * @returns {JSX.Element} The finder.
 */
export function PageFinder({ items }) {
  const [asked, setAsked] = useState(false)
  const [open, setOpen] = useState(false)

  // A plain button until it is first pressed, as the area switcher is.
  if (!asked) {
    return (
      <FinderTrigger
        aria-haspopup="dialog"
        aria-expanded="false"
        onPointerEnter={loadFloating}
        onFocus={loadFloating}
        onClick={() => {
          setAsked(true)
          setOpen(true)
        }}
      />
    )
  }

  return (
    <Suspense fallback={<FinderTrigger aria-expanded="true" aria-busy="true" />}>
      <LazyFinderPopover
        items={items}
        open={open}
        onOpenChange={setOpen}
        trigger={<FinderTrigger />}
      />
    </Suspense>
  )
}

/**
 * The page finder's button, the same before and after its popover has loaded.
 *
 * @param {object} props Button props.
 * @param {object} ref Its element.
 * @returns {JSX.Element} The button.
 */
const FinderTrigger = forwardRef(function FinderTrigger(props, ref) {
  return (
    <button
      ref={ref}
      type="button"
      className="hidden min-h-11 items-center gap-2 rounded-control px-3 text-label font-semibold text-ink-inverse transition-colors duration-(--duration-fast) ease-standard hover:bg-ink-inverse/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus md:inline-flex"
      {...props}
    >
      <Icon name="search" className="h-5 w-5" />
      Find a page
    </button>
  )
})
