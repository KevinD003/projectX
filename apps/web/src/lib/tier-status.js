/**
 * How a ticket tier's status reads, in words, wherever a tier is listed: the
 * event editor's tier list and the analytics page's inventory. The API's
 * `TICKET_TYPE_STATUSES` (`ON_SALE`, `DRAFT`, ...) are never shown as they
 * are spelled.
 *
 * @module lib/tier-status
 */

/** Each status's words and the badge tone the editor shows it in. */
export const TIER_STATUS = Object.freeze({
  DRAFT: Object.freeze(['Not on sale (draft)', 'neutral']),
  ON_SALE: Object.freeze(['On sale', 'success']),
  PAUSED: Object.freeze(['Paused', 'warning']),
  SOLD_OUT: Object.freeze(['Sold out', 'info']),
  CLOSED: Object.freeze(['Sales closed', 'neutral']),
})

/**
 * A tier status in words.
 *
 * @param {string|null|undefined} status A `TICKET_TYPE_STATUSES` value.
 * @returns {string} Its words; a status this table does not know, in lower case without underscores.
 */
export function tierStatusLabel(status) {
  if (TIER_STATUS[status]) return TIER_STATUS[status][0]
  if (typeof status !== 'string' || status === '') return 'Unknown'

  const words = status.toLowerCase().replaceAll('_', ' ')

  return words.charAt(0).toUpperCase() + words.slice(1)
}
