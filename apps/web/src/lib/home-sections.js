/**
 * The shaping the home page does to what the catalogue sends it.
 *
 * Four small questions, each answered from data the page already has rather
 * than from anything written into it: which events have not finished, which
 * time zone each city's nights are in, what the date on a little calendar leaf
 * should say, and which organisers have a night coming up soonest. Nothing here invents a figure. A city whose
 * zone the page cannot see is put under "More cities" rather than guessed at,
 * and the counts are the facet counts the API computed, passed through.
 *
 * @module lib/home-sections
 */

/**
 * @typedef {object} CityChip
 * @property {string} city The city, exactly as the listing filters by it.
 * @property {number|null} count How many listed events it has, from the facets; null when not known.
 */

/**
 * @typedef {object} CityGroup
 * @property {string} key A stable key: the zone, or `other`.
 * @property {string} name The zone's generic name, e.g. `Eastern Time`, or `More cities`.
 * @property {string|null} short Its letters, e.g. `ET`, when the zone has them.
 * @property {CityChip[]} cities The group's cities, alphabetically.
 */

/**
 * The events that have not finished yet, in the order given.
 *
 * The listing the home page reads is every event in a listed status, and a
 * listed status says nothing about the date: a night that ended yesterday can
 * still be "on sale" until its organiser closes it. The page calls what it
 * shows "coming up" and "next", so it keeps only what is still to come or
 * happening now — an event whose end, or failing that its start, is later than
 * `now`.
 *
 * @param {object[]} events Event summaries.
 * @param {number} [now] The time to measure from, in milliseconds.
 * @returns {object[]} The events not yet over.
 */
export function notYetOver(events, now = Date.now()) {
  return (events ?? []).filter((event) => {
    const end = Date.parse(event?.endsAt ?? event?.startsAt)

    return Number.isFinite(end) && end > now
  })
}

/**
 * A zone's name in a given style, as the reader's locale writes it.
 *
 * @param {string} timeZone An IANA zone.
 * @param {'longGeneric'|'shortGeneric'|'longOffset'} style The `timeZoneName` style.
 * @param {Date} at The instant to name it at.
 * @returns {string|null} The name, or null when the zone is not one the runtime knows.
 */
function zoneName(timeZone, style, at) {
  try {
    return (
      new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: style })
        .formatToParts(at)
        .find((part) => part.type === 'timeZoneName')?.value ?? null
    )
  } catch {
    return null
  }
}

/**
 * A zone's offset from UTC in minutes, at an instant: `GMT-04:00` is -240.
 *
 * @param {string} timeZone An IANA zone.
 * @param {Date} at The instant.
 * @returns {number} Minutes east of UTC; 0 when it cannot be read.
 */
function offsetMinutes(timeZone, at) {
  const match = /GMT([+-])(\d{2}):?(\d{2})?/.exec(zoneName(timeZone, 'longOffset', at) ?? '')

  if (!match) return 0

  const minutes = Number(match[2]) * 60 + Number(match[3] ?? 0)

  return match[1] === '-' ? -minutes : minutes
}

/**
 * Group the catalogue's cities by the time zone their nights are held in, east
 * to west.
 *
 * The cities and their counts are the facets — every listed city, counted in
 * the database. The zone of each is read from the events the page loaded: the
 * zone of the first event seen in that city. A city with no event on the page
 * has no zone the page can honestly name, so it goes under "More cities".
 *
 * @param {Array<{value: string, count: number}>} cityFacets City facet counts.
 * @param {object[]} events Event summaries, each with `city` and `timezone`.
 * @param {object} [options] Options.
 * @param {Date} [options.at] The instant zone names and offsets are read at.
 * @returns {CityGroup[]} The groups, east to west, with "More cities" last.
 */
export function groupCitiesByZone(cityFacets, events, { at = new Date() } = {}) {
  const zoneOfCity = new Map()

  for (const event of events ?? []) {
    if (event?.city && event?.timezone && !zoneOfCity.has(event.city)) {
      zoneOfCity.set(event.city, event.timezone)
    }
  }

  const groups = new Map()

  for (const facet of cityFacets ?? []) {
    if (!facet?.value) continue

    const zone = zoneOfCity.get(facet.value) ?? null
    const name = zone ? zoneName(zone, 'longGeneric', at) : null
    const key = zone && name ? zone : 'other'

    if (!groups.has(key)) {
      groups.set(key, {
        key,
        name: key === 'other' ? 'More cities' : name,
        short: key === 'other' ? null : zoneName(zone, 'shortGeneric', at),
        offset: key === 'other' ? Number.NEGATIVE_INFINITY : offsetMinutes(zone, at),
        cities: [],
      })
    }

    groups.get(key).cities.push({
      city: facet.value,
      count: Number.isInteger(facet.count) ? facet.count : null,
    })
  }

  return [...groups.values()]
    .sort((left, right) => right.offset - left.offset || left.name.localeCompare(right.name))
    .map(({ offset: _offset, cities, ...group }) => ({
      ...group,
      cities: cities.sort((left, right) => left.city.localeCompare(right.city)),
    }))
}

/**
 * What a small calendar leaf beside an event says: the month and the day, in
 * the event's own zone — a night that starts at 9 PM in Santa Clara is on that
 * day in Santa Clara, whatever the date in New York.
 *
 * @param {object} event An event or summary with `startsAt` and `timezone`.
 * @returns {{month: string, day: string}|null} Such as `{month: 'Oct', day: '11'}`, or null.
 */
export function calendarLeaf(event) {
  const start = new Date(event?.startsAt ?? Number.NaN)

  if (Number.isNaN(start.getTime())) return null

  const timeZone = event?.timezone ?? 'America/New_York'

  return {
    month: new Intl.DateTimeFormat('en-US', { month: 'short', timeZone }).format(start),
    day: new Intl.DateTimeFormat('en-US', { day: 'numeric', timeZone }).format(start),
  }
}

/**
 * @typedef {object} OrganiserNext
 * @property {string} name The organiser.
 * @property {string} slug Their page's slug.
 * @property {object} next Their soonest event on the page.
 */

/**
 * The organisers with the soonest nights among the events given, one entry
 * each, with that soonest event.
 *
 * Ordered by that event's start, not by how many events an organiser has: the
 * page loaded one page of the listing, so a count here would be a count of
 * that page, and a ranking by it would claim who is biggest. An organiser with
 * no slug has no page to link to and is left out.
 *
 * @param {object[]} events Event summaries, in any order.
 * @param {number} [limit] How many organisers at most.
 * @returns {OrganiserNext[]} The organisers.
 */
export function organisersWithNext(events, limit = 4) {
  const seen = new Map()

  for (const event of events ?? []) {
    const slug = event?.organizationSlug
    const name = event?.organizationName

    if (!slug || !name) continue

    const known = seen.get(slug)

    if (!known || Date.parse(event.startsAt) < Date.parse(known.next.startsAt)) {
      seen.set(slug, { name, slug, next: event })
    }
  }

  return [...seen.values()]
    .sort((left, right) => Date.parse(left.next.startsAt) - Date.parse(right.next.startsAt))
    .slice(0, limit)
}

/**
 * A calendar date in a zone, as `YYYY-MM-DD`, and its weekday (0 is Sunday).
 *
 * @param {Date|number} instant The moment.
 * @param {string} timeZone An IANA zone.
 * @returns {{date: string, weekday: number}|null} The date there, or null for a moment or zone that cannot be read.
 */
function localDate(instant, timeZone) {
  const at = new Date(instant)

  if (Number.isNaN(at.getTime())) return null

  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short',
      timeZone,
    }).formatToParts(at)
    const part = (type) => parts.find((entry) => entry.type === type)?.value ?? ''
    const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(part('weekday'))

    return { date: `${part('year')}-${part('month')}-${part('day')}`, weekday }
  } catch {
    return null
  }
}

/**
 * A `YYYY-MM-DD` date moved by whole days.
 *
 * @param {string} date A calendar date.
 * @param {number} days How many days on (or back, when negative).
 * @returns {string} The other date.
 */
function addDays(date, days) {
  const moved = new Date(`${date}T12:00:00Z`)

  moved.setUTCDate(moved.getUTCDate() + days)

  return moved.toISOString().slice(0, 10)
}

/**
 * The dates of this weekend, Friday to Sunday, as somebody in a zone would
 * say it: from Monday to Thursday, the coming one; from Friday to Sunday, the
 * one already under way, from today.
 *
 * @param {number} now The moment to measure from, in milliseconds.
 * @param {string} timeZone An IANA zone.
 * @returns {{from: string, to: string}|null} The first and last date, inclusive.
 */
export function weekendDates(now, timeZone) {
  const today = localDate(now, timeZone)

  if (!today || today.weekday < 0) return null

  // Sunday is 0: the weekend's last day. Friday (5) and Saturday (6) are in it.
  if (today.weekday === 0) return { from: today.date, to: today.date }
  if (today.weekday >= 5) return { from: today.date, to: addDays(today.date, 7 - today.weekday) }

  const friday = addDays(today.date, 5 - today.weekday)

  return { from: friday, to: addDays(friday, 2) }
}

/**
 * @typedef {object} AgendaDay
 * @property {string} key The day, `YYYY-MM-DD` in the zone of its first event.
 * @property {object[]} events The day's events, in the order given.
 */

/**
 * @typedef {object} Agenda
 * @property {'weekend'|'upcoming'} kind Whether the list is this weekend's, or simply what is next.
 * @property {object[]} events The events listed, soonest first.
 * @property {AgendaDay[]} days The same events, by the day they are on.
 */

/**
 * What the home page lists under its first heading: this weekend's events,
 * when anything listed falls on this weekend, and otherwise the soonest events
 * still to come.
 *
 * "This weekend" is read in each event's own zone, as its date is: a Friday
 * night in Santa Clara is on Friday in Santa Clara. Only events that have not
 * finished count, and nothing is invented: a quiet weekend says "Coming up"
 * rather than padding the list with the week after.
 *
 * @param {object[]} events Event summaries, soonest first.
 * @param {object} [options] Options.
 * @param {number} [options.now] The moment to measure from, in milliseconds.
 * @param {number} [options.limit] How many events at most.
 * @returns {Agenda} The agenda.
 */
export function homeAgenda(events, { now = Date.now(), limit = 8 } = {}) {
  const upcoming = notYetOver(events, now)
  const weekend = upcoming.filter((event) => {
    const zone = event?.timezone ?? 'America/New_York'
    const window = weekendDates(now, zone)
    const day = localDate(Date.parse(event?.startsAt), zone)

    // A night that began before the weekend and is still going counts too.
    return (
      Boolean(window && day) &&
      day.date <= window.to &&
      (day.date >= window.from || Date.parse(event.startsAt) <= now)
    )
  })
  const kind = weekend.length > 0 ? 'weekend' : 'upcoming'
  const listed = (kind === 'weekend' ? weekend : upcoming).slice(0, limit)
  const days = []

  for (const event of listed) {
    const key =
      localDate(Date.parse(event.startsAt), event?.timezone ?? 'America/New_York')?.date ?? ''
    const last = days.at(-1)

    if (last && last.key === key) last.events.push(event)
    else days.push({ key, events: [event] })
  }

  return { kind, events: listed, days }
}

/**
 * The cities with the most events listed, for the short index: highest count
 * first, then alphabetically, from the facets the API counted.
 *
 * @param {Array<{value: string, count: number}>} cityFacets City facet counts.
 * @param {number} [limit] How many cities.
 * @returns {CityChip[]} The cities.
 */
export function topCities(cityFacets, limit = 12) {
  return (cityFacets ?? [])
    .filter((facet) => facet?.value && Number.isInteger(facet.count) && facet.count > 0)
    .sort((left, right) => right.count - left.count || left.value.localeCompare(right.value))
    .slice(0, limit)
    .map((facet) => ({ city: facet.value, count: facet.count }))
}
