/**
 * The phone's buy bar: the price and a way down to the tickets, out of the
 * way while the tickets themselves are on screen.
 *
 * @module components/sticky-buy-bar.test
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'

import { StickyBuyBar } from './sticky-buy-bar.jsx'

/** The observers made, so a test can say what they see. */
let observers = []

/** A stand-in for the browser's IntersectionObserver. */
class FakeObserver {
  constructor(callback) {
    this.callback = callback
    this.targets = []
    this.disconnected = false
    observers.push(this)
  }

  observe(target) {
    this.targets.push(target)
  }

  disconnect() {
    this.disconnected = true
  }

  /**
   * Report whether the target is on screen.
   *
   * @param {boolean} isIntersecting Whether it is.
   * @returns {void}
   */
  report(isIntersecting) {
    this.callback([{ isIntersecting, target: this.targets[0] }])
  }
}

afterEach(() => {
  cleanup()
  observers = []
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

/**
 * Draw the bar beside a tickets box.
 *
 * @returns {HTMLElement} The bar.
 */
function drawWithBox() {
  const box = document.createElement('aside')

  box.id = 'tickets'
  document.body.append(box)
  render(<StickyBuyBar amount="$38.06" note="with fees" />)

  return document.querySelector('[data-buy-bar]')
}

describe('StickyBuyBar', () => {
  it('says the price and what it includes, and leads down to the tickets', () => {
    vi.stubGlobal('IntersectionObserver', FakeObserver)

    const bar = drawWithBox()

    expect(screen.getByText('From $38.06')).toBeInTheDocument()
    expect(screen.getByText('with fees')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'See tickets' })).toHaveAttribute('href', '#tickets')
    // Fixed to the foot of a phone's screen, and not drawn on a desk.
    expect(bar).toHaveClass('fixed', 'bottom-0', 'lg:hidden')
    expect(observers[0].targets[0]).toBe(document.getElementById('tickets'))
  })

  it('steps out of the way, and out of the tab order, while the tickets are on screen', () => {
    vi.stubGlobal('IntersectionObserver', FakeObserver)

    const bar = drawWithBox()
    const link = screen.getByRole('link', { name: 'See tickets' })

    expect(bar).not.toHaveAttribute('data-hidden')

    act(() => observers[0].report(true))
    expect(bar).toHaveAttribute('data-hidden')
    expect(bar).toHaveClass('data-hidden:invisible')
    expect(link).toHaveAttribute('tabindex', '-1')

    act(() => observers[0].report(false))
    expect(bar).not.toHaveAttribute('data-hidden')
    expect(link).not.toHaveAttribute('tabindex')
  })

  it('stays put where it cannot watch, and stops watching when it goes', () => {
    vi.stubGlobal('IntersectionObserver', undefined)

    const bar = drawWithBox()

    expect(bar).not.toHaveAttribute('data-hidden')
    cleanup()

    vi.stubGlobal('IntersectionObserver', FakeObserver)
    const { unmount } = render(<StickyBuyBar amount="$1.00" note="no charge" target="nowhere" />)

    // No tickets box to watch: nothing is observed.
    expect(observers).toHaveLength(0)
    unmount()
  })

  it('disconnects its observer on unmount', () => {
    vi.stubGlobal('IntersectionObserver', FakeObserver)

    drawWithBox()
    cleanup()

    expect(observers[0].disconnected).toBe(true)
  })
})
