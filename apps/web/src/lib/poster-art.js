/**
 * The house poster an event wears when nobody has uploaded a cover.
 *
 * Every event gets a poster in the site's own vernacular: the best poster on
 * the community-centre noticeboard. A flat ink plate in one of the brand kit's
 * colours, one bold printed shape (a sun, an arch, a burst of rays, a set of
 * bands, a rainbow of half rings, a halftone, a lattice), and, laid over it by
 * `EventPoster`, the event's own title set huge and condensed with its date
 * and city on a snipe. No two neighbouring cards need to look alike: the
 * scheme, the shape, its corner and where the title sits are all chosen from
 * the event's slug, so an event wears the same poster everywhere it appears
 * (the listing, its own page, checkout, the wallet) and a page of events is a
 * wall of different posters, not one illustration recoloured.
 *
 * This module draws the geometry only. The drawing is a small element tree,
 * `{ tag, attrs, children }`, which `EventPoster` renders as React elements
 * and {@link toSvgString} writes as a standalone SVG (the social card uses
 * it). Every attribute value comes from here, numbers and the palette below,
 * so nothing an organiser typed can reach the drawing: the title is set by
 * the component as ordinary escaped text, outside the SVG.
 *
 * ## Colour that stays legible
 *
 * The title may land on the ground or on the shape, so every scheme pairs a
 * title tone with plates that tone reads on. A white title only ever sits on
 * purple, deep purple or magenta (at least 7:1); a purple title only on gold,
 * orange, white or lilac (at least 5.5:1). The fourth colour, the foil, is
 * kept to thin rules and small marks in the shape's own corner, and it is the
 * colour of the registration ghost the hero animates into place.
 *
 * @module lib/poster-art
 */

import { categoryDescriptor } from './catalog.js'

/**
 * The drawing's coordinate space: a square tile, anchored by `EventPoster` to
 * the corner its shape belongs in, and cropped by the frame. A square crops
 * well to a 4:5 poster, a 3:2 card and a 16:9 social card alike.
 */
export const POSTER_VIEWBOX = Object.freeze({ width: 100, height: 100 })

/**
 * Every element a drawing may contain: flat shapes and groups, and nothing
 * that can hold text, script, a link, a picture or a foreign document.
 * `EventPoster` renders only these, and a test holds every drawing to them, so
 * a new shape has to be added here on purpose.
 */
export const POSTER_ELEMENTS = Object.freeze(['circle', 'g', 'line', 'path', 'rect'])

/**
 * Every colour a poster is drawn in: the brand kit's four colours and the
 * three quiet ones they are printed beside.
 *
 * These are artwork, not interface. No drawn colour is ever text or a control
 * (the title and the snipe are set by `EventPoster` in theme tokens), so they
 * sit outside the semantic tokens, and this table is the one place in the web
 * app's code where a hex value may be written:
 * `packages/config/tests/semantic-classes.test.js` finds this declaration and
 * fails on any hex elsewhere in the file.
 *
 * `kit` is the brand kit exactly (`docs/BRAND.md`). Each scheme names its
 * `ground`, the `plate` its shape is printed in, a `second` plate, the `foil`
 * for rules and the registration ghost, and the `tone` of the title set over
 * it: `inverse` (white) or `ink` (purple).
 */
const PALETTES = Object.freeze({
  kit: Object.freeze({
    purple: '#32105e',
    magenta: '#b0004a',
    gold: '#d4a529',
    orange: '#f47a1f',
  }),
  quiet: Object.freeze({
    night: '#1d0838',
    paper: '#ffffff',
    lilac: '#ece3f6',
    wine: '#7d0036',
  }),
  schemes: Object.freeze([
    {
      name: 'royal',
      ground: '#32105e',
      plate: '#b0004a',
      second: '#1d0838',
      foil: '#d4a529',
      tone: 'inverse',
    },
    {
      name: 'magenta',
      ground: '#b0004a',
      plate: '#32105e',
      second: '#7d0036',
      foil: '#f47a1f',
      tone: 'inverse',
    },
    {
      name: 'foil',
      ground: '#d4a529',
      plate: '#f47a1f',
      second: '#ffffff',
      foil: '#32105e',
      tone: 'ink',
    },
    {
      name: 'tonight',
      ground: '#f47a1f',
      plate: '#d4a529',
      second: '#ece3f6',
      foil: '#32105e',
      tone: 'ink',
    },
    {
      name: 'night',
      ground: '#1d0838',
      plate: '#32105e',
      second: '#b0004a',
      foil: '#d4a529',
      tone: 'inverse',
    },
    {
      name: 'paper',
      ground: '#ece3f6',
      plate: '#d4a529',
      second: '#ffffff',
      foil: '#b0004a',
      tone: 'ink',
    },
  ]),
})

/**
 * The colour a title is set in over a drawing, for a renderer that cannot
 * read the theme (the social card): white for `inverse`, the kit's Royal
 * Purple for `ink`. On the page, `EventPoster` uses the theme's tokens.
 *
 * @param {'inverse'|'ink'} tone The design's tone.
 * @returns {string} A hex colour.
 */
export function posterInk(tone) {
  return tone === 'ink' ? PALETTES.kit.purple : PALETTES.quiet.paper
}

/** The printed shapes a poster can carry. */
export const POSTER_MOTIFS = Object.freeze([
  'sun',
  'arch',
  'rays',
  'bands',
  'rainbow',
  'halftone',
  'lattice',
])

/**
 * Which shapes suit which kind of night: three per category, so a category
 * page is still varied and a comedy night is never dressed as a temple arch.
 * A category the site does not know yet may wear any of them.
 */
const CATEGORY_MOTIFS = Object.freeze({
  GARBA_DANDIYA: ['rainbow', 'lattice', 'sun'],
  MUSIC_CONCERT: ['rays', 'halftone', 'rainbow'],
  BOLLYWOOD_NIGHT: ['rays', 'sun', 'bands'],
  CLASSICAL_DANCE: ['arch', 'lattice', 'rainbow'],
  COMEDY: ['halftone', 'bands', 'sun'],
  FILM_SCREENING: ['rays', 'bands', 'halftone'],
  CULTURAL_FESTIVAL: ['sun', 'lattice', 'rays'],
  FOOD_FESTIVAL: ['sun', 'halftone', 'bands'],
  WEDDING_EXPO: ['arch', 'lattice', 'sun'],
  RELIGIOUS: ['arch', 'sun', 'rainbow'],
  THEATRE: ['arch', 'bands', 'rays'],
  WORKSHOP: ['bands', 'halftone', 'lattice'],
  NETWORKING: ['halftone', 'bands', 'lattice'],
  SPORTS: ['bands', 'sun', 'halftone'],
})

/**
 * A 32-bit hash of a string (FNV-1a).
 *
 * @param {string} text Anything.
 * @returns {number} An unsigned 32-bit integer.
 */
function hashString(text) {
  let hash = 0x811c9dc5

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }

  return hash >>> 0
}

/**
 * A small seeded generator (mulberry32): the same seed, the same sequence.
 *
 * @param {number} seed A 32-bit integer.
 * @returns {function(): number} Returns a number in [0, 1).
 */
function seededRandom(seed) {
  let state = seed >>> 0

  return function next() {
    state = (state + 0x6d2b79f5) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)

    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296
  }
}

/**
 * Round for the output, so a poster is not a wall of seventeen-digit floats.
 *
 * @param {number} value A coordinate.
 * @returns {number} It, to two decimal places.
 */
function r2(value) {
  return Math.round(value * 100) / 100
}

/**
 * An element of the drawing.
 *
 * @param {string} tag An SVG element name.
 * @param {Record<string, string|number>} [attrs] Its attributes, in SVG spelling.
 * @param {Array<object>} [children] Nested elements.
 * @returns {{tag: string, attrs: Record<string, string|number>, children: Array<object>}} The node.
 */
function el(tag, attrs = {}, children = []) {
  return { tag, attrs, children }
}

/**
 * A point on a circle.
 *
 * @param {number} cx Centre x.
 * @param {number} cy Centre y.
 * @param {number} radius Radius.
 * @param {number} degrees Angle, clockwise from three o'clock.
 * @returns {Array<number>} The point, `[x, y]`.
 */
function polar(cx, cy, radius, degrees) {
  const radians = (degrees * Math.PI) / 180

  return [r2(cx + radius * Math.cos(radians)), r2(cy + radius * Math.sin(radians))]
}

/**
 * The plate and its ghost: the same shape twice, the ghost in the foil and
 * printed a little off, the way a second colour lands on a screen print. The
 * ghost group is marked so the hero can slide it into register.
 *
 * @param {Array<object>} plate The shape in its plate colour.
 * @param {Array<object>} ghost The same outline in the foil.
 * @returns {Array<object>} Both groups, ghost first so the plate prints over it.
 */
function registered(plate, ghost) {
  return [el('g', { 'data-plate': 'ghost' }, ghost), el('g', { 'data-plate': 'key' }, plate)]
}

/**
 * The drawing functions, one per motif. Each draws into the bottom-right of
 * the tile, the corner `EventPoster` anchors it to (a mirrored poster flips
 * the whole tile), and returns its elements.
 */
const MOTIF_DRAWINGS = Object.freeze({
  /**
   * A low sun: a big disc rising from the corner, a ring around it in the
   * second plate, a foil keyline.
   *
   * @param {object} c The scheme and generator.
   * @returns {Array<object>} Elements.
   */
  sun(c) {
    const cx = r2(66 + c.random() * 12)
    const cy = r2(70 + c.random() * 10)
    const radius = r2(30 + c.random() * 8)

    return [
      el('circle', { cx, cy, r: r2(radius + 12), fill: c.scheme.second }),
      ...registered(
        [el('circle', { cx, cy, r: radius, fill: c.scheme.plate })],
        [
          el('circle', {
            cx: r2(cx - 2),
            cy: r2(cy - 2),
            r: radius,
            fill: 'none',
            stroke: c.scheme.foil,
            'stroke-width': 1.2,
          }),
        ],
      ),
    ]
  },

  /**
   * An arch, as a doorway or a jharokha frames it: a tall pointed opening in
   * the plate, an inner keyline in the foil, a step at its foot.
   *
   * @param {object} c The scheme and generator.
   * @returns {Array<object>} Elements.
   */
  arch(c) {
    const left = r2(48 + c.random() * 8)
    const width = r2(42 + c.random() * 8)
    const right = r2(left + width)
    const spring = r2(52 + c.random() * 8)
    const mid = r2(left + width / 2)
    const peak = r2(spring - width * 0.72)
    const outline = (inset) =>
      `M ${r2(left + inset)} 104 L ${r2(left + inset)} ${spring} Q ${r2(left + inset)} ${r2(peak + inset * 1.4)} ${mid} ${r2(peak + inset * 1.6)} Q ${r2(right - inset)} ${r2(peak + inset * 1.4)} ${r2(right - inset)} ${spring} L ${r2(right - inset)} 104 Z`

    return [
      el('rect', {
        x: r2(left - 6),
        y: 92,
        width: r2(width + 12),
        height: 10,
        fill: c.scheme.second,
      }),
      ...registered(
        [el('path', { d: outline(0), fill: c.scheme.plate })],
        [
          el('path', {
            d: outline(5),
            fill: 'none',
            stroke: c.scheme.foil,
            'stroke-width': 1.1,
          }),
        ],
      ),
    ]
  },

  /**
   * A burst of rays from the corner, the way a film poster throws light.
   *
   * @param {object} c The scheme and generator.
   * @returns {Array<object>} Elements.
   */
  rays(c) {
    const cx = 104
    const cy = 104
    const count = 7 + Math.floor(c.random() * 4)
    const reach = 150
    const span = 90 / (count * 2)
    const plate = []
    const ghost = []

    for (let index = 0; index < count; index += 1) {
      const from = 180 + index * span * 2
      const [x1, y1] = polar(cx, cy, reach, from)
      const [x2, y2] = polar(cx, cy, reach, from + span)

      plate.push(
        el('path', { d: `M ${cx} ${cy} L ${x1} ${y1} L ${x2} ${y2} Z`, fill: c.scheme.plate }),
      )
    }

    const hub = r2(18 + c.random() * 8)

    ghost.push(
      el('circle', {
        cx: r2(cx - 2),
        cy: r2(cy - 2),
        r: r2(hub + 8),
        fill: 'none',
        stroke: c.scheme.foil,
        'stroke-width': 1.2,
      }),
    )
    plate.push(el('circle', { cx, cy, r: hub, fill: c.scheme.second }))

    return registered(plate, ghost)
  },

  /**
   * Bold diagonal bands across the corner, like a mela banner.
   *
   * @param {object} c The scheme and generator.
   * @returns {Array<object>} Elements.
   */
  bands(c) {
    const count = 3 + Math.floor(c.random() * 2)
    const width = r2(9 + c.random() * 4)
    const start = r2(70 + c.random() * 20)
    const plate = []
    const ghost = []

    for (let index = 0; index < count; index += 1) {
      const offset = start + index * width * 1.9
      const fill = index % 2 === 0 ? c.scheme.plate : c.scheme.second

      plate.push(
        el('path', {
          d: `M ${r2(offset)} 104 L 104 ${r2(offset)} L 104 ${r2(offset + width)} L ${r2(offset + width)} 104 Z`,
          fill,
        }),
      )
    }

    ghost.push(
      el('line', {
        x1: r2(start - 6),
        y1: 104,
        x2: 104,
        y2: r2(start - 6),
        stroke: c.scheme.foil,
        'stroke-width': 1.4,
      }),
    )

    return registered(plate, ghost)
  },

  /**
   * Half rings stacked from the bottom edge, a seventies concert flyer's
   * rainbow in the kit's colours.
   *
   * @param {object} c The scheme and generator.
   * @returns {Array<object>} Elements.
   */
  rainbow(c) {
    const cx = r2(62 + c.random() * 14)
    const rings = [44, 34, 24, 14]
    const fills = [c.scheme.plate, c.scheme.second, c.scheme.plate, c.scheme.ground]
    const plate = rings.map((radius, index) =>
      el('path', {
        d: `M ${r2(cx - radius)} 102 A ${radius} ${radius} 0 0 1 ${r2(cx + radius)} 102 Z`,
        fill: fills[index],
      }),
    )
    const ghost = [
      el('path', {
        d: `M ${r2(cx - 50)} 100 A 50 50 0 0 1 ${r2(cx + 50)} 100`,
        fill: 'none',
        stroke: c.scheme.foil,
        'stroke-width': 1.2,
      }),
    ]

    return registered(plate, ghost)
  },

  /**
   * A halftone: dots that grow toward the corner, the texture of a cheap
   * print run enlarged until it is the picture.
   *
   * @param {object} c The scheme and generator.
   * @returns {Array<object>} Elements.
   */
  halftone(c) {
    const step = 7
    const dots = []

    for (let row = 0; row < 8; row += 1) {
      for (let column = 0; column < 8; column += 1) {
        const x = 100 - column * step - step / 2
        const y = 100 - row * step - step / 2
        const reach = 1 - Math.hypot(column, row) / 9

        if (reach > 0.08) {
          dots.push(
            el('circle', {
              cx: r2(x),
              cy: r2(y),
              r: r2(reach * step * 0.62),
              fill: c.scheme.plate,
            }),
          )
        }
      }
    }

    const ring = r2(14 + c.random() * 6)

    return [
      ...registered(dots, [
        el('circle', {
          cx: r2(82 - c.random() * 6),
          cy: r2(82 - c.random() * 6),
          r: ring,
          fill: 'none',
          stroke: c.scheme.foil,
          'stroke-width': 1.2,
        }),
      ]),
      // A knock-out in the ground's own colour, as a halftone screen leaves
      // its centre unprinted. Not the second plate: on the lilac and white
      // schemes a pale disc sat on the dots and read as a rendering fault.
      el('circle', { cx: 88, cy: 88, r: r2(ring * 0.55), fill: c.scheme.ground }),
    ]
  },

  /**
   * A lattice of diamonds, as a jaali screen or a rangoli grid repeats one.
   *
   * @param {object} c The scheme and generator.
   * @returns {Array<object>} Elements.
   */
  lattice(c) {
    const size = r2(9 + c.random() * 3)
    const plate = []

    for (let row = 0; row < 6; row += 1) {
      for (let column = 0; column < 6; column += 1) {
        if (row + column > 6) continue

        const x = 100 - column * size * 1.15 - size / 2
        const y = 100 - row * size * 1.15 - size / 2
        const half = size / 2
        const fill = (row + column) % 3 === 1 ? c.scheme.second : c.scheme.plate

        plate.push(
          el('path', {
            d: `M ${r2(x)} ${r2(y - half)} L ${r2(x + half)} ${r2(y)} L ${r2(x)} ${r2(y + half)} L ${r2(x - half)} ${r2(y)} Z`,
            fill,
          }),
        )
      }
    }

    const reach = r2(size * 1.15 * 5.6)

    return registered(plate, [
      el('line', {
        x1: r2(100 - reach),
        y1: 101,
        x2: 101,
        y2: r2(100 - reach),
        stroke: c.scheme.foil,
        'stroke-width': 1.2,
      }),
    ])
  },
})

/**
 * Everything about an event's poster that is chosen rather than read: the
 * colour scheme, the shape, the corner it sits in, and where the title goes.
 *
 * @param {object} options What to choose for.
 * @param {string} options.seed The event's slug (or any stable string).
 * @param {string} [options.category] Its category.
 * @returns {{seed: number, scheme: object, motif: string, mirrored: boolean, titleAt: 'top'|'bottom', tone: 'inverse'|'ink', anchor: string}} The design.
 */
export function posterDesign({ seed, category }) {
  const hash = hashString(`${seed}`)
  const scheme = PALETTES.schemes[hash % PALETTES.schemes.length]
  const motifs = CATEGORY_MOTIFS[category] ?? POSTER_MOTIFS
  const motif = motifs[Math.floor(hash / PALETTES.schemes.length) % motifs.length]
  const mirrored = ((hash >>> 11) & 1) === 1
  const titleAt = ((hash >>> 13) & 3) === 0 ? 'bottom' : 'top'
  const corner = `${mirrored ? 'xMin' : 'xMax'}${titleAt === 'top' ? 'YMax' : 'YMin'}`

  return {
    seed: hash,
    scheme,
    motif,
    mirrored,
    titleAt,
    tone: scheme.tone,
    anchor: `${corner} slice`,
  }
}

/**
 * How far up the tile a drawing reaches: the smallest `y` any of its
 * elements can paint, in the shape's own bottom-right drawing space.
 *
 * Exact for the circles, rectangles and lines the shapes use, and safe for
 * a path: a straight or quadratic segment lies within its points, so the
 * highest point is a bound, and an arc is bounded by its radius above its
 * end points (exactly so for the rainbow's half rings, whose end points span
 * a diameter).
 *
 * @param {Array<object>} nodes Elements, as the motif drawings return them.
 * @returns {number} The top, in tile units.
 */
export function drawingTop(nodes) {
  let top = Number.POSITIVE_INFINITY

  for (const node of nodes) {
    const { attrs } = node

    if (node.tag === 'circle') top = Math.min(top, Number(attrs.cy) - Number(attrs.r))
    if (node.tag === 'rect') top = Math.min(top, Number(attrs.y))
    if (node.tag === 'line') top = Math.min(top, Number(attrs.y1), Number(attrs.y2))
    if (node.tag === 'path') top = Math.min(top, pathTop(String(attrs.d)))
    if (node.children.length > 0) top = Math.min(top, drawingTop(node.children))
  }

  return top
}

/**
 * The highest point of a path written with `M`, `L`, `Q`, `A` and `Z`.
 *
 * @param {string} d The path data.
 * @returns {number} Its top, or a bound on it.
 */
function pathTop(d) {
  const tokens = d.match(/[MLQAZ]|-?[0-9.]+/gu) ?? []
  const ARGUMENTS = { M: 2, L: 2, Q: 4, A: 7, Z: 0 }
  let top = Number.POSITIVE_INFINITY
  let x = Number.NaN
  let y = Number.NaN
  let index = 0

  while (index < tokens.length) {
    const command = tokens[index]
    const values = tokens.slice(index + 1, index + 1 + ARGUMENTS[command]).map(Number)
    index += 1 + ARGUMENTS[command]

    if (command === 'A') {
      const [rx, ry, , , , endX, endY] = values
      // A half ring whose end points span its diameter peaks one radius up;
      // any other arc stays within a circle of its radius whose centre is at
      // most one radius from its end points.
      const halfRing = y === endY && Math.abs(Math.abs(endX - x) - 2 * rx) < 0.02
      top = Math.min(top, Math.min(y, endY) - (halfRing ? ry : 2 * ry))
      x = endX
      y = endY
    } else if (values.length > 0) {
      for (let at = 1; at < values.length; at += 2) top = Math.min(top, values[at])
      x = values[values.length - 2]
      y = values[values.length - 1]
    }
  }

  return top
}

/**
 * The share of a poster's height the headline may take, at most. A long
 * title is set smaller to stay inside it rather than run into the shape.
 */
export const HEADLINE_SHARE = 40

/** The gap kept between the lettering and the shape, in the frame's width units. */
const LETTERING_GAP = 3

/**
 * How deep the lettering block runs from its edge of the frame, as a share
 * of the frame's height (0 to 1): the padding, the headline as it was
 * fitted, the line under it, and a gap before the shape may start.
 *
 * Generous rather than exact. The line under the headline is counted at the
 * size it is set at on a small card (13px is about 7% of a 190px card) and
 * at two lines once it is longer than one line holds.
 *
 * @param {object} options What is set.
 * @param {number} options.lines The headline's line count, from {@link fitHeadline}.
 * @param {number} options.size Its size in the frame's width units, from {@link fitHeadline}.
 * @param {string|null} [options.subline] The line under it.
 * @param {number} options.aspect The frame's height over its width.
 * @returns {number} The depth, as a share of the frame's height.
 */
export function letteringDepth({ lines, size, subline = null, aspect }) {
  const padding = 6
  const headline = Math.min((lines * size * 0.9) / aspect, HEADLINE_SHARE)
  const sublineLines = subline ? Math.min(2, Math.ceil(String(subline).length / 34)) : 0
  const under = subline ? 2.5 + sublineLines * 7 * 1.05 : 0

  return Math.min(1, (padding + under + LETTERING_GAP) / aspect / 100 + headline / 100)
}

/**
 * Where, in the tile, a shape must start to stay clear of lettering that
 * runs a share of the frame's height from the title's edge.
 *
 * The tile is a square anchored to the shape's corner and sliced by the
 * frame. A frame at least as tall as it is wide shows the tile's whole
 * height; a wider one shows the part of it nearest the shape's corner. The
 * answer is in the shape's own bottom-right drawing space, whichever corner
 * the poster flips it to.
 *
 * @param {number} depth The lettering's depth, from {@link letteringDepth}.
 * @param {number} aspect The frame's height over its width.
 * @returns {number} The `y` the shape must not reach above, from 0 to 100.
 */
export function tileClearance(depth, aspect) {
  const { height } = POSTER_VIEWBOX
  const shown = Math.min(1, aspect)

  return r2(height * (1 - shown) + height * shown * depth)
}

/**
 * The drawing for an event.
 *
 * With `clearTop`, the shape is scaled toward its corner until nothing of it
 * reaches above that line of the tile, so a long title never has a ring or a
 * disc run through its lettering. `EventPoster` works the line out from the
 * title it is setting ({@link letteringDepth}, {@link tileClearance}).
 *
 * @param {object} options What to draw.
 * @param {string} options.seed The event's slug (or any stable string).
 * @param {string} [options.category] Its category.
 * @param {number} [options.clearTop] The `y` the shape must stay below, in the shape's bottom-right drawing space.
 * @returns {{viewBox: string, palette: string, motif: string, tone: 'inverse'|'ink', titleAt: 'top'|'bottom', anchor: string, shapeTop: number, children: Array<object>}} The drawing and how to set the title over it.
 */
export function posterArt(options) {
  const design = posterDesign(options)
  const { width, height } = POSTER_VIEWBOX
  const random = seededRandom(design.seed)
  const drawn = MOTIF_DRAWINGS[design.motif]({ random, scheme: design.scheme })
  // Scaled about the tile's corner (100, 100), which the frame keeps in view,
  // rounded down so the shape never ends up a hair above its line.
  const reach = drawingTop(drawn)
  const clearTop = Number.isFinite(options.clearTop) ? options.clearTop : null
  const scale =
    clearTop !== null && reach < clearTop
      ? Math.max(0, Math.floor(((height - clearTop) / (height - reach)) * 1000) / 1000)
      : 1
  const shape =
    scale < 1
      ? [
          el(
            'g',
            {
              'data-keep-clear': '',
              transform: `matrix(${scale} 0 0 ${scale} ${r2(width * (1 - scale))} ${r2(height * (1 - scale))})`,
            },
            drawn,
          ),
        ]
      : drawn
  const shapeTop = height - (height - reach) * scale
  // The shape is drawn for the bottom-right; a mirrored poster flips the tile
  // across, a title-at-the-bottom poster flips it up, so the shape always
  // sits in the corner away from the words.
  const flipX = design.mirrored ? -1 : 1
  const flipY = design.titleAt === 'bottom' ? -1 : 1
  const transform =
    flipX === 1 && flipY === 1
      ? null
      : `matrix(${flipX} 0 0 ${flipY} ${flipX === -1 ? width : 0} ${flipY === -1 ? height : 0})`

  return {
    viewBox: `0 0 ${width} ${height}`,
    palette: design.scheme.name,
    motif: design.motif,
    tone: design.tone,
    titleAt: design.titleAt,
    anchor: design.anchor,
    shapeTop,
    children: [
      el('rect', {
        x: -200,
        y: -200,
        width: width + 400,
        height: height + 400,
        fill: design.scheme.ground,
      }),
      el('g', transform ? { transform } : {}, shape),
    ],
  }
}

/**
 * What the poster is, for its accessible name: the kind of night it
 * advertises. `EventPoster` adds " for <title>".
 *
 * @param {string|undefined} category An `EVENT_CATEGORIES` value.
 * @returns {string} Such as "Comedy poster", or "Event poster" for a category the site does not know.
 */
export function describePoster(category) {
  return `${categoryDescriptor(category).label} poster`
}

/** Joints at which a long title splits into a headline and a line under it. */
const TITLE_JOINTS = [/\s*:\s+/u, /\s+[-–—|]\s+/u]

/** Words that start the part of a long title a poster can set smaller. */
const TITLE_TAILS = /\s+(?=(?:with|featuring|feat\.|ft\.|presents|live at|at the)\s)/iu

/**
 * The part of a title a poster sets huge, and the rest it sets small.
 *
 * "Bay Lights Garba: Opening Night" is a headline and a line under it, as is
 * "Navratri Garba Nights - 16th Oct in NJ". A long title with no such joint
 * is split before "with" or "featuring". A short title is all headline.
 *
 * @param {string} title The event's title.
 * @returns {{headline: string, subline: string|null}} The two parts.
 */
export function posterTitle(title) {
  const text = String(title ?? '')
    .replace(/\s+/gu, ' ')
    .trim()

  for (const joint of TITLE_JOINTS) {
    const match = joint.exec(text)

    if (match && match.index >= 3 && match.index <= 44) {
      const rest = text.slice(match.index + match[0].length).trim()

      if (rest) return { headline: text.slice(0, match.index), subline: rest }
    }
  }

  if (text.length > 30) {
    const match = TITLE_TAILS.exec(text)

    if (match && match.index >= 6) {
      return { headline: text.slice(0, match.index), subline: text.slice(match.index).trim() }
    }
  }

  return { headline: text, subline: null }
}

/**
 * How large to set a headline so it fills its poster without breaking a word.
 *
 * Measured in container units, so one answer holds for a 60px thumbnail and a
 * 600px hero: the size is the largest at which the longest word fits the
 * measure and the wrapped lines fit the share of the height the title may
 * take, at the face's condensed bold (about 0.46em a capital).
 *
 * @param {string} headline The words to set.
 * @param {object} [options] Options.
 * @param {number} [options.aspect] The frame's height over its width (1.25 for 4:5).
 * @param {number} [options.share] The share of the frame's height, in percent, the lines may take.
 *   54 by default; a poster with its shape beside the title passes {@link HEADLINE_SHARE}.
 * @returns {{fontSize: string, lines: number, size: number}} A CSS `font-size`, the line count it was fitted for, and the size in the frame's width units.
 */
export function fitHeadline(headline, { aspect = 1.25, share = 54 } = {}) {
  const words = String(headline ?? '')
    .toUpperCase()
    .split(/\s+/u)
    .filter(Boolean)
  const em = 0.46
  const measure = 84
  const leading = 0.9

  if (words.length === 0) return { fontSize: 'min(12cqi, 6rem)', lines: 1, size: 12 }

  const longest = Math.max(...words.map((word) => word.length))
  /**
   * How many lines the words wrap to at a size.
   *
   * @param {number} size A size in cqi.
   * @returns {number} The line count.
   */
  const linesAt = (size) => {
    const capacity = measure / (size * em)
    let lines = 1
    let used = 0

    for (const word of words) {
      const needed = used === 0 ? word.length : used + 0.45 + word.length

      if (needed <= capacity) used = needed
      else {
        lines += 1
        used = word.length
      }
    }

    return lines
  }

  let best = { size: 4, lines: linesAt(4) }

  for (let size = 4; size <= 34; size += 0.5) {
    if (size * em * longest > measure) break

    const lines = linesAt(size)

    if (lines * size * leading <= share * aspect) best = { size, lines }
  }

  // Rounded down, so the capped lines never run past their share.
  const heightCap = Math.floor((share / (best.lines * leading)) * 100) / 100

  return {
    fontSize: `min(${best.size}cqi, ${heightCap}cqb, 6rem)`,
    lines: best.lines,
    size: best.size,
  }
}

/**
 * Escape a value for an XML attribute.
 *
 * @param {string|number} value An attribute value.
 * @returns {string} Safe to place between double quotes.
 */
function escapeAttribute(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;')
}

/**
 * Write one node, and its children, as SVG markup.
 *
 * @param {{tag: string, attrs: Record<string, string|number>, children: Array<object>}} node A node.
 * @returns {string} Its markup.
 */
function nodeToString(node) {
  const attrs = Object.entries(node.attrs)
    .map(([name, value]) => ` ${name}="${escapeAttribute(value)}"`)
    .join('')

  if (node.children.length === 0) return `<${node.tag}${attrs}/>`

  return `<${node.tag}${attrs}>${node.children.map(nodeToString).join('')}</${node.tag}>`
}

/**
 * The window onto the drawing a frame of another shape shows, for a renderer
 * that does not honour `preserveAspectRatio` (the social card). A tall frame
 * is cut from the tile toward the shape's corner, as a browser's `slice`
 * would cut it. A wide one shows the whole height of the tile against its
 * corner and lets the ground run on to the far edge, which keeps the shape at
 * a poster's scale and gives the title the open side.
 *
 * @param {string} anchor The design's anchor, such as `xMaxYMax slice`.
 * @param {number} aspect The frame's height over its width.
 * @returns {string} A `viewBox` value.
 */
export function croppedViewBox(anchor, aspect) {
  const { width, height } = POSTER_VIEWBOX
  const w = r2(width / aspect)

  return `${anchor.startsWith('xMax') ? r2(width - w) : 0} 0 ${w} ${height}`
}

/**
 * A standalone SVG file of an event's poster: the plate and its shape.
 *
 * @param {object} options As {@link posterArt}, plus an accessible title.
 * @param {string} options.title Written into `<title>`.
 * @param {number} [options.aspect] Crop to a frame of this height over width, toward the shape's corner, instead of leaving the crop to the viewer.
 * @returns {string} A complete SVG document, anchored to its shape's corner.
 */
export function toSvgString(options) {
  const { title, aspect, ...drawing } = options
  const art = posterArt(drawing)
  const viewBox = aspect ? croppedViewBox(art.anchor, aspect) : art.viewBox

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" preserveAspectRatio="${art.anchor}" role="img">`,
    `<title>${escapeAttribute(title)}</title>`,
    art.children.map(nodeToString).join(''),
    '</svg>',
  ].join('')
}
