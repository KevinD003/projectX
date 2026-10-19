/**
 * An email address that wraps where a reader expects it to.
 *
 * In a narrow table cell, `break-all` split "nisha.patel@mirrorwork.example"
 * anywhere it ran out of room, mid-word ("nisha.patel@mirror / work.example").
 * This keeps each part whole and offers exactly one place to wrap: just before
 * the `@`, and then before each dot of the domain, the places a person
 * breaks an address when they write it on two lines. A part that is still
 * wider than its cell (an unusually long name before the `@`) may break
 * inside itself as a last resort rather than push the table wider.
 *
 * The address is still one run of text to a screen reader and to copy and
 * paste: `<wbr>` adds a break opportunity and nothing else.
 *
 * @module components/email-address
 */

/**
 * The address, with break opportunities before the `@` and each domain dot.
 *
 * @param {object} props Component props.
 * @param {string|null|undefined} props.address The address.
 * @param {string} [props.fallback] What to draw when there is none.
 * @returns {JSX.Element} The address.
 */
export function EmailAddress({ address, fallback = 'Not shown' }) {
  if (typeof address !== 'string' || address.trim() === '') {
    return <span className="text-ink-muted">{fallback}</span>
  }

  const at = address.lastIndexOf('@')

  if (at <= 0) return <span className="break-words">{address}</span>

  const local = address.slice(0, at)
  const domain = address.slice(at + 1).split('.')

  return (
    <span data-slot="email-address" className="break-words">
      {local}
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
