import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { EmailAddress } from './email-address.jsx'

describe('EmailAddress', () => {
  it('reads as the whole address, one run of text', () => {
    const { container } = render(<EmailAddress address="nisha.patel@mirrorwork.example" />)
    const drawn = container.querySelector('[data-slot="email-address"]')

    expect(drawn.textContent).toBe('nisha.patel@mirrorwork.example')
    expect(
      screen.getByText(
        (_, node) =>
          node?.textContent === 'nisha.patel@mirrorwork.example' &&
          node.dataset.slot === 'email-address',
      ),
    ).toBe(drawn)
  })

  it('offers a break before the @ and before each dot of the domain, and nowhere else', () => {
    const { container } = render(<EmailAddress address="nisha.patel@mirror.work.example" />)
    const drawn = container.querySelector('[data-slot="email-address"]')

    expect(drawn.querySelectorAll('wbr')).toHaveLength(3)
    expect(drawn.innerHTML.replace(/<\/?span[^>]*>/gu, '')).toBe(
      'nisha.patel<wbr>@mirror<wbr>.work<wbr>.example',
    )
  })

  it('never breaks a word anywhere it runs out of room', () => {
    const { container } = render(<EmailAddress address="asha@example.com" />)
    const drawn = container.querySelector('[data-slot="email-address"]')

    expect(drawn.className).toBe('break-words')
    expect(container.innerHTML).not.toContain('break-all')
  })

  it('says it is not shown when there is no address', () => {
    const { container, rerender } = render(<EmailAddress address={null} />)

    expect(container.textContent).toBe('Not shown')
    rerender(<EmailAddress address="   " fallback="No address" />)
    expect(container.textContent).toBe('No address')
    expect(container.querySelector('[data-slot="email-address"]')).toBeNull()
  })

  it('draws something without an @ as it came, with no break offered', () => {
    const { container } = render(<EmailAddress address="not-an-address" />)

    expect(container.textContent).toBe('not-an-address')
    expect(container.querySelector('wbr')).toBeNull()
  })
})
