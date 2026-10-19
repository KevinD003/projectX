import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { EventArt, posterTransitionName } from './event-art.jsx'

const COVER = {
  id: 'cmedia0000000000000000001',
  url: '/v1/media/cmedia0000000000000000001',
  altText: 'Dancers circling a lit garbo under string lights',
  width: 1200,
  height: 630,
  contentType: 'image/png',
}

const EVENT = { slug: 'garba-night', title: 'Garba Night', category: 'GARBA_DANDIYA' }

describe('EventArt', () => {
  it('draws the approved cover through the image optimiser, with the organiser’s description', () => {
    const { container } = render(<EventArt event={{ ...EVENT, coverImage: COVER }} />)
    const image = screen.getByRole('img', { name: COVER.altText })

    expect(image.tagName).toBe('IMG')
    expect(image.getAttribute('src')).toContain(
      '/_next/image?url=%2Fapi%2Fv1%2Fmedia%2Fcmedia0000000000000000001',
    )
    expect(image.getAttribute('srcset')).toContain('%2Fapi%2Fv1%2Fmedia%2F')
    expect(container.querySelector('svg')).toBeNull()
    expect(container.querySelector('[data-slot="event-art"]')).toHaveClass('aspect-[3/2]')
  })

  it('says nothing when it is decoration beside a title', () => {
    const { container } = render(<EventArt event={{ ...EVENT, coverImage: COVER }} decorative />)
    const image = container.querySelector('img')

    expect(image).toHaveAttribute('alt', '')
    expect(screen.queryByRole('img', { name: COVER.altText })).toBeNull()
  })

  it('falls back to the generated poster with no cover', () => {
    const { container } = render(<EventArt event={{ ...EVENT, coverImage: null }} />)

    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('[data-slot="poster"] > svg')).not.toBeNull()
    expect(
      screen.getByRole('img', { name: 'Garba & Dandiya poster for Garba Night' }),
    ).toBeInTheDocument()
  })

  it.each([
    ['a third-party address', 'https://tracker.example/pixel.png'],
    ['a path with a query', '/v1/media/cmedia0000000000000000001?x=1'],
    ['a relative escape', '/v1/media/../auth/me'],
  ])('refuses a cover URL that is %s and draws the poster', (_name, url) => {
    const { container } = render(<EventArt event={{ ...EVENT, coverImage: { ...COVER, url } }} />)

    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('[data-slot="poster"] > svg')).not.toBeNull()
  })

  it('uses the hero frame for the event page, sized for the column it sits in', () => {
    const { container } = render(
      <EventArt
        event={{ ...EVENT, coverImage: COVER }}
        variant="hero"
        priority
        className="lg:h-full"
      />,
    )
    const frame = container.querySelector('[data-slot="event-art"]')

    expect(frame).toHaveClass('aspect-[5/4]', 'lg:aspect-[4/5]', 'lg:h-full')
    expect(container.querySelector('img')).toHaveAttribute(
      'sizes',
      '(min-width: 1024px) 34rem, 100vw',
    )
  })

  it('frames a wall poster at 4:5, for a four-up wall', () => {
    const { container } = render(
      <EventArt event={{ ...EVENT, coverImage: COVER }} variant="poster" />,
    )

    expect(container.querySelector('[data-slot="event-art"]')).toHaveClass('aspect-[4/5]')
    expect(container.querySelector('img')).toHaveAttribute(
      'sizes',
      '(min-width: 1280px) 20rem, (min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw',
    )
  })

  it('prints a poster’s plates into register only when asked, and never a photograph', () => {
    const { container, rerender } = render(<EventArt event={EVENT} variant="hero" registration />)

    expect(container.querySelector('[data-slot="poster"]')).toHaveAttribute('data-registration', '')

    rerender(<EventArt event={{ ...EVENT, coverImage: COVER }} variant="hero" registration />)
    expect(container.querySelector('[data-registration]')).toBeNull()
  })

  it('names the picture for the shared morph only when asked', () => {
    expect(posterTransitionName(EVENT)).toBe('poster-garba-night')
    expect(posterTransitionName({ slug: 'raas/../x y' })).toBe('poster-raas----x-y')

    const { container } = render(<EventArt event={EVENT} transitionName />)

    // The transition wraps the picture without adding a box of its own.
    expect(container.firstElementChild).toHaveAttribute('data-slot', 'poster')
  })
})
