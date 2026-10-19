/**
 * The checkout's route line: five stops read in order, the current one marked
 * as the step, finished ones said in words, the gold fill drawn to the stop
 * the basket reports, and nothing reported outside a provider.
 *
 * @module components/checkout-route.test
 */

import { render, screen, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import {
  CHECKOUT_STEPS,
  CheckoutRoute,
  CheckoutStepProvider,
  checkoutStepFor,
  useReportCheckoutStep,
} from './checkout-route.jsx'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const css = readFileSync(path.join(HERE, 'commerce.css'), 'utf8')

/**
 * A stand-in basket that reports whatever step it is given.
 *
 * @param {{step: string}} props Component props.
 * @returns {null} Nothing drawn.
 */
function Reporter({ step }) {
  useReportCheckoutStep(step)
  return null
}

/**
 * The route line inside a provider, with a reporter beside it.
 *
 * @param {object} props Component props.
 * @param {string} props.step The reported step.
 * @param {string} [props.choose] The second stop's name.
 * @returns {JSX.Element} The tree.
 */
function Tree({ step, choose }) {
  return (
    <CheckoutStepProvider>
      <CheckoutRoute eventHref="/events/holi-in-the-park" choose={choose} />
      <Reporter step={step} />
    </CheckoutStepProvider>
  )
}

/**
 * The fill's scale, as drawn.
 *
 * @param {HTMLElement} container The rendered tree.
 * @returns {string} The inline transform.
 */
function fillOf(container) {
  return container.querySelector('[data-slot="route-fill"]').style.transform
}

describe('checkoutStepFor', () => {
  it.each([
    ['idle', 'tickets'],
    ['reserving', 'tickets'],
    ['reserve-failed', 'tickets'],
    ['expired', 'tickets'],
    ['held', 'details'],
    ['pay-failed', 'details'],
    ['paying', 'pay'],
    ['unsettled', 'pay'],
    ['paid', 'done'],
  ])('reads the basket status %s as the %s step', (status, step) => {
    expect(checkoutStepFor(status)).toBe(step)
  })

  it('names the basket’s steps in order, after the event', () => {
    expect(CHECKOUT_STEPS).toEqual(['tickets', 'details', 'pay', 'done'])
  })
})

describe('CheckoutRoute', () => {
  it('is a navigation named for the progress, listing the five stops in order', () => {
    render(<Tree step="tickets" />)

    const route = screen.getByRole('navigation', { name: 'Checkout progress' })
    const stops = within(route).getAllByRole('listitem')

    expect(stops.map((stop) => stop.textContent)).toEqual([
      'Event, done',
      'Tickets',
      'Details',
      'Pay',
      'Done',
    ])
    expect(stops[1]).toHaveAttribute('aria-current', 'step')
    expect(stops.filter((stop) => stop.hasAttribute('aria-current'))).toHaveLength(1)
  })

  it('calls the second stop Seats on the seat map', () => {
    render(<Tree step="tickets" choose="Seats" />)

    expect(screen.getByRole('listitem', { current: 'step' })).toHaveTextContent('Seats')
  })

  it('links only the event, as a step back', () => {
    render(<Tree step="details" />)

    const links = within(
      screen.getByRole('navigation', { name: 'Checkout progress' }),
    ).getAllByRole('link')

    expect(links).toHaveLength(1)
    expect(links[0]).toHaveAttribute('href', '/events/holi-in-the-park')
    expect(links[0]).toHaveAccessibleName('Event, done')
  })

  it('draws the gold fill to the reported stop and moves the current step with it', () => {
    const { container, rerender } = render(<Tree step="tickets" />)

    expect(fillOf(container)).toBe('scaleX(0.25)')

    rerender(<Tree step="details" />)
    expect(fillOf(container)).toBe('scaleX(0.5)')
    expect(screen.getByRole('listitem', { current: 'step' })).toHaveTextContent('Details')
    expect(screen.getByText('Tickets').parentElement).toHaveTextContent('Tickets, done')

    rerender(<Tree step="pay" />)
    expect(fillOf(container)).toBe('scaleX(0.75)')

    rerender(<Tree step="done" />)
    expect(fillOf(container)).toBe('scaleX(1)')
    expect(screen.getByRole('listitem', { current: 'step' })).toHaveTextContent('Done')
  })

  it('ignores a step it does not know', () => {
    const { container } = render(<Tree step="nonsense" />)

    expect(fillOf(container)).toBe('scaleX(0.25)')
    expect(screen.getByRole('listitem', { current: 'step' })).toHaveTextContent('Tickets')
  })

  it('keeps the fill and the dots as decoration, hidden from assistive technology', () => {
    const { container } = render(<Tree step="pay" />)

    expect(
      container.querySelector('[data-slot="route-fill"]').closest('[aria-hidden]'),
    ).not.toBeNull()
  })

  it('stands at the first stop with nothing to report, and a lone reporter does nothing', () => {
    render(
      <>
        <CheckoutRoute eventHref="/events/x" />
        <Reporter step="pay" />
      </>,
    )

    expect(screen.getByRole('listitem', { current: 'step' })).toHaveTextContent('Tickets')
  })

  it('draws the fill only without a reduced-motion setting, on a transform', () => {
    const motionSafe = css.indexOf('@media (prefers-reduced-motion: no-preference)')
    const at = css.indexOf('.route-line-fill')
    const rule = css.slice(at, css.indexOf('}', at))

    expect(motionSafe).toBeGreaterThan(-1)
    // Its one rule sits inside the motion-safe block, and nowhere else.
    expect(at).toBeGreaterThan(motionSafe)
    expect(css.indexOf('.route-line-fill', at + 1)).toBe(-1)
    expect(rule).toMatch(/transition:\s*transform\b/u)
  })
})
